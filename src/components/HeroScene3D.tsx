import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, BadgeCheck, Gem, Heart, PlayCircle, Truck } from 'lucide-react';
import type { Category } from '../../shared/types.ts';
import { MOTION_CONFIG, SplitText, gsap, useGSAP } from '../lib/motionConfig.ts';
import { useBackgroundVideo } from '../hooks/useBackgroundVideo.ts';
import { SafeImage } from './SafeImage.tsx';

const HERO_BG_VIDEO_DESKTOP_SRC = '/assets/aistudio/hero_bg_desktop.mp4';
const HERO_BG_VIDEO_MOBILE_SRC = '/assets/aistudio/hero_bg_mobile.mp4';
const HERO_BG_VIDEO_FALLBACK_SRC = '/assets/aistudio/hero_bg_web.mp4';
const HERO_BG_VIDEO_POSTER_DESKTOP = '/assets/aistudio/hero_video_poster_opt.webp';
const HERO_BG_VIDEO_POSTER_MOBILE = '/assets/aistudio/hero_video_poster_mobile.webp';

interface HeroScene3DProps {
  title: string;
  subtitle: string;
  primaryImage?: string | null;
  secondaryImage?: string | null;
  categories: Category[];
}

/**
 * Signature cinematic scroll bridge: "Bó hoa mở lối"
 * Connects the opening Hero directly into the 5-Category Product Showcase.
 *
 * Desktop (min-width: 1024px & min-height: 680px, motion allowed):
 * - Single pinned scene (~1 viewport height scroll distance, scrub: 0.38).
 * - 0–20%: Bouquet moves subtly into prominence while foreground/background layers
 *   (ribbon, paper mat, gift card, close-up crop) glide at distinct parallax depths.
 * - 20–60%: Hold - hero photo, copy, and CTAs stay rock-steady for reading & clicking.
 * - 60–85%: Rhythmic exit of foreground card & bouquet + hero copy fade while the
 *   5-Category collection frame opens simultaneously (no empty gap).
 * - 85–100%: Category showcase settles crisp and interactive, then unpins smoothly.
 *
 * Mobile / short viewports / prefers-reduced-motion:
 * - Natural unpinned vertical flow (Beat A stacked above Beat B), full readability,
 *   zero focus traps, and reduced motion amplitude.
 */
export function HeroScene3D({
  title,
  subtitle,
  primaryImage,
  secondaryImage,
  categories,
}: HeroScene3DProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeSlide, setActiveSlide] = useState(0);

  const showcaseSlides = useMemo(() => {
    const extraImg = categories[0]?.image_url || categories[1]?.image_url || primaryImage || '';
    const extraImg2 = categories[2]?.image_url || secondaryImage || primaryImage || '';
    return [
      {
        primary: primaryImage || extraImg,
        secondary: secondaryImage || extraImg2,
        label: 'Mẫu nổi bật 1',
      },
      {
        primary: secondaryImage || extraImg,
        secondary: primaryImage || extraImg2,
        label: 'Mẫu nổi bật 2',
      },
      {
        primary: categories[1]?.image_url || primaryImage || extraImg,
        secondary: categories[3]?.image_url || secondaryImage || extraImg2,
        label: 'Mẫu nổi bật 3',
      },
    ];
  }, [primaryImage, secondaryImage, categories]);

  const currentSlide = showcaseSlides[activeSlide] || showcaseSlides[0];

  const pinStageRef = useRef<HTMLDivElement>(null);
  const beatARef = useRef<HTMLDivElement>(null);
  const beatBRef = useRef<HTMLDivElement>(null);

  const { inView, isMobileViewport, reducedMotion } = useBackgroundVideo(videoRef, beatARef);
  const heroVideoSrc = isMobileViewport ? HERO_BG_VIDEO_MOBILE_SRC : HERO_BG_VIDEO_DESKTOP_SRC;
  const heroPosterSrc = isMobileViewport
    ? HERO_BG_VIDEO_POSTER_MOBILE
    : HERO_BG_VIDEO_POSTER_DESKTOP;

  const heroCopyRef = useRef<HTMLDivElement>(null);
  const uspBlockRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollCueRef = useRef<HTMLDivElement>(null);

  // Separated transform layers so entrance, scroll choreography, and pointer tilt never fight
  const scrollLayerRef = useRef<HTMLDivElement>(null);
  const entranceLayerRef = useRef<HTMLDivElement>(null);
  const tiltStageRef = useRef<HTMLDivElement>(null);

  // Scroll-parallax outer wrappers
  const ribbonScrollRef = useRef<HTMLDivElement>(null);
  const cardScrollRef = useRef<HTMLDivElement>(null);
  const detailScrollRef = useRef<HTMLDivElement>(null);
  const bgBlueRef = useRef<HTMLDivElement>(null);
  const bgPinkRef = useRef<HTMLDivElement>(null);

  // Fine-pointer inner wrappers
  const cardLayerRef = useRef<HTMLDivElement>(null);
  const detailLayerRef = useRef<HTMLDivElement>(null);
  const ribbonLayerRef = useRef<SVGSVGElement>(null);

  // Beat B (Category Showcase) refs
  const beatBHeadRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add(
        {
          reduceMotion: MOTION_CONFIG.media.reducedMotion,
          isDesktopPinned: MOTION_CONFIG.media.desktopPinned,
          isDesktop: MOTION_CONFIG.media.desktop,
          hasFinePointer: MOTION_CONFIG.media.desktopFinePointer,
        },
        (context) => {
          const { reduceMotion, isDesktopPinned, isDesktop, hasFinePointer } =
            context.conditions || {};

          if (reduceMotion) {
            return;
          }

          // 1. Staged cinematic load sequence (never conflicts with scrollLayerRef)
          const introTl = gsap.timeline({
            defaults: { ease: MOTION_CONFIG.eases.primary },
          });

          // Right product visual: scale 0.92 -> 1, x 40 -> 0, opacity 0 -> 1 (~1.25s)
          if (entranceLayerRef.current) {
            introTl.from(
              entranceLayerRef.current,
              {
                opacity: 0,
                x: isDesktop ? 42 : 0,
                y: isDesktop ? 10 : 20,
                scale: 0.92,
                duration: 1.25,
                ease: 'power3.out',
                clearProps: 'opacity,transform',
              },
              0.12
            );
          }

          // Secondary card enters ~0.15s after main visual
          if (detailLayerRef.current) {
            introTl.from(
              detailLayerRef.current,
              {
                opacity: 0,
                x: isDesktop ? 24 : 12,
                y: 16,
                duration: 0.95,
                ease: 'power3.out',
                clearProps: 'opacity,transform',
              },
              0.27
            );
          }

          // 0.20s - 0.80s: Badge fade + slide up
          introTl.from(
            '.hn-hero-badge',
            {
              y: 16,
              opacity: 0,
              duration: 0.6,
              clearProps: 'transform,opacity',
            },
            0.2
          );

          // 0.35s - 1.10s: Vietnamese diacritic-safe SplitText headline line reveal
          let splitInstance: SplitText | null = null;
          let hasAnimatedTitle = false;
          if (titleRef.current) {
            try {
              splitInstance = SplitText.create(titleRef.current, {
                type: 'lines',
                autoSplit: true,
                mask: 'lines',
                aria: 'auto',
                linesClass: 'hn-split-line-item',
                onSplit(self) {
                  self.masks?.forEach((m) => m.classList.add('hn-split-line-mask'));
                  if (hasAnimatedTitle) {
                    gsap.set(self.lines, { clearProps: 'transform,opacity' });
                    return;
                  }
                  hasAnimatedTitle = true;
                  return gsap.from(self.lines, {
                    y: isDesktop ? 34 : 20,
                    opacity: 0,
                    duration: 0.72,
                    delay: 0.35,
                    stagger: MOTION_CONFIG.cinematicScroll.headlineLineStagger,
                    ease: MOTION_CONFIG.eases.primary,
                    clearProps: 'transform,opacity',
                  });
                },
              });
            } catch {
              introTl.from(
                titleRef.current,
                {
                  y: 22,
                  opacity: 0,
                  duration: 0.7,
                  clearProps: 'transform,opacity',
                },
                0.35
              );
            }
          }

          // 0.60s - 1.20s: Description fade in
          introTl.from(
            '.hn-hero-desc',
            {
              y: 14,
              opacity: 0,
              duration: 0.6,
              clearProps: 'transform,opacity',
            },
            0.6
          );

          // 0.80s - 1.35s: CTA buttons appear
          introTl.from(
            '.hn-hero-cta',
            {
              y: 14,
              opacity: 0,
              duration: 0.55,
              clearProps: 'transform,opacity',
            },
            0.8
          );

          // 0.90s - 1.50s: 4 USP cards stagger in
          introTl.from(
            '.hn-hero-usp-item',
            {
              y: 16,
              opacity: 0,
              duration: 0.55,
              stagger: 0.08,
              clearProps: 'transform,opacity',
            },
            0.9
          );

          // 2. Signature Master Scroll Scene: "Bó hoa mở lối"
          const hasCategories = categories.length > 0;
          if (
            isDesktopPinned &&
            hasCategories &&
            pinStageRef.current &&
            beatARef.current &&
            beatBRef.current &&
            scrollLayerRef.current &&
            heroCopyRef.current
          ) {
            const pinStage = pinStageRef.current;
            const beatA = beatARef.current;
            const beatB = beatBRef.current;

            // Convert stacked fallback into overlaid pinned stage ONLY inside matchMedia
            // (GSAP automatically reverts all inline styles if viewport shrinks or unmounts)
            gsap.set(pinStage, {
              position: 'relative',
              height: '100vh',
              minHeight: '680px',
              maxHeight: '920px',
              overflow: 'hidden',
            });
            gsap.set(beatA, {
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              zIndex: 2,
              pointerEvents: 'auto',
            });
            gsap.set(beatB, {
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              zIndex: 1,
              autoAlpha: 0,
              pointerEvents: 'none',
              borderTopWidth: 0,
            });

            const catFrames = gsap.utils.toArray<HTMLElement>('.hn-cat-frame', beatB);
            const catImages = gsap.utils.toArray<HTMLElement>('.hn-cat-img-scale', beatB);

            const masterTl = gsap.timeline({
              defaults: { ease: 'none' },
              scrollTrigger: {
                trigger: pinStage,
                start: 'top top',
                end: MOTION_CONFIG.cinematicScroll.heroPinDistance,
                pin: true,
                scrub: MOTION_CONFIG.cinematicScroll.scrub,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                onUpdate: (self) => {
                  const showB = self.progress >= 0.72;
                  beatA.style.pointerEvents = showB ? 'none' : 'auto';
                  beatA.style.zIndex = showB ? '1' : '2';
                  beatB.style.pointerEvents = showB ? 'auto' : 'none';
                  beatB.style.zIndex = showB ? '2' : '1';
                },
              },
            });

            // Establish normalized 0 -> 1 progress span
            masterTl.set({}, {}, 1);

            // Subtle background video scale 1 -> 1.04 while scrolling through Hero
            if (videoRef.current) {
              masterTl.fromTo(
                videoRef.current,
                { scale: 1 },
                { scale: 1.04, duration: 0.8 },
                0
              );
            }

            // --- Phase 1 (0.00 -> 0.20): Bouquet rises into prominence & layered 3D parallax ---
            masterTl.fromTo(
              scrollLayerRef.current,
              { y: 12, scale: 0.985, rotationX: 2.5, rotationY: -2.0, z: -12 },
              { y: 0, scale: 1.02, rotationX: 0, rotationY: 0, z: 0, duration: 0.2 },
              0
            );
            if (ribbonScrollRef.current) {
              masterTl.fromTo(
                ribbonScrollRef.current,
                { x: 10, y: 10 },
                { x: -4, y: -6, duration: 0.2 },
                0
              );
            }
            if (cardScrollRef.current) {
              masterTl.fromTo(
                cardScrollRef.current,
                { y: 18, x: 8 },
                { y: -8, x: -2, duration: 0.2 },
                0
              );
            }
            if (detailScrollRef.current) {
              masterTl.fromTo(
                detailScrollRef.current,
                { y: 24, x: 10 },
                { y: -10, x: -2, duration: 0.2 },
                0
              );
            }
            if (scrollCueRef.current) {
              masterTl.to(scrollCueRef.current, { autoAlpha: 0, y: 6, duration: 0.14 }, 0.04);
            }

            // Ambient decorative blue & delayed pink background washes (lighter movement than bouquet)
            if (bgBlueRef.current) {
              masterTl.fromTo(
                bgBlueRef.current,
                { x: 10, y: 8, scale: 0.96, opacity: 0.85 },
                { x: -10, y: -12, scale: 1.04, opacity: 1, duration: 0.6 },
                0
              );
            }
            if (bgPinkRef.current) {
              masterTl.fromTo(
                bgPinkRef.current,
                { x: -6, y: 12, scale: 0.94, opacity: 0.68 },
                { x: 8, y: -4, scale: 1.02, opacity: 0.95, duration: 0.54 },
                0.06
              );
            }

            // --- Phase 2 (0.20 -> 0.60): Hold - image & text stay rock-steady for reading/clicks ---
            if (ribbonScrollRef.current) {
              masterTl.to(ribbonScrollRef.current, { x: -16, y: -12, duration: 0.4 }, 0.2);
            }

            // --- Phase 3 (0.60 -> 0.85): Rhythmic Exit of Hero + Simultaneous Reveal of Categories ---
            if (cardScrollRef.current) {
              masterTl.to(
                cardScrollRef.current,
                { y: -46, x: 14, autoAlpha: 0, duration: 0.16 },
                0.6
              );
            }
            if (detailScrollRef.current) {
              masterTl.to(
                detailScrollRef.current,
                { y: -56, x: 18, autoAlpha: 0, duration: 0.17 },
                0.61
              );
            }
            if (ribbonScrollRef.current) {
              masterTl.to(
                ribbonScrollRef.current,
                { x: -42, y: -28, autoAlpha: 0, duration: 0.18 },
                0.62
              );
            }
            masterTl.to(
              heroCopyRef.current,
              { y: -28, autoAlpha: 0, duration: 0.18 },
              0.62
            );
            if (uspBlockRef.current) {
              masterTl.to(
                uspBlockRef.current,
                { y: -24, autoAlpha: 0, duration: 0.18 },
                0.63
              );
            }
            masterTl.to(
              scrollLayerRef.current,
              {
                y: -44,
                z: -80,
                scale: 0.92,
                rotationX: 4.5,
                rotationY: -2.5,
                autoAlpha: 0,
                duration: 0.22,
              },
              0.62
            );
            if (bgBlueRef.current) {
              masterTl.to(bgBlueRef.current, { y: -18, autoAlpha: 0, duration: 0.18 }, 0.62);
            }
            if (bgPinkRef.current) {
              masterTl.to(bgPinkRef.current, { y: -12, autoAlpha: 0, duration: 0.18 }, 0.65);
            }
            masterTl.to(beatA, { autoAlpha: 0, duration: 0.04 }, 0.81);

            // Incoming Beat B overlaps smoothly from 0.66 -> 0.86 (never leaves an empty screen)
            masterTl.to(beatB, { autoAlpha: 1, duration: 0.12 }, 0.66);

            if (beatBHeadRef.current) {
              masterTl.fromTo(
                beatBHeadRef.current,
                { y: 26, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.16 },
                0.68
              );
            }
            if (catFrames.length > 0) {
              masterTl.fromTo(
                catFrames,
                {
                  clipPath: 'inset(12% 4% 12% 4% round 12px)',
                  y: 26,
                  opacity: 0.2,
                },
                {
                  clipPath: 'inset(0% 0% 0% 0% round 12px)',
                  y: 0,
                  opacity: 1,
                  duration: 0.17,
                  stagger: 0.022,
                },
                0.68
              );
            }
            if (catImages.length > 0) {
              masterTl.fromTo(
                catImages,
                { scale: MOTION_CONFIG.cinematicScroll.frameScaleStart },
                {
                  scale: 1,
                  duration: 0.19,
                  stagger: 0.022,
                },
                0.68
              );
            }
            // Phase 4 (0.86 -> 1.00): Hold Beat B completely settled & interactive before unpin
          } else if (hasCategories && beatBRef.current) {
            // Mobile & short-screen graceful unpinned reveal for Beat B categories
            const catFrames = gsap.utils.toArray<HTMLElement>('.hn-cat-frame', beatBRef.current);
            const catImages = gsap.utils.toArray<HTMLElement>('.hn-cat-img-scale', beatBRef.current);
            if (catFrames.length > 0) {
              gsap.fromTo(
                catFrames,
                { y: 18, opacity: 0.35 },
                {
                  y: 0,
                  opacity: 1,
                  duration: 0.55,
                  stagger: 0.06,
                  ease: MOTION_CONFIG.eases.primary,
                  scrollTrigger: {
                    trigger: beatBRef.current,
                    start: 'top 86%',
                    toggleActions: 'play none none reverse',
                    fastScrollEnd: true,
                  },
                }
              );
            }
            if (catImages.length > 0) {
              gsap.fromTo(
                catImages,
                { scale: 1.05 },
                {
                  scale: 1,
                  duration: 0.65,
                  stagger: 0.06,
                  ease: MOTION_CONFIG.eases.soft,
                  scrollTrigger: {
                    trigger: beatBRef.current,
                    start: 'top 86%',
                    toggleActions: 'play none none reverse',
                    fastScrollEnd: true,
                  },
                }
              );
            }
          }

          // 3. Subtle fine-pointer 3D tilt on desktop mice only (isolated inner refs)
          if (hasFinePointer && tiltStageRef.current && scrollLayerRef.current) {
            const stage = tiltStageRef.current;
            const zone = scrollLayerRef.current;

            const rotXTo = gsap.quickTo(stage, 'rotationX', {
              duration: 0.5,
              ease: MOTION_CONFIG.eases.soft,
            });
            const rotYTo = gsap.quickTo(stage, 'rotationY', {
              duration: 0.5,
              ease: MOTION_CONFIG.eases.soft,
            });
            const cardXTo = cardLayerRef.current
              ? gsap.quickTo(cardLayerRef.current, 'x', {
                  duration: 0.55,
                  ease: MOTION_CONFIG.eases.soft,
                })
              : null;
            const cardYTo = cardLayerRef.current
              ? gsap.quickTo(cardLayerRef.current, 'y', {
                  duration: 0.55,
                  ease: MOTION_CONFIG.eases.soft,
                })
              : null;
            const detailXTo = detailLayerRef.current
              ? gsap.quickTo(detailLayerRef.current, 'x', {
                  duration: 0.6,
                  ease: MOTION_CONFIG.eases.soft,
                })
              : null;
            const detailYTo = detailLayerRef.current
              ? gsap.quickTo(detailLayerRef.current, 'y', {
                  duration: 0.6,
                  ease: MOTION_CONFIG.eases.soft,
                })
              : null;
            const ribbonXTo = ribbonLayerRef.current
              ? gsap.quickTo(ribbonLayerRef.current, 'x', {
                  duration: 0.7,
                  ease: MOTION_CONFIG.eases.soft,
                })
              : null;

            const maxTilt = MOTION_CONFIG.depth3D.heroMaxTiltDeg;
            const shift = MOTION_CONFIG.depth3D.heroParallaxPx;
            let cachedRect: DOMRect | null = null;

            const invalidateRect = () => {
              cachedRect = null;
            };

            const onPointerEnter = () => {
              cachedRect = zone.getBoundingClientRect();
            };

            const onPointerMove = (e: PointerEvent) => {
              const rect = cachedRect || (cachedRect = zone.getBoundingClientRect());
              if (!rect.width || !rect.height) return;
              const nx = (e.clientX - rect.left) / rect.width - 0.5;
              const ny = (e.clientY - rect.top) / rect.height - 0.5;

              rotYTo(nx * maxTilt * 2);
              rotXTo(-ny * maxTilt * 2);
              cardXTo?.(nx * shift * 1.1);
              cardYTo?.(ny * shift * 0.85);
              detailXTo?.(nx * shift * 1.25);
              detailYTo?.(ny * shift * 1.0);
              ribbonXTo?.(-nx * shift * 0.65);
            };

            const onPointerLeave = () => {
              cachedRect = null;
              rotXTo(0);
              rotYTo(0);
              cardXTo?.(0);
              cardYTo?.(0);
              detailXTo?.(0);
              detailYTo?.(0);
              ribbonXTo?.(0);
            };

            zone.addEventListener('pointerenter', onPointerEnter);
            zone.addEventListener('pointermove', onPointerMove);
            zone.addEventListener('pointerleave', onPointerLeave);
            window.addEventListener('resize', invalidateRect, { passive: true });
            window.addEventListener('scroll', invalidateRect, { passive: true });

            return () => {
              zone.removeEventListener('pointerenter', onPointerEnter);
              zone.removeEventListener('pointermove', onPointerMove);
              zone.removeEventListener('pointerleave', onPointerLeave);
              window.removeEventListener('resize', invalidateRect);
              window.removeEventListener('scroll', invalidateRect);
              splitInstance?.revert();
            };
          }

          return () => {
            splitInstance?.revert();
          };
        }
      );
    },
    { scope: sectionRef, dependencies: [title, categories.length] }
  );

  return (
    <section
      ref={sectionRef}
      className="hero relative -mt-[64px] sm:-mt-[74px] bg-[#FDFBF7] overflow-x-clip"
    >
      <div ref={pinStageRef} className="relative">
        {/* Beat A: Opening 5-Layer Luxury Pastel Hero - EXISTING LOOPING VIDEO BACKGROUND ONLY HERE */}
        <div
          ref={beatARef}
          className={`relative w-full border-b border-[#EFECE4] overflow-hidden bg-[#FCEFF4] pt-[70px] sm:pt-[80px] lg:pt-[82px] ${
            !inView ? 'hn-motion-paused' : ''
          }`}
        >
          {/* LAYER 1: RESPONSIVE H.264 FASTSTART VIDEO BACKGROUND (mobile 432p / desktop 720p + WebP poster) */}
          <video
            key={heroVideoSrc}
            ref={videoRef}
            poster={heroPosterSrc}
            autoPlay={!reducedMotion}
            loop
            muted
            playsInline
            preload={reducedMotion ? 'none' : 'metadata'}
            aria-hidden="true"
            className="hero-video absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
          >
            <source src={heroVideoSrc} type="video/mp4" />
            <source src={HERO_BG_VIDEO_FALLBACK_SRC} type="video/mp4" />
          </video>

          {/* LAYER 2: LIGHT BRAND COLOR / GRADIENT OVERLAY (White + Baby Blue + Blush Pink) */}
          <div
            aria-hidden="true"
            className="hero-overlay absolute inset-0 pointer-events-none z-[1]"
            style={{
              background:
                'linear-gradient(90deg, rgba(255,255,255,0.52) 0%, rgba(255,245,249,0.32) 38%, rgba(220,240,255,0.15) 70%, rgba(255,255,255,0.05) 100%)',
            }}
          />
          {/* Soft white radial readability glow behind left headline - zero hard white box */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none z-[1]"
            style={{
              background:
                'radial-gradient(circle at 22% 48%, rgba(255,255,255,0.56) 0%, rgba(255,250,253,0.34) 36%, rgba(255,255,255,0.10) 64%, transparent 100%)',
            }}
          />

          {/* LAYER 3: SUBTLE FOREGROUND DECORATIVE RIBBONS & LIGHT TRAILS (reduced on mobile) */}
          <div
            aria-hidden="true"
            className="hero-decoration hidden sm:block absolute inset-0 pointer-events-none z-[2] overflow-hidden"
          >
            {/* Upper-left soft pink satin corner ribbon */}
            <svg
              viewBox="0 0 180 180"
              fill="none"
              className="absolute top-0 left-0 w-36 h-36 opacity-80"
            >
              <defs>
                <linearGradient id="hnCornerPink" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#F59EC2" stopOpacity="0.9" />
                  <stop offset="55%" stopColor="#FFDCEB" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#F59EC2" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M-12 138C36 96 86 42 126 -10"
                stroke="url(#hnCornerPink)"
                strokeWidth="22"
                strokeLinecap="round"
              />
            </svg>

            {/* Right-side delicate baby-blue light trail swoop */}
            <svg
              viewBox="0 0 420 260"
              fill="none"
              className="absolute top-12 right-0 w-[340px] lg:w-[440px] h-52 opacity-70"
            >
              <defs>
                <linearGradient id="hnBabyBlueTrail" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.85" />
                  <stop offset="48%" stopColor="#B8E1FF" stopOpacity="0.58" />
                  <stop offset="100%" stopColor="#8CCEFF" stopOpacity="0.1" />
                </linearGradient>
              </defs>
              <path
                d="M24 140C140 52 276 22 418 46"
                stroke="url(#hnBabyBlueTrail)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M84 186C190 108 308 76 418 92"
                stroke="url(#hnBabyBlueTrail)"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>

            {/* 2 unmodified flying butterflies in the far-left open meadow/sky margin (wide desktop) */}
            <div className="hidden min-[1480px]:block hn-butterfly-flight hn-butterfly-interactive select-none absolute top-[28%] left-[1%] 2xl:left-[3%] w-[158px] 2xl:w-[196px]">
              <div className="-rotate-[8deg]">
                <picture>
                  <source srcSet="/assets/aistudio/butterfly_web.webp" type="image/webp" />
                  <img
                    src="/assets/aistudio/image_24ff80ce.png"
                    alt=""
                    width={1671}
                    height={941}
                    decoding="async"
                    draggable={false}
                    className="block w-full h-auto object-contain hn-butterfly-wingbeat-slow"
                  />
                </picture>
              </div>
            </div>

            <div
              className="hidden min-[1480px]:block hn-butterfly-flight-alt hn-butterfly-interactive select-none absolute top-[54%] left-[3.5%] 2xl:left-[5.5%] w-[124px] 2xl:w-[150px]"
              style={{ animationDelay: '-2.4s' }}
            >
              <div className="-scale-x-100 rotate-[12deg]">
                <picture>
                  <source srcSet="/assets/aistudio/butterfly_web.webp" type="image/webp" />
                  <img
                    src="/assets/aistudio/image_24ff80ce.png"
                    alt=""
                    width={1671}
                    height={941}
                    decoding="async"
                    draggable={false}
                    className="block w-full h-auto object-contain hn-butterfly-wingbeat"
                    style={{ animationDelay: '-0.6s' }}
                  />
                </picture>
              </div>
            </div>
          </div>

          {/* LAYER 4 & LAYER 5: HERO CONTENT (Desktop 45% Copy / 55% Visual; Mobile Badge->Headline->Desc->CTA->Visual->USP) */}
          <div className="hero-content relative z-10 hn-container lg:max-w-[1396px] lg:px-5 xl:px-8 pt-4 pb-12 sm:pt-6 sm:pb-12 lg:py-5">
            {/* 1 unmodified flying butterfly in the center sky pocket between left copy & right 3D arch */}
            <div
              aria-hidden="true"
              className="hidden lg:block hn-butterfly-flight-glide hn-butterfly-interactive select-none absolute top-[32%] left-[39.5%] xl:top-[30%] xl:left-[40.5%] w-[158px] xl:w-[192px] z-20"
              style={{ animationDelay: '-1.2s' }}
            >
              <div className="-rotate-[6deg]">
                <picture>
                  <source srcSet="/assets/aistudio/butterfly_web.webp" type="image/webp" />
                  <img
                    src="/assets/aistudio/image_24ff80ce.png"
                    alt=""
                    width={1671}
                    height={941}
                    decoding="async"
                    draggable={false}
                    className="block w-full h-auto object-contain hn-butterfly-wingbeat"
                    style={{ animationDelay: '-0.3s' }}
                  />
                </picture>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] gap-y-6 lg:gap-y-5 lg:gap-x-10 xl:gap-x-12 items-center">
              {/* LAYER 5A: LEFT COPY + CTAs (45% width on desktop) */}
              <div
                ref={heroCopyRef}
                className="hero-copy lg:col-start-1 lg:row-start-1 flex flex-col justify-center lg:self-end text-left"
              >
                <p className="hn-hero-badge inline-flex items-center self-start px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FFE5F1]/92 via-[#FFF6FA]/92 to-white/85 backdrop-blur-md border border-white/95 text-[13px] font-medium text-[#5E1738] shadow-[0_6px_16px_-10px_rgba(214,36,110,0.24)] mb-3.5">
                  <span>Hoa bóng bay nghệ thuật</span>
                </p>

                <div className="relative inline-block">
                  <h1
                    ref={titleRef}
                    className="font-serif italic font-bold text-[clamp(2.15rem,3.8vw,3.5rem)] leading-[1.12] tracking-[-0.02em] text-[#C91D64] drop-shadow-[0_2px_14px_rgba(255,255,255,0.82)] max-w-[14ch]"
                  >
                    {title}
                  </h1>
                  {/* Delicate rose-pink line-art heart flourish near headline */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 72 64"
                    fill="none"
                    className="hidden sm:block pointer-events-none absolute -top-2 right-0 lg:-right-1 w-11 h-10 text-[#E23D7E] drop-shadow-[0_2px_8px_rgba(255,255,255,0.75)]"
                  >
                    <path
                      d="M12 48C24 42 38 35 48 22C55 13 52 4 43 5C35 6 31 14 30 20C28 12 22 8 16 13C10 18 14 31 27 38C36 42 48 44 60 41"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Graceful curved pink underline swoosh */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 340 22"
                  fill="none"
                  className="hn-hero-desc w-48 sm:w-64 h-3.5 mt-1.5 drop-shadow-[0_2px_6px_rgba(255,255,255,0.65)]"
                >
                  <defs>
                    <linearGradient id="hnTitleSwoosh" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#DC2872" />
                      <stop offset="65%" stopColor="#EE6BA1" />
                      <stop offset="100%" stopColor="#F9BBD4" stopOpacity="0.35" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M4 16C78 2 168 18 258 9C288 6 312 6 334 8"
                    stroke="url(#hnTitleSwoosh)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                  />
                </svg>

                <p className="hn-hero-desc mt-3 text-[16px] sm:text-[16.5px] font-medium text-[#2E1824] drop-shadow-[0_1px_8px_rgba(255,255,255,0.8)] leading-[1.65] max-w-[42ch]">
                  {subtitle}
                </p>

                <div className="hn-hero-cta mt-5 flex flex-col min-[420px]:flex-row min-[420px]:flex-wrap items-stretch min-[420px]:items-center gap-3">
                  <Link
                    to="/san-pham"
                    className="group inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-3 rounded-full bg-gradient-to-r from-[#E4337B] via-[#DC2871] to-[#CB1B63] hover:from-[#EB4287] hover:to-[#D5246C] text-white text-[15px] font-semibold whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-6px_rgba(214,36,110,0.62)] shadow-[0_12px_26px_-8px_rgba(214,36,110,0.52)]"
                  >
                    <span>Xem mẫu hoa</span>
                    <ArrowRight
                      className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                  <Link
                    to="/dat-thiet-ke-rieng"
                    className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-full bg-white/84 backdrop-blur-md hover:bg-white text-[#6A1B3E] border border-[#E69AB8] text-[14.5px] font-medium whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 shadow-[0_8px_18px_-12px_rgba(214,36,110,0.22)]"
                  >
                    <PlayCircle className="w-4 h-4 text-[#D92670]" aria-hidden="true" />
                    <span>Ý tưởng &amp; cảm hứng</span>
                  </Link>
                </div>
              </div>

              {/* LAYER 4: RIGHT 3D PRODUCT VISUAL STAGE (55% width on desktop, spans both left rows) */}
              <div className="hero-product lg:col-start-2 lg:row-start-1 lg:row-span-2 hn-perspective relative">
                {/* Outer wrapper handles scroll choreography only */}
                <div ref={scrollLayerRef} className="relative py-1">
                  {/* Middle wrapper handles one-shot mount entrance only */}
                  <div ref={entranceLayerRef}>
                    {/* Inner preserve-3d stage handles desktop fine-pointer parallax tilt only */}
                    <div
                      ref={tiltStageRef}
                      className="relative hn-preserve-3d mx-auto lg:ml-auto lg:mr-8 xl:mr-[70px] max-w-[460px] sm:max-w-[520px] pt-1 pb-11 sm:pb-12"
                    >
                      {/* Background soft pastel-pink ribbon curving behind left edge of the dome */}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 220 120"
                        fill="none"
                        className="hidden sm:block pointer-events-none absolute top-[44%] -left-8 w-44 h-24 z-0 opacity-90 drop-shadow-[0_6px_14px_rgba(214,36,110,0.2)]"
                        style={{ transform: 'translateZ(2px)' }}
                      >
                        <defs>
                          <linearGradient id="hnRibbonBack" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#F48FB6" stopOpacity="0.92" />
                            <stop offset="55%" stopColor="#FFD3E6" stopOpacity="0.88" />
                            <stop offset="100%" stopColor="#F7A7C8" stopOpacity="0.25" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M6 88C46 52 96 42 152 54C178 60 198 64 214 58"
                          stroke="url(#hnRibbonBack)"
                          strokeWidth="15"
                          strokeLinecap="round"
                        />
                      </svg>

                      {/* Floating Iridescent Bubbles + Translucent Butterfly + Sparkles (desktop parallax layer) */}
                      <div
                        ref={cardScrollRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-30"
                        style={{ transform: 'translateZ(36px)' }}
                      >
                        <div ref={cardLayerRef} className="relative w-full h-full">
                          {/* Original butterfly artwork placed above the existing hero butterfly (unmodified asset, flying) */}
                          <div className="hn-butterfly-flight-alt hn-butterfly-interactive select-none absolute -top-4 right-0 w-[104px] sm:-top-[26px] sm:right-[14px] sm:w-[152px] lg:-top-[28px] lg:right-[18px] lg:w-[162px]">
                            <picture>
                              <source srcSet="/assets/aistudio/butterfly_web.webp" type="image/webp" />
                              <img
                                src="/assets/aistudio/image_24ff80ce.png"
                                alt=""
                                aria-hidden="true"
                                width={1671}
                                height={941}
                                decoding="async"
                                draggable={false}
                                className="block w-full h-auto object-contain hn-butterfly-wingbeat"
                              />
                            </picture>
                          </div>

                          {/* Translucent glowing pink-lavender-blue butterfly */}
                          <svg
                            viewBox="0 0 110 100"
                            fill="none"
                            className="hidden sm:block hn-butterfly-flutter hn-butterfly-interactive absolute top-4 right-5 w-20 h-20 drop-shadow-[0_0_16px_rgba(255,230,242,0.85)]"
                          >
                            <defs>
                              <linearGradient id="hnWingTop" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
                                <stop offset="45%" stopColor="#FFD2E7" stopOpacity="0.78" />
                                <stop offset="100%" stopColor="#B8E0FF" stopOpacity="0.62" />
                              </linearGradient>
                              <linearGradient id="hnWingBottom" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#FFF0F7" stopOpacity="0.86" />
                                <stop offset="100%" stopColor="#E99AC2" stopOpacity="0.58" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M54 50C44 26 22 10 12 20C3 30 16 54 48 56Z"
                              fill="url(#hnWingTop)"
                              stroke="rgba(255,255,255,0.92)"
                              strokeWidth="1.2"
                            />
                            <path
                              d="M56 50C70 28 92 14 99 25C105 36 86 58 60 56Z"
                              fill="url(#hnWingTop)"
                              stroke="rgba(255,255,255,0.92)"
                              strokeWidth="1.2"
                            />
                            <path
                              d="M52 56C34 58 20 74 28 84C36 92 52 80 54 62Z"
                              fill="url(#hnWingBottom)"
                              stroke="rgba(255,255,255,0.84)"
                              strokeWidth="1.1"
                            />
                            <path
                              d="M58 56C74 60 84 78 74 86C65 92 55 78 56 62Z"
                              fill="url(#hnWingBottom)"
                              stroke="rgba(255,255,255,0.84)"
                              strokeWidth="1.1"
                            />
                            <path
                              d="M55 44V66M55 44C52 36 47 31 44 29M55 44C58 36 63 31 66 29"
                              stroke="rgba(255,255,255,0.95)"
                              strokeWidth="1.6"
                              strokeLinecap="round"
                            />
                          </svg>

                          {/* Top-right iridescent soap bubble */}
                          <span
                            className="hidden sm:block hn-float-bubble-delayed absolute top-2 -right-1 w-9 h-9 rounded-full border border-white/85 shadow-[inset_0_2px_10px_rgba(255,255,255,0.95),0_8px_18px_rgba(120,60,110,0.2)]"
                            style={{
                              background:
                                'radial-gradient(circle at 28% 26%, rgba(255,255,255,0.92) 0%, rgba(191,232,255,0.42) 44%, rgba(244,182,208,0.4) 78%, rgba(255,255,255,0.65) 100%)',
                            }}
                          />
                          {/* Lower-left large iridescent soap bubble beside the glass arch */}
                          <span
                            className="hidden sm:block hn-float-bubble absolute bottom-28 left-2 sm:left-4 w-11 h-11 rounded-full border border-white/90 shadow-[inset_0_3px_12px_rgba(255,255,255,0.96),0_10px_24px_rgba(130,50,100,0.22)]"
                            style={{
                              background:
                                'radial-gradient(circle at 30% 26%, rgba(255,255,255,0.95) 0%, rgba(255,204,229,0.42) 46%, rgba(173,222,255,0.4) 80%, rgba(255,255,255,0.72) 100%)',
                            }}
                          />
                          {/* Soft pink petal near lower-left */}
                          <svg
                            viewBox="0 0 46 32"
                            fill="none"
                            className="hidden sm:block absolute bottom-9 left-10 w-9 h-6 drop-shadow-[0_6px_12px_rgba(214,36,110,0.24)]"
                          >
                            <path
                              d="M6 22C12 8 30 4 42 12C38 25 22 30 6 22Z"
                              fill="url(#hnTitleSwoosh)"
                              fillOpacity="0.86"
                            />
                          </svg>
                        </div>
                      </div>

                      {/* Refined Circular Pearl-Champagne Pedestal (proportional, not oversized) */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-5 left-[44%] -translate-x-1/2 w-[82%] sm:w-[74%] z-0"
                        style={{ transform: 'translateZ(4px)' }}
                      >
                        <div className="absolute -inset-x-5 -bottom-3 h-10 rounded-[100%] bg-[#FFF4F9]/45 blur-md" />
                        <div className="relative z-10 h-8 sm:h-9 rounded-[100%] bg-gradient-to-b from-white via-[#FFF9FC] to-[#ECE2EF] border-2 border-white shadow-[inset_0_2px_10px_rgba(255,255,255,0.98),0_4px_12px_rgba(88,36,72,0.16)]" />
                        <div className="-mt-4 sm:-mt-4.5 h-10 sm:h-11 rounded-b-[100%] bg-gradient-to-r from-[#DCD2E3] via-[#FFFFFF] via-44% to-[#D9C8DF] border-x border-b border-white/90 shadow-[0_20px_36px_-10px_rgba(32,12,28,0.48)] relative overflow-hidden">
                          <div className="absolute inset-x-4 top-[42%] h-[1.5px] bg-white/90" />
                          <div className="absolute inset-x-8 top-[66%] h-px bg-[#E6C596]/55" />
                        </div>
                      </div>

                      {/* Delicate 5-Petal Pink-and-Cream Blossom resting on left rim of Pedestal */}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 80 56"
                        fill="none"
                        className="hidden sm:block pointer-events-none absolute bottom-11 left-9 sm:left-12 w-15 h-11 z-20 drop-shadow-[0_6px_12px_rgba(120,30,72,0.24)]"
                        style={{ transform: 'translateZ(26px)' }}
                      >
                        <defs>
                          <radialGradient id="hnPetalGrad" cx="45%" cy="35%" r="65%">
                            <stop offset="0%" stopColor="#FFFFFF" />
                            <stop offset="55%" stopColor="#FFD2E4" />
                            <stop offset="100%" stopColor="#F29BC0" />
                          </radialGradient>
                        </defs>
                        <ellipse cx="24" cy="30" rx="14" ry="9" transform="rotate(-18 24 30)" fill="url(#hnPetalGrad)" />
                        <ellipse cx="38" cy="20" rx="13" ry="9" transform="rotate(6 38 20)" fill="url(#hnPetalGrad)" />
                        <ellipse cx="56" cy="27" rx="14" ry="9" transform="rotate(20 56 27)" fill="url(#hnPetalGrad)" />
                        <ellipse cx="48" cy="39" rx="14" ry="8" transform="rotate(-10 48 39)" fill="url(#hnPetalGrad)" />
                        <ellipse cx="30" cy="40" rx="13" ry="8" transform="rotate(14 30 40)" fill="url(#hnPetalGrad)" />
                        <circle cx="40" cy="31" r="5" fill="#F6C461" />
                        <circle cx="40" cy="31" r="2.2" fill="#FFF8DD" />
                      </svg>

                      {/* Silky Rose-Pink Satin Ribbon sweeping around front-right of pedestal */}
                      <div
                        ref={ribbonScrollRef}
                        aria-hidden="true"
                        className="pointer-events-none absolute bottom-0 -inset-x-3 sm:-inset-x-6 z-20"
                        style={{ transform: 'translateZ(28px)' }}
                      >
                        <svg
                          ref={ribbonLayerRef}
                          viewBox="0 0 560 175"
                          fill="none"
                          className="w-full h-28 sm:h-36 drop-shadow-[0_12px_20px_rgba(160,36,92,0.3)]"
                        >
                          <defs>
                            <linearGradient id="hnSatinRibbon" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" stopColor="#F89EC2" stopOpacity="0.94" />
                              <stop offset="35%" stopColor="#FFE1EE" stopOpacity="0.98" />
                              <stop offset="68%" stopColor="#E76A9C" stopOpacity="0.95" />
                              <stop offset="100%" stopColor="#FBB8D4" stopOpacity="0.9" />
                            </linearGradient>
                          </defs>
                          <path
                            d="M170 146C248 112 318 156 404 138C466 125 512 90 548 48"
                            stroke="url(#hnSatinRibbon)"
                            strokeWidth="14"
                            strokeLinecap="round"
                          />
                          <path
                            d="M178 143C252 112 320 153 404 135C464 123 508 89 542 50"
                            stroke="rgba(255,255,255,0.72)"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>

                      {/* Image 1: Primary Bouquet inside Luminous Glass Arch Dome (z = 16px) */}
                      <div
                        className="relative z-10 ml-2 mr-auto sm:ml-4 w-[70%] sm:w-[66%] aspect-[4/5] rounded-t-[999px] rounded-b-[26px] p-[7px] bg-gradient-to-b from-white/92 via-[#E6F2FF]/45 to-white/82 backdrop-blur-[6px] border-2 border-white shadow-[0_24px_54px_-18px_rgba(52,18,46,0.38),0_0_24px_rgba(255,255,255,0.48),inset_0_2px_18px_rgba(255,255,255,0.92)]"
                        style={{ transform: 'translateZ(16px)' }}
                      >
                        <div className="relative w-full h-full rounded-t-[999px] rounded-b-[20px] overflow-hidden bg-gradient-to-b from-[#EFF6FF]/88 via-[#FFF8FC]/92 to-[#FAF4F0]/96">
                          <SafeImage
                            src={currentSlide.primary}
                            alt="Bó hoa bóng bay nghệ thuật phối màu dịu mắt tại Hoa Nelly"
                            preset="hero"
                            priority
                            className="w-full h-full object-contain transition-opacity duration-300"
                          />
                          {/* Specular arched crystal-glass highlight rim */}
                          <div
                            aria-hidden="true"
                            className="hn-glass-sheen pointer-events-none absolute inset-0 rounded-t-[999px] rounded-b-[20px] ring-2 ring-inset ring-white/80"
                            style={{
                              background:
                                'linear-gradient(122deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.08) 26%, rgba(255,255,255,0) 54%, rgba(196,230,255,0.20) 100%)',
                            }}
                          />
                        </div>
                      </div>

                      {/* Image 2: Secondary Bouquet Card - balanced overlap so both bouquets stay clearly visible at all widths */}
                      {currentSlide.secondary && (
                        <div
                          ref={detailScrollRef}
                          className="absolute bottom-8 right-1 sm:bottom-11 sm:right-0 w-[37%] sm:w-[39%] aspect-[4/4.7] z-30"
                          style={{ transform: 'translateZ(44px)' }}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveSlide((prev) => (prev + 1) % showcaseSlides.length)}
                            aria-label="Đổi ảnh trưng bày chính và ảnh phụ"
                            className="group block w-full h-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#DE2C74] rounded-[20px]"
                          >
                            <div
                              ref={detailLayerRef}
                              className="relative w-full h-full rotate-[3.5deg] sm:rotate-[5deg] group-hover:rotate-[1deg] group-hover:-translate-y-1.5 group-hover:scale-[1.02] transition-all duration-300 ease-out rounded-[20px] p-1.5 sm:p-2 bg-white/95 backdrop-blur-md border-2 border-white shadow-[0_20px_42px_-14px_rgba(56,16,44,0.38)]"
                            >
                              <div className="w-full h-full rounded-[13px] overflow-hidden bg-[#F5EAEF]">
                                <SafeImage
                                  src={currentSlide.secondary}
                                  alt="Cận cảnh bó hoa hồng bóng bay kết thủ công Hoa Nelly"
                                  preset="card"
                                  priority
                                  className="w-full h-full object-contain"
                                />
                              </div>
                            </div>
                          </button>
                        </div>
                      )}

                      {/* 3 Interactive Showcase Dots with generous tap targets centered beneath Pedestal */}
                      <div
                        className="absolute -bottom-1 left-[44%] -translate-x-1/2 z-30 flex items-center gap-1"
                        role="tablist"
                        aria-label="Chọn góc trưng bày bó hoa"
                      >
                        {showcaseSlides.map((slide, idx) => {
                          const isActive = idx === activeSlide;
                          return (
                            <button
                              key={slide.label}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              aria-label={slide.label}
                              onClick={() => setActiveSlide(idx)}
                              className="inline-flex items-center justify-center w-11 h-11 rounded-full cursor-pointer"
                            >
                              <span
                                className={`h-2.5 rounded-full transition-all duration-200 ${
                                  isActive
                                    ? 'w-5 bg-[#DE2C74] shadow-[0_0_10px_rgba(222,44,116,0.55)]'
                                    : 'w-2.5 bg-[#D4C5D8]/90 hover:bg-[#F49AC0]'
                                }`}
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LAYER 5B: 4 USP / BENEFIT COMPACT GROUP (Row 2 left on Desktop; Below Visual on Mobile) */}
              <div
                ref={uspBlockRef}
                className="lg:col-start-1 lg:row-start-2 lg:self-start"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 rounded-2xl bg-white/46 backdrop-blur-md border border-white/80 p-2.5 sm:p-3 shadow-[0_10px_24px_-16px_rgba(90,30,64,0.22)]">
                  <div className="hn-hero-usp-item flex flex-col items-center justify-center rounded-xl px-2 py-2 text-center">
                    <Gem className="w-4 h-4 text-[#C91D64]" aria-hidden="true" />
                    <p className="mt-1 text-[12.5px] font-medium leading-snug text-[#3D182A]">
                      Thiết kế theo yêu cầu
                    </p>
                  </div>
                  <div className="hn-hero-usp-item flex flex-col items-center justify-center rounded-xl px-2 py-2 text-center">
                    <Truck className="w-4 h-4 text-[#C91D64]" aria-hidden="true" />
                    <p className="mt-1 text-[12.5px] font-medium leading-snug text-[#3D182A]">
                      Giao nhanh trong 24h
                    </p>
                  </div>
                  <div className="hn-hero-usp-item flex flex-col items-center justify-center rounded-xl px-2 py-2 text-center">
                    <BadgeCheck className="w-4 h-4 text-[#C91D64]" aria-hidden="true" />
                    <p className="mt-1 text-[12.5px] font-medium leading-snug text-[#3D182A]">
                      Chất lượng bền đẹp
                    </p>
                  </div>
                  <div className="hn-hero-usp-item flex flex-col items-center justify-center rounded-xl px-2 py-2 text-center">
                    <Heart className="w-4 h-4 text-[#C91D64]" aria-hidden="true" />
                    <p className="mt-1 text-[12.5px] font-medium leading-snug text-[#3D182A]">
                      Trang trí sự kiện
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Subtle desktop scroll prompt */}
            {categories.length > 0 && (
              <div className="mt-3 hidden lg:flex items-center">
                <div
                  ref={scrollCueRef}
                  aria-hidden="true"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#5E1738]/75 drop-shadow-[0_1px_6px_rgba(255,255,255,0.85)]"
                >
                  <ArrowDown className="w-3.5 h-3.5 text-[#D92670]/80" />
                  <span>Cuộn nhẹ để xem 5 dòng sản phẩm</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Beat B: Incoming 5-Category Product Showcase (overlaps smoothly on desktop pin, stacks cleanly on mobile) */}
        {categories.length > 0 && (
          <div
            ref={beatBRef}
            className="w-full bg-[#FDFBF7] py-12 sm:py-16 lg:pt-24 lg:pb-10"
          >
            <div className="hn-container">
              <div
                ref={beatBHeadRef}
                className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
              >
                <div>
                  <p className="text-[14px] text-[#006A9E] font-medium mb-1">
                    Bạn đang tìm dòng sản phẩm nào?
                  </p>
                  <h2 className="font-serif font-medium text-[28px] sm:text-[36px] text-[#14222E]">
                    Danh mục sản phẩm
                  </h2>
                </div>
                <Link
                  to="/san-pham"
                  className="text-[14px] font-medium text-[#006A9E] hover:underline underline-offset-4 inline-flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span>Xem toàn bộ mẫu</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 lg:gap-6">
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    to={`/danh-muc/${cat.slug}`}
                    className="group flex flex-col"
                  >
                    <div className="hn-cat-frame hn-frame-clip aspect-[4/5] rounded-xl bg-[#F8F5EE] overflow-hidden border border-[#EFECE4]">
                      <div className="hn-cat-img-scale w-full h-full">
                        <SafeImage
                          src={cat.image_url}
                          alt={cat.name}
                          preset="card"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      </div>
                    </div>
                    <div className="pt-3">
                      <h3 className="font-serif font-medium text-[17px] leading-[1.32] text-[#14222E] group-hover:text-[#006A9E] transition-colors">
                        {cat.name}
                      </h3>
                      <p className="text-[13.5px] text-[#4A5C6B] mt-1 line-clamp-2 leading-relaxed">
                        {cat.description}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
