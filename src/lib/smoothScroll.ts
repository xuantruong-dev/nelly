import Lenis from 'lenis';
import { MOTION_CONFIG, ScrollTrigger, gsap, prefersReducedMotion } from './motionConfig.ts';
import { isOverlayLocked } from '../hooks/useOverlayLock.ts';

let activeLenis: Lenis | null = null;
let tickerCallback: ((time: number) => void) | null = null;
let cleanupReduceListener: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let refreshTimer: number | null = null;

/**
 * Starts silky Lenis smooth mouse-wheel scrolling synced tightly with GSAP's ticker & ScrollTrigger.
 * - Tuned lerp (0.082) and wheelMultiplier (1.08) for responsive, butter-smooth wheel glide without heaviness.
 * - Respects [data-lenis-prevent] containers (e.g. modals, drawers) so inner scrolling never fights Lenis.
 * - Automatically disabled under prefers-reduced-motion; leaves mobile touch momentum native.
 */
export function startSmoothScroll(): Lenis | null {
  if (typeof window === 'undefined' || prefersReducedMotion()) {
    return null;
  }
  if (activeLenis) {
    return activeLenis;
  }

  const lenis = new Lenis({
    lerp: 0.082,
    wheelMultiplier: 1.08,
    touchMultiplier: 1.4,
    smoothWheel: true,
    syncTouch: false,
    autoRaf: false,
    prevent: (node) => Boolean(node.closest?.('[data-lenis-prevent]')),
    anchors: {
      offset: -84,
    },
  });

  lenis.on('scroll', ScrollTrigger.update);

  const onTick = (time: number) => {
    lenis.raf(time * 1000);
  };

  gsap.ticker.add(onTick);
  gsap.ticker.lagSmoothing(0);

  activeLenis = lenis;
  tickerCallback = onTick;

  // Keep Lenis & ScrollTrigger bounds exact whenever page height changes dynamically (e.g. images load)
  if (typeof ResizeObserver !== 'undefined' && document.body) {
    resizeObserver = new ResizeObserver(() => {
      if (isOverlayLocked()) return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (isOverlayLocked()) return;
        activeLenis?.resize();
        ScrollTrigger.refresh();
      }, 160);
    });
    resizeObserver.observe(document.body);
  }

  // Listen for runtime reduced-motion preference toggle
  const mq = window.matchMedia(MOTION_CONFIG.media.reducedMotion);
  const onReduceChange = (e: MediaQueryListEvent) => {
    if (e.matches) {
      stopSmoothScroll();
    }
  };
  mq.addEventListener?.('change', onReduceChange);
  cleanupReduceListener = () => mq.removeEventListener?.('change', onReduceChange);

  return lenis;
}

export function stopSmoothScroll(): void {
  if (refreshTimer !== null) {
    window.clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
  if (cleanupReduceListener) {
    cleanupReduceListener();
    cleanupReduceListener = null;
  }
  if (tickerCallback) {
    gsap.ticker.remove(tickerCallback);
    tickerCallback = null;
  }
  if (activeLenis) {
    activeLenis.destroy();
    activeLenis = null;
  }
}

export function getSmoothScroll(): Lenis | null {
  return activeLenis;
}

export function pauseSmoothScroll(paused: boolean): void {
  if (!activeLenis) return;
  if (paused) {
    activeLenis.stop();
  } else {
    activeLenis.start();
  }
}

export function scrollToTop(immediate = false): void {
  if (activeLenis) {
    if (immediate) {
      activeLenis.scrollTo(0, { immediate: true, force: true });
    } else {
      activeLenis.scrollTo(0, {
        duration: 0.78,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      });
    }
    return;
  }
  window.scrollTo({
    top: 0,
    behavior: immediate || prefersReducedMotion() ? 'auto' : 'smooth',
  });
}
