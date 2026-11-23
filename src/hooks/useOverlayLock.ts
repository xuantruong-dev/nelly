import { useEffect } from 'react';
import { pauseSmoothScroll } from '../lib/smoothScroll.ts';

let activeOverlayLocks = 0;
let savedHtmlOverflow = '';
let savedBodyOverflow = '';
let savedHtmlOverscroll = '';

function acquireOverlayLock() {
  if (typeof document === 'undefined') return;
  if (activeOverlayLocks === 0) {
    savedHtmlOverflow = document.documentElement.style.overflow;
    savedBodyOverflow = document.body.style.overflow;
    savedHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    pauseSmoothScroll(true);
  }
  activeOverlayLocks += 1;
}

function releaseOverlayLock() {
  if (typeof document === 'undefined') return;
  activeOverlayLocks = Math.max(0, activeOverlayLocks - 1);
  if (activeOverlayLocks === 0) {
    document.documentElement.style.overflow = savedHtmlOverflow;
    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overscrollBehavior = savedHtmlOverscroll;
    pauseSmoothScroll(false);
  }
}

/**
 * Returns true while any drawer, modal, or lightbox holds an active background scroll lock.
 */
export function isOverlayLocked(): boolean {
  return activeOverlayLocks > 0;
}

/**
 * Reference-counted background scroll lock for drawers, modals, and lightboxes.
 * Coordinates both native mobile touch scroll locking and Lenis smooth-scroll pausing,
 * safely supporting nested overlays (e.g., modal -> image lightbox).
 */
export function useOverlayLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    acquireOverlayLock();
    return () => {
      releaseOverlayLock();
    };
  }, [active]);
}
