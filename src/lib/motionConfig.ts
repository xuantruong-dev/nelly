import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

// Register only the GSAP plugins actively used across Hoa Nelly
gsap.registerPlugin(ScrollTrigger, Flip, SplitText, useGSAP);

// Keep ScrollTrigger calculations smooth across mobile address-bar resizes
ScrollTrigger.config({
  ignoreMobileResize: true,
});

/**
 * Centralized motion configuration for Hoa Nelly.
 * Adjust durations, easings, 3D amplitudes, or cinematic scroll choreography here.
 */
export const MOTION_CONFIG = {
  durations: {
    micro: 0.18, // Button, icon & cart badge feedback (0.15–0.25s)
    overlay: 0.32, // Menu, filter panel, cart drawer, modal (0.25–0.4s)
    route: 0.28, // Page entrance transition (0.25–0.45s)
    mediaSwap: 0.48, // Variant image swap or collection switch (0.45–0.65s)
    collectionSwitch: 0.54, // 3D occasion collection transition
    heroSequence: 0.95, // Opening hero sequence (0.8–1.2s)
  },
  eases: {
    primary: 'power3.out',
    soft: 'power2.out',
    gentle: 'sine.inOut',
    balloonPop: 'back.out(1.4)', // Subtle elastic hint reserved for small balloon accents
  },
  depth3D: {
    perspective: 1200, // 1000–1400px range
    heroMaxTiltDeg: 4.0, // Desktop pointer max tilt (3–5 deg)
    heroParallaxPx: 12, // Desktop pointer layer shift (8–16 px)
    cardMaxTiltDeg: 3.0, // Selective subtle tilt on product image frame only
    scrollScrub: 0.38, // Crisp, silky scroll-linked smoothing
  },
  cinematicScroll: {
    scrub: 0.38, // Responsive follow-through when scrolling or stopping
    heroPinDistance: '+=82%', // Effortless scroll transition from Hero to 5 Categories
    frameScaleStart: 1.04, // Gentle inner image settle without cropping edges
    headlineShiftPx: 24, // Vietnamese line reveal vertical shift
    headlineLineStagger: 0.065, // Crisp line rhythm
    galleryBatchStagger: 0.065, // Rhythmic small-group reveal in gallery
  },
  media: {
    desktopFinePointer: '(hover: hover) and (pointer: fine) and (min-width: 1024px)',
    desktopPinned: '(min-width: 1024px) and (min-height: 680px)',
    desktop: '(min-width: 1024px)',
    mobile: '(max-width: 1023px)',
    reducedMotion: '(prefers-reduced-motion: reduce)',
  },
} as const;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(MOTION_CONFIG.media.reducedMotion).matches;
}

// Refresh ScrollTrigger once webfonts settle so SplitText & pin geometry stay exact
if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.ready
    .then(() => {
      requestAnimationFrame(() => ScrollTrigger.refresh());
    })
    .catch(() => {});
}

export { gsap, ScrollTrigger, Flip, SplitText, useGSAP };
