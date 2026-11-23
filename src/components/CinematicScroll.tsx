import React, { useRef } from 'react';
import { MOTION_CONFIG, SplitText, gsap, useGSAP } from '../lib/motionConfig.ts';

interface CinematicFrameProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  /** Play immediately on page mount (above the fold) or scrub with scroll (default true) */
  triggerOnScroll?: boolean;
  /** Enables a gentle exit recede after the showcase leaves the reading zone. Use ONLY on editorial showcases. */
  exitFade?: boolean;
  /** Subtle 3D tilt-to-flat entrance on desktop (<= 4 deg) */
  tilt3D?: boolean;
  /** Rounded corner radius in px for clip-path inset matching */
  radiusPx?: number;
}

/**
 * Reusable GSAP ScrollTrigger frame-reveal + inner image scale (1.08 -> 1) wrapper.
 * - Outer layer manages scene transition (frame clip + optional showcase exit).
 * - Inner layer manages image scale so CSS transitions and GSAP never fight.
 * - Fully reversible on scroll up, settles crisply on stop/fast scroll,
 *   and degrades gracefully on mobile & prefers-reduced-motion.
 */
export function CinematicFrame({
  children,
  className = '',
  innerClassName = 'w-full h-full',
  triggerOnScroll = true,
  exitFade = false,
  tilt3D = false,
  radiusPx = 16,
}: CinematicFrameProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: MOTION_CONFIG.media.reducedMotion,
          isDesktop: MOTION_CONFIG.media.desktop,
          isMobile: MOTION_CONFIG.media.mobile,
        },
        (context) => {
          const { reduceMotion, isDesktop } = context.conditions || {};
          if (reduceMotion || !triggerRef.current || !frameRef.current || !innerRef.current) {
            return;
          }

          const scrubVal = MOTION_CONFIG.cinematicScroll.scrub;
          const startScale = isDesktop ? MOTION_CONFIG.cinematicScroll.frameScaleStart : 1.05;

          if (!triggerOnScroll) {
            // Above-the-fold one-shot editorial frame reveal
            const mountTl = gsap.timeline({
              defaults: { ease: MOTION_CONFIG.eases.primary },
            });
            mountTl.fromTo(
              frameRef.current,
              {
                clipPath: isDesktop
                  ? `inset(8% 3% 8% 3% round ${radiusPx}px)`
                  : `inset(5% 0% 5% 0% round ${radiusPx}px)`,
                y: isDesktop ? 18 : 10,
                opacity: 0.4,
                rotationX: isDesktop && tilt3D ? 3 : 0,
                rotationY: isDesktop && tilt3D ? -2.5 : 0,
              },
              {
                clipPath: `inset(0% 0% 0% 0% round ${radiusPx}px)`,
                y: 0,
                opacity: 1,
                rotationX: 0,
                rotationY: 0,
                duration: 0.78,
                clearProps: 'clipPath,transform,opacity',
              },
              0
            );
            mountTl.fromTo(
              innerRef.current,
              { scale: startScale },
              {
                scale: 1,
                duration: 0.88,
                ease: MOTION_CONFIG.eases.soft,
                clearProps: 'transform',
              },
              0
            );
            return;
          }

          // Phase 1 (Enter -> Hold): Frame opens smoothly while inner image eases from 1.08 -> 1
          const enterTl = gsap.timeline({
            scrollTrigger: {
              trigger: triggerRef.current,
              start: isDesktop ? 'top 88%' : 'top 92%',
              end: isDesktop ? 'top 38%' : 'top 52%',
              scrub: scrubVal,
              invalidateOnRefresh: true,
            },
          });

          enterTl.fromTo(
            frameRef.current,
            {
              clipPath: isDesktop
                ? `inset(10% 3% 10% 3% round ${radiusPx}px)`
                : `inset(6% 0% 6% 0% round ${radiusPx}px)`,
              y: isDesktop ? 24 : 14,
              opacity: 0.35,
              rotationX: isDesktop && tilt3D ? 3.5 : 0,
              rotationY: isDesktop && tilt3D ? -3.0 : 0,
            },
            {
              clipPath: `inset(0% 0% 0% 0% round ${radiusPx}px)`,
              y: 0,
              opacity: 1,
              rotationX: 0,
              rotationY: 0,
              ease: 'none',
            },
            0
          );

          enterTl.fromTo(
            innerRef.current,
            { scale: startScale },
            { scale: 1, ease: 'none' },
            0
          );

          // Phase 3 (Optional Showcase Exit): Gentle upward recede once past reading zone (desktop only)
          if (exitFade && isDesktop) {
            gsap.fromTo(
              triggerRef.current,
              { y: 0, opacity: 1 },
              {
                y: -22,
                opacity: 0.45,
                ease: 'none',
                immediateRender: false,
                scrollTrigger: {
                  trigger: triggerRef.current,
                  start: 'bottom 34%',
                  end: 'bottom top',
                  scrub: scrubVal,
                  invalidateOnRefresh: true,
                },
              }
            );
          }
        }
      );
    },
    { scope: triggerRef, dependencies: [triggerOnScroll, exitFade, tilt3D, radiusPx] }
  );

  return (
    <div ref={triggerRef} className={tilt3D ? 'hn-perspective' : ''}>
      <div ref={frameRef} className={`hn-frame-clip overflow-hidden ${className}`}>
        <div ref={innerRef} className={innerClassName}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface CinematicHeadingProps {
  as?: 'h1' | 'h2' | 'h3';
  children: string;
  className?: string;
  /** Play immediately on page mount (e.g., top of subpage) or trigger on scroll */
  triggerOnScroll?: boolean;
  /** Optional slight beat delay when entering after a paired image frame */
  delay?: number;
}

/**
 * Vietnamese diacritic-safe line-by-line heading reveal using GSAP SplitText:
 * - Preserves stacked Vietnamese accents (ệ, ự, ỡ, Ước, ấ) via padded overflow: clip masks.
 * - Preserves screen-reader clarity via SplitText aria handling + intact semantic heading tag.
 * - Re-splits cleanly on font load / window resize without flashing or hiding visible text.
 * - Reverses smoothly when scrolling back above the trigger and settles silently on reduced-motion.
 */
export function CinematicHeading({
  as = 'h2',
  children,
  className = '',
  triggerOnScroll = true,
  delay = 0,
}: CinematicHeadingProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: MOTION_CONFIG.media.reducedMotion,
          isDesktop: MOTION_CONFIG.media.desktop,
        },
        (context) => {
          const { reduceMotion, isDesktop } = context.conditions || {};
          const el = headingRef.current;
          if (reduceMotion || !el) return;

          const shiftY = isDesktop ? MOTION_CONFIG.cinematicScroll.headlineShiftPx : 18;
          const stagger = MOTION_CONFIG.cinematicScroll.headlineLineStagger;
          let splitInstance: SplitText | null = null;
          let hasCreatedReveal = false;

          try {
            splitInstance = SplitText.create(el, {
              type: 'lines',
              autoSplit: true,
              mask: 'lines',
              aria: 'auto',
              linesClass: 'hn-split-line-item',
              onSplit(self) {
                self.masks?.forEach((m) => m.classList.add('hn-split-line-mask'));
                if (hasCreatedReveal) {
                  // On subsequent font-load/resize splits, keep lines immediately legible
                  gsap.set(self.lines, { clearProps: 'transform,opacity' });
                  return;
                }
                hasCreatedReveal = true;

                if (!triggerOnScroll) {
                  return gsap.from(self.lines, {
                    y: shiftY,
                    opacity: 0,
                    duration: 0.62,
                    delay,
                    stagger,
                    ease: MOTION_CONFIG.eases.primary,
                    clearProps: 'transform,opacity',
                  });
                }

                return gsap.fromTo(
                  self.lines,
                  { y: shiftY, opacity: 0 },
                  {
                    y: 0,
                    opacity: 1,
                    duration: 0.58,
                    delay,
                    stagger,
                    ease: MOTION_CONFIG.eases.primary,
                    scrollTrigger: {
                      trigger: el,
                      start: isDesktop ? 'top 88%' : 'top 92%',
                      toggleActions: 'play none none reverse',
                      fastScrollEnd: true,
                    },
                  }
                );
              },
            });
          } catch {
            // Safe fallback if SplitText fails for any reason
            gsap.fromTo(
              el,
              { y: shiftY, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.55,
                delay,
                ease: MOTION_CONFIG.eases.primary,
                scrollTrigger: triggerOnScroll
                  ? {
                      trigger: el,
                      start: 'top 90%',
                      toggleActions: 'play none none reverse',
                      fastScrollEnd: true,
                    }
                  : undefined,
              }
            );
          }

          return () => {
            splitInstance?.revert();
          };
        }
      );
    },
    { scope: headingRef, dependencies: [children, triggerOnScroll, delay] }
  );

  const Tag = as;
  return (
    <Tag ref={headingRef} className={className}>
      {children}
    </Tag>
  );
}

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Optional CSS selector inside children to stagger items rhythmically (e.g. ".hn-reveal-item") */
  staggerSelector?: string;
  /** Keep visible once revealed (default true for commerce/forms/reviews; false for reversible editorial blocks) */
  once?: boolean;
  /** Vertical entrance travel in px (default 22) */
  y?: number;
  /** Stagger interval in seconds when staggerSelector is provided */
  stagger?: number;
  /** Optional delay in seconds */
  delay?: number;
}

/**
 * Lightweight full-site scroll reveal wrapper powered by GSAP ScrollTrigger:
 * - Smoothly rises & fades sections or staggered child cards into view as the user scrolls.
 * - Defaults to once=true for commerce/forms/info blocks so shopping content stays steady once read.
 * - Supports reversible scroll-up playback when once=false on editorial showcases.
 * - Completely skipped under prefers-reduced-motion.
 */
export function ScrollReveal({
  children,
  className = '',
  staggerSelector,
  once = true,
  y = 22,
  stagger = 0.07,
  delay = 0,
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: MOTION_CONFIG.media.reducedMotion,
          isDesktop: MOTION_CONFIG.media.desktop,
        },
        (context) => {
          const { reduceMotion, isDesktop } = context.conditions || {};
          const el = containerRef.current;
          if (reduceMotion || !el) return;

          const travelY = isDesktop ? y : Math.min(y, 14);
          const targets = staggerSelector
            ? gsap.utils.toArray<HTMLElement>(staggerSelector, el)
            : [el];

          if (targets.length === 0) return;

          // Never hide elements that are already visible in or scrolled past the initial viewport
          const rect = el.getBoundingClientRect();
          if (rect.top <= window.innerHeight * 0.94) {
            gsap.set(targets, { opacity: 1, y: 0, clearProps: 'transform,opacity' });
            return;
          }

          gsap.fromTo(
            targets,
            { opacity: 0, y: travelY },
            {
              opacity: 1,
              y: 0,
              duration: 0.56,
              delay,
              stagger: targets.length > 1 ? stagger : 0,
              ease: MOTION_CONFIG.eases.primary,
              clearProps: 'transform,opacity',
              overwrite: 'auto',
              scrollTrigger: {
                trigger: el,
                start: isDesktop ? 'top 89%' : 'top 93%',
                once,
                toggleActions: once ? 'play none none none' : 'play none none reverse',
                fastScrollEnd: true,
              },
            }
          );
        }
      );
    },
    { scope: containerRef, dependencies: [staggerSelector, once, y, stagger, delay] }
  );

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}

