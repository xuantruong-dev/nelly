import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { MOTION_CONFIG, gsap, prefersReducedMotion, useGSAP } from '../lib/motionConfig.ts';
import { SafeImage } from './SafeImage.tsx';
import { CinematicHeading } from './CinematicScroll.tsx';

export interface ShowcaseCollection {
  slug: string;
  label: string;
  headline: string;
  description: string;
  prepHint: string;
  imageUrl: string;
  ctaPath: string;
  ctaLabel: string;
}

interface CollectionStage3DProps {
  items: ShowcaseCollection[];
}

/**
 * Dedicated 3D occasion collection showcase on the Home page with 3-phase cinematic scroll:
 * 1. Enter: Frame opens via clip-path while 3D perspective straightens to 0deg and inner image eases 1.08 -> 1.
 * 2. Hold: Completely flat & interactive across the reading zone (tabs, prev/next, touch swipe).
 * 3. Exit: Gentle upward recede and fade on desktop after passing the reading zone (reversible on scroll up).
 */
export function CollectionStage3D({ items }: CollectionStage3DProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [displayedIndex, setDisplayedIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const exitLayerRef = useRef<HTMLDivElement>(null);
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const imgScaleRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const bgBlueRef = useRef<HTMLDivElement>(null);
  const bgPinkRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swapTlRef = useRef<gsap.core.Timeline | null>(null);

  const { contextSafe } = useGSAP(
    () => {
      if (items.length === 0) return;
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: MOTION_CONFIG.media.reducedMotion,
          isDesktop: MOTION_CONFIG.media.desktop,
          isMobile: MOTION_CONFIG.media.mobile,
        },
        (context) => {
          const { reduceMotion, isDesktop } = context.conditions || {};
          if (
            reduceMotion ||
            !stageWrapperRef.current ||
            !sectionRef.current ||
            !exitLayerRef.current
          ) {
            return;
          }

          const scrubVal = MOTION_CONFIG.cinematicScroll.scrub;

          // Phase 1 (Enter -> Hold): Frame reveal + 3D tilt-to-flat + inner image 1.08 -> 1
          const enterTl = gsap.timeline({
            scrollTrigger: {
              trigger: sectionRef.current,
              start: isDesktop ? 'top 86%' : 'top 90%',
              end: isDesktop ? 'top 34%' : 'top 52%',
              scrub: scrubVal,
              invalidateOnRefresh: true,
            },
          });

          enterTl.fromTo(
            stageWrapperRef.current,
            {
              rotationY: isDesktop ? -5 : 0,
              rotationX: isDesktop ? 3 : 0,
              z: isDesktop ? -34 : 0,
              y: isDesktop ? 26 : 16,
              opacity: 0.55,
              clipPath: isDesktop
                ? 'inset(6% 2% 6% 2% round 16px)'
                : 'inset(4% 0% 4% 0% round 16px)',
            },
            {
              rotationY: 0,
              rotationX: 0,
              z: 0,
              y: 0,
              opacity: 1,
              clipPath: 'inset(0% 0% 0% 0% round 16px)',
              ease: 'none',
            },
            0
          );

          if (imgScaleRef.current) {
            enterTl.fromTo(
              imgScaleRef.current,
              { scale: isDesktop ? MOTION_CONFIG.cinematicScroll.frameScaleStart : 1.04 },
              { scale: 1, ease: 'none' },
              0
            );
          }

          // Ambient blue & slower delayed pink background layers (gentler than product motion)
          if (bgBlueRef.current) {
            enterTl.fromTo(
              bgBlueRef.current,
              { x: -16, y: 14, opacity: 0.45 },
              { x: 6, y: -6, opacity: 1, ease: 'none' },
              0
            );
          }
          if (bgPinkRef.current) {
            enterTl.fromTo(
              bgPinkRef.current,
              { x: 10, y: 16, opacity: 0.25 },
              { x: -4, y: 0, opacity: 0.85, ease: 'none' },
              0.12
            );
          }

          // Phase 3 (Exit): Gentle upward recede once past reading zone (desktop only, reversible)
          if (isDesktop) {
            gsap.fromTo(
              exitLayerRef.current,
              { y: 0, opacity: 1 },
              {
                y: -22,
                opacity: 0.48,
                ease: 'none',
                immediateRender: false,
                scrollTrigger: {
                  trigger: sectionRef.current,
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
    { scope: sectionRef, dependencies: [items.length] }
  );

  const switchTo = contextSafe((nextIdx: number) => {
    if (items.length === 0) return;
    const normalized = ((nextIdx % items.length) + items.length) % items.length;
    if (normalized === activeIndex) return;

    const direction = normalized > activeIndex ? 1 : -1;
    setActiveIndex(normalized);

    // Kill any in-flight timeline including its scheduled .add() callback so rapid clicks stay accurate
    if (swapTlRef.current) {
      swapTlRef.current.kill();
      swapTlRef.current = null;
    }

    if (prefersReducedMotion() || !cardRef.current || !copyRef.current) {
      setDisplayedIndex(normalized);
      return;
    }

    const half = MOTION_CONFIG.durations.collectionSwitch * 0.4;
    const enterDur = MOTION_CONFIG.durations.collectionSwitch * 0.62;

    const tl = gsap.timeline({
      onComplete: () => {
        swapTlRef.current = null;
      },
    });
    swapTlRef.current = tl;

    tl.to(
      cardRef.current,
      {
        opacity: 0,
        z: -56,
        x: -direction * 20,
        rotationY: -direction * 5,
        scale: 0.96,
        duration: half,
        ease: 'power2.in',
      },
      0
    )
      .to(
        copyRef.current,
        {
          opacity: 0,
          y: 8,
          duration: half * 0.85,
          ease: 'power2.in',
        },
        0
      )
      .add(() => {
        setDisplayedIndex(normalized);
      })
      .fromTo(
        cardRef.current,
        {
          opacity: 0,
          z: -52,
          x: direction * 22,
          rotationY: direction * 5,
          scale: 0.96,
        },
        {
          opacity: 1,
          z: 0,
          x: 0,
          rotationY: 0,
          scale: 1,
          duration: enterDur,
          ease: MOTION_CONFIG.eases.primary,
          clearProps: 'transform,opacity',
        }
      )
      .fromTo(
        copyRef.current,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: enterDur * 0.8,
          ease: MOTION_CONFIG.eases.soft,
          clearProps: 'transform,opacity',
        },
        '<0.08'
      );
  });

  if (items.length === 0) return null;
  const current = items[displayedIndex] || items[0];

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    // Require clear horizontal swipe intent so vertical mobile scrolling never misfires tab swaps
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      switchTo(dx < 0 ? activeIndex + 1 : activeIndex - 1);
    }
  };

  return (
    <section
      ref={sectionRef}
      className="relative bg-[#FDFBF7] border-y border-[#EFECE4] hn-section overflow-x-clip"
    >
      {/* Subtle decorative glows blending smoothly into warm beige #FDFBF7 */}
      <div
        ref={bgBlueRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-10 left-[-8%] w-[520px] h-[520px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(2,151,222,0.08) 0%, rgba(243,237,224,0.6) 48%, rgba(250,246,236,0) 76%)',
        }}
      />
      <div
        ref={bgPinkRef}
        aria-hidden="true"
        className="pointer-events-none absolute bottom-6 right-[-4%] w-[320px] h-[320px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(244,182,200,0.32) 0%, rgba(249,225,232,0.48) 46%, rgba(250,246,236,0) 74%)',
        }}
      />

      <div className="relative z-10 hn-container">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-xl">
            <p className="text-[14px] font-medium text-[#006A9E] mb-1.5">
              Bộ sưu tập theo dịp
            </p>
            <CinematicHeading
              as="h2"
              className="font-serif font-medium text-[28px] sm:text-[36px] text-[#14222E]"
            >
              Chọn đúng không khí cho từng ngày đáng nhớ
            </CinematicHeading>
          </div>

          {/* Interactive Collection Selector Tabs */}
          <div
            role="tablist"
            aria-label="Chọn bộ sưu tập theo dịp"
            className="flex flex-wrap gap-2"
          >
            {items.map((item, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={item.slug}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => switchTo(idx)}
                  className="hn-btn-choice inline-flex items-center justify-center min-h-[44px] px-4.5 py-2.5 text-[14px] font-medium whitespace-nowrap"
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3D Stage Container (exitLayerRef separated from entrance stageWrapperRef and tab-swap cardRef) */}
        <div
          ref={exitLayerRef}
          className="hn-perspective"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div
            ref={stageWrapperRef}
            className="hn-preserve-3d hn-frame-clip bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 sm:p-8 lg:p-10 shadow-[0_24px_48px_-34px_rgba(74,24,41,0.18)]"
          >
            <div className="hn-grid-12 items-center">
              {/* 3D Image Frame */}
              <div className="lg:col-span-6 hn-perspective">
                <div
                  ref={cardRef}
                  className="hn-preserve-3d aspect-[4/5] max-w-[440px] mx-auto rounded-xl overflow-hidden bg-[#F8F5EE] border border-[#EFECE4]"
                >
                  <div ref={imgScaleRef} className="w-full h-full">
                    <SafeImage
                      src={current.imageUrl}
                      alt={current.headline}
                      preset="detail"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Synchronized Copy & Navigation Controls */}
              <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
                <div ref={copyRef} className="space-y-4">
                  <p className="inline-flex items-center gap-2 text-[13px] font-medium text-[#006A9E]">
                    <span className="w-4 h-[2px] bg-[#D83995] rounded-full" aria-hidden="true" />
                    <span>{current.label} · {current.prepHint}</span>
                  </p>
                  <h3 className="font-serif font-medium text-[26px] sm:text-[32px] leading-[1.24] text-[#14222E]">
                    {current.headline}
                  </h3>
                  <p className="text-[16px] text-[#4A5C6B] leading-[1.68] max-w-[48ch]">
                    {current.description}
                  </p>
                  <div className="pt-2">
                    <Link
                      to={current.ctaPath}
                      className="hn-btn-primary inline-flex items-center gap-2 px-6 py-3 text-[15px] font-semibold whitespace-nowrap"
                    >
                      <span>{current.ctaLabel}</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {/* Prev / Next & Progress Indicator */}
                <div className="pt-6 border-t border-[#EFECE4] flex items-center justify-between gap-4">
                  <span className="text-[13px] text-[#4A5C6B] tabular-nums">
                    Bộ sưu tập {activeIndex + 1} / {items.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => switchTo(activeIndex - 1)}
                      className="hn-btn-secondary w-11 h-11 inline-flex items-center justify-center"
                      aria-label="Bộ sưu tập trước"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => switchTo(activeIndex + 1)}
                      className="hn-btn-secondary w-11 h-11 inline-flex items-center justify-center"
                      aria-label="Bộ sưu tập tiếp theo"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
