import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { MOTION_CONFIG } from '../lib/motionConfig.ts';

/**
 * Manages looping decorative background videos responsibly:
 * - Respects prefers-reduced-motion by starting paused (showing the static poster).
 * - Automatically pauses via IntersectionObserver when scrolled out of view.
 * - Exposes accessible user pause/resume state and cleans up all listeners/observers.
 */
export function useBackgroundVideo(
  videoRef: RefObject<HTMLVideoElement | null>,
  containerRef: RefObject<HTMLElement | null>
) {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(MOTION_CONFIG.media.reducedMotion).matches;
  });

  const [userPaused, setUserPaused] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia(MOTION_CONFIG.media.reducedMotion).matches;
  });

  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return window.matchMedia('(max-width: 767px)').matches;
  });

  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState<boolean>(() => {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  });

  // Pause video automatically whenever the browser tab is in the background
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      setTabVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // Sync with live viewport width for responsive desktop/mobile video source selection
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobileViewport(e.matches);
    };
    setIsMobileViewport(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => {
      mql.removeEventListener?.('change', onChange);
    };
  }, []);

  // Sync with live system prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(MOTION_CONFIG.media.reducedMotion);
    const onChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
      if (e.matches) {
        setUserPaused(true);
      }
    };
    mql.addEventListener?.('change', onChange);
    return () => {
      mql.removeEventListener?.('change', onChange);
    };
  }, []);

  // Pause video automatically whenever the hero section leaves the viewport
  useEffect(() => {
    const target = containerRef.current || videoRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold: 0.05 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [containerRef, videoRef]);

  // Apply play/pause cleanly without blocking initial render
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    if (userPaused || !inView || !tabVisible) {
      video.pause();
      return;
    }

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Browser autoplay policy prevented playback; static poster remains visible
      });
    }
  }, [userPaused, inView, tabVisible, isMobileViewport, videoRef]);

  const togglePause = useCallback(() => {
    setUserPaused((prev) => !prev);
  }, []);

  return {
    isPaused: userPaused,
    inView,
    isMobileViewport,
    reducedMotion,
    togglePause,
  };
}
