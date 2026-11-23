import React, { useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  MOTION_CONFIG,
  ScrollTrigger,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from '../lib/motionConfig.ts';

interface RouteTransitionProps {
  children: React.ReactNode;
}

/**
 * Lightweight, non-blocking GSAP page entrance transition (opacity-only so
 * position: sticky, position: fixed modals/bars, and ScrollTrigger coordinates stay intact).
 */
export function RouteTransition({ children }: RouteTransitionProps) {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);

  const isFormHeavyRoute =
    location.pathname.startsWith('/dat-hang') || location.pathname.startsWith('/quan-tri');

  useGSAP(
    () => {
      const el = containerRef.current;
      if (!el || isFormHeavyRoute || prefersReducedMotion()) {
        if (el) gsap.set(el, { clearProps: 'opacity' });
        requestAnimationFrame(() => ScrollTrigger.refresh());
        return;
      }

      gsap.fromTo(
        el,
        { opacity: 0.01 },
        {
          opacity: 1,
          duration: MOTION_CONFIG.durations.route * 0.85,
          ease: MOTION_CONFIG.eases.soft,
          clearProps: 'opacity',
          overwrite: 'auto',
          onComplete: () => {
            ScrollTrigger.refresh();
          },
        }
      );
    },
    { scope: containerRef, dependencies: [location.pathname] }
  );

  return (
    <div ref={containerRef} className="w-full">
      {children}
    </div>
  );
}
