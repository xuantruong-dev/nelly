import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Headphones,
  PlayCircle,
  Store,
  Truck,
  Wand2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { SafeImage } from './SafeImage.tsx';
import { useBackgroundVideo } from '../hooks/useBackgroundVideo.ts';
import {
  MOTION_CONFIG,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from '../lib/motionConfig.ts';

const EVENT_HERO_VIDEO_DESKTOP_SRC = '/assets/aistudio/event_bg_desktop.mp4';
const EVENT_HERO_VIDEO_MOBILE_SRC = '/assets/aistudio/event_bg_mobile.mp4';
const EVENT_HERO_VIDEO_FALLBACK_SRC = '/assets/aistudio/event_bg_web.mp4';
const EVENT_HERO_VIDEO_POSTER_DESKTOP = '/assets/aistudio/event_video_poster_opt.webp';
const EVENT_HERO_VIDEO_POSTER_MOBILE = '/assets/aistudio/event_video_poster_mobile.webp';

interface ShowcaseSlide {
  image: string;
  title: string;
  tag: string;
}

const FLOATING_SERVICE_ITEMS = [
  {
    icon: Truck,
    title: 'Không gian nhỏ – Ấm cúng',
    subtitle: 'Các chương trình & tiệc gia đình tinh tế',
    targetId: 'goi-dich-vu',
  },
  {
    icon: Wand2,
    title: 'Tác viên – Điểm nhấn nổi bật',
    subtitle: 'Backdrop & cụm bóng bay sáng tạo',
    targetId: 'goi-dich-vu',
  },
  {
    icon: Store,
    title: 'Cửa hàng – Doanh nghiệp',
    subtitle: 'Trang trí sự kiện, khai trương thương hiệu',
    targetId: 'goi-dich-vu',
  },
  {
    icon: Headphones,
    title: 'Hỗ trợ tận tâm',
    subtitle: 'Tư vấn nhanh – Thiết kế theo yêu cầu',
    targetId: 'form-su-kien',
  },
];

export function EventHeroSection() {
  const { categories, occasions, featuredProducts, galleryPreview, settings } = useStore();
  const [activeIndex, setActiveIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const copyColRef = useRef<HTMLDivElement>(null);
  const galleryColRef = useRef<HTMLDivElement>(null);
  const tiltStageRef = useRef<HTMLDivElement>(null);
  const activeMediaRef = useRef<HTMLDivElement>(null);
  const glareRef = useRef<HTMLDivElement>(null);
  const leftWingRef = useRef<HTMLButtonElement>(null);
  const rightWingRef = useRef<HTMLButtonElement>(null);
  const leftBalloonRef = useRef<HTMLDivElement>(null);
  const rightFlowerRef = useRef<HTMLDivElement>(null);
  const petalLayerRef = useRef<HTMLDivElement>(null);
  const serviceBarRef = useRef<HTMLDivElement>(null);
  const discoverSectionRef = useRef<HTMLElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const { inView, isMobileViewport, reducedMotion } = useBackgroundVideo(videoRef, heroSectionRef);
  const eventVideoSrc = isMobileViewport
    ? EVENT_HERO_VIDEO_MOBILE_SRC
    : EVENT_HERO_VIDEO_DESKTOP_SRC;
  const eventPosterSrc = isMobileViewport
    ? EVENT_HERO_VIDEO_POSTER_MOBILE
    : EVENT_HERO_VIDEO_POSTER_DESKTOP;

  // Build authentic gallery slides from existing Hoa Nelly store images
  const showcaseSlides = useMemo<ShowcaseSlide[]>(() => {
    const candidates: ShowcaseSlide[] = [];
    const seen = new Set<string>();

    const pushIfValid = (image: string | undefined | null, title: string, tag: string) => {
      const clean = image?.trim();
      if (!clean || seen.has(clean)) return;
      seen.add(clean);
      candidates.push({ image: clean, title, tag });
    };

    const eventCat = categories.find((c) => c.slug === 'trang-tri-su-kien');
    pushIfValid(eventCat?.image_url, 'Trang trí sự kiện & Backdrop', 'Event Styling');

    galleryPreview.forEach((item) => {
      pushIfValid(item.image_url, item.title || 'Mẫu thực tế Hoa Nelly', item.category || 'Thực tế');
    });

    occasions.forEach((occ) => {
      pushIfValid(occ.image_url, occ.name, 'Theo dịp');
    });

    featuredProducts.forEach((prod) => {
      pushIfValid(prod.images?.[0], prod.name, 'Hoa bóng nghệ thuật');
    });

    categories.forEach((cat) => {
      pushIfValid(cat.image_url, cat.name, 'Danh mục');
    });

    pushIfValid(settings?.hero_image_url, 'Hoa bóng bay nghệ thuật Hoa Nelly', 'Signature');

    return candidates.slice(0, 4);
  }, [categories, occasions, featuredProducts, galleryPreview, settings]);

  // Keep activeIndex in range if data arrives asynchronously
  const safeIndex = showcaseSlides.length > 0 ? activeIndex % showcaseSlides.length : 0;
  const activeSlide = showcaseSlides[safeIndex];
  const prevIndex =
    showcaseSlides.length > 1
      ? (safeIndex - 1 + showcaseSlides.length) % showcaseSlides.length
      : -1;
  const nextIndex =
    showcaseSlides.length > 1 ? (safeIndex + 1) % showcaseSlides.length : -1;
  const prevSlide = prevIndex >= 0 ? showcaseSlides[prevIndex] : null;
  const nextSlide = nextIndex >= 0 && nextIndex !== prevIndex ? showcaseSlides[nextIndex] : null;

  // Show all slides (up to 4) uniformly in floating 3D dock
  const thumbnails = useMemo(() => showcaseSlides, [showcaseSlides]);

  const handlePrev = () => {
    if (showcaseSlides.length < 2) return;
    setActiveIndex((prev) => (prev - 1 + showcaseSlides.length) % showcaseSlides.length);
  };

  const handleNext = () => {
    if (showcaseSlides.length < 2) return;
    setActiveIndex((prev) => (prev + 1) % showcaseSlides.length);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    // Only trigger slide change on clear horizontal swipe intent so vertical page scroll stays smooth
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) handleNext();
      else handlePrev();
    }
  };

  const scrollToAnchor = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Discover 4 service cards with real category routes & thumbnails
  const discoverCards = useMemo(() => {
    const findCatImage = (slugPart: string, fallbackIdx: number) =>
      categories.find((c) => c.slug.includes(slugPart))?.image_url ||
      categories[fallbackIdx]?.image_url ||
      featuredProducts[fallbackIdx]?.images?.[0] ||
      settings?.hero_image_url ||
      '';

    const flowerCat =
      categories.find((c) => c.slug.includes('hoa-bong')) || categories[0];
    const giftCat =
      categories.find((c) => c.slug.includes('qua-tang') || c.slug.includes('phu-kien')) ||
      categories[3] ||
      categories[1];

    return [
      {
        title: 'Bóng bay',
        line2: 'nghệ thuật',
        to: flowerCat ? `/danh-muc/${flowerCat.slug}` : '/san-pham',
        image: findCatImage('hoa-bong', 0),
        tint: 'from-[#FFF1F6] via-[#FFF8FB] to-white',
        ring: 'border-[#F7CFE0]',
      },
      {
        title: 'Sinh nhật',
        line2: '& thôi nôi',
        to: '/bo-suu-tap',
        image: occasions[0]?.image_url || findCatImage('sinh-nhat', 1),
        tint: 'from-[#F0F8FF] via-[#F9FCFF] to-white',
        ring: 'border-[#CFE7FA]',
      },
      {
        title: 'Trang trí',
        line2: 'sự kiện',
        anchorId: 'form-su-kien',
        image: findCatImage('trang-tri-su-kien', 2),
        tint: 'from-[#FFF0F6] via-[#F6FAFF] to-white',
        ring: 'border-[#F3CCE0]',
      },
      {
        title: 'Quà tặng',
        line2: '& phụ kiện',
        to: giftCat ? `/danh-muc/${giftCat.slug}` : '/san-pham',
        image: findCatImage('qua-tang', 3),
        tint: 'from-[#FDF4F7] via-[#FFFBF8] to-white',
        ring: 'border-[#F5D4E2]',
      },
    ];
  }, [categories, occasions, featuredProducts, settings]);

  // GSAP staged entrance + subtle scroll parallax + desktop-only gentle 3D tilt
  useGSAP(
    () => {
      if (prefersReducedMotion() || !rootRef.current) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          isDesktop: '(min-width: 1024px)',
          hasFinePointer: '(hover: hover) and (pointer: fine)',
        },
        (context) => {
          const { isDesktop, hasFinePointer } = context.conditions || {};

          // 1. Staged Hero Entrance
          const introTl = gsap.timeline({
            defaults: { ease: MOTION_CONFIG.eases.primary },
          });

          introTl
            .fromTo(
              '.ev-hero-badge',
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: 0.55, clearProps: 'transform,opacity' },
              0.12
            )
            .fromTo(
              '.ev-hero-line',
              { opacity: 0, y: 26 },
              {
                opacity: 1,
                y: 0,
                duration: 0.72,
                stagger: 0.14,
                clearProps: 'transform,opacity',
              },
              0.24
            )
            .fromTo(
              '.ev-hero-desc',
              { opacity: 0, y: 16 },
              { opacity: 1, y: 0, duration: 0.6, clearProps: 'transform,opacity' },
              0.48
            )
            .fromTo(
              '.ev-hero-cta',
              { opacity: 0, y: 16, scale: 0.97 },
              {
                opacity: 1,
                y: 0,
                scale: 1,
                duration: 0.55,
                stagger: 0.1,
                clearProps: 'transform,opacity',
              },
              0.62
            )
            .fromTo(
              '.ev-main-frame',
              { opacity: 0, scale: 0.94, y: 30 },
              {
                opacity: 1,
                scale: 1,
                y: 0,
                duration: 0.95,
                ease: MOTION_CONFIG.eases.soft,
                clearProps: 'transform,opacity',
              },
              0.28
            )
            .fromTo(
              '.ev-thumb-card',
              { opacity: 0, x: 24, y: 16, scale: 0.92 },
              {
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                duration: 0.7,
                stagger: 0.14,
                ease: MOTION_CONFIG.eases.soft,
                clearProps: 'transform,opacity',
              },
              0.46
            )
            .fromTo(
              serviceBarRef.current,
              { opacity: 0, y: 24 },
              { opacity: 1, y: 0, duration: 0.7, clearProps: 'transform,opacity' },
              0.74
            );

          // 2. Subtle Cinematic Scroll Parallax (no dizziness, silky smooth)
          if (heroSectionRef.current) {
            if (videoRef.current) {
              gsap.fromTo(
                videoRef.current,
                { scale: 1 },
                {
                  scale: 1.05,
                  ease: 'none',
                  scrollTrigger: {
                    trigger: heroSectionRef.current,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: 1.1,
                  },
                }
              );
            }

            if (isDesktop && copyColRef.current) {
              gsap.to(copyColRef.current, {
                y: -22,
                ease: 'none',
                scrollTrigger: {
                  trigger: heroSectionRef.current,
                  start: 'top top',
                  end: 'bottom top',
                  scrub: 1,
                },
              });
            }

            if (isDesktop && galleryColRef.current) {
              gsap.to(galleryColRef.current, {
                y: -34,
                ease: 'none',
                scrollTrigger: {
                  trigger: heroSectionRef.current,
                  start: 'top top',
                  end: 'bottom top',
                  scrub: 1.15,
                },
              });
            }

            if (leftBalloonRef.current) {
              gsap.to(leftBalloonRef.current, {
                y: -46,
                ease: 'none',
                scrollTrigger: {
                  trigger: heroSectionRef.current,
                  start: 'top top',
                  end: 'bottom top',
                  scrub: 1.2,
                },
              });
            }

            if (rightFlowerRef.current) {
              gsap.to(rightFlowerRef.current, {
                y: -58,
                ease: 'none',
                scrollTrigger: {
                  trigger: heroSectionRef.current,
                  start: 'top top',
                  end: 'bottom top',
                  scrub: 1.1,
                },
              });
            }

            if (petalLayerRef.current) {
              gsap.to(petalLayerRef.current, {
                y: -26,
                ease: 'none',
                scrollTrigger: {
                  trigger: heroSectionRef.current,
                  start: 'top top',
                  end: 'bottom top',
                  scrub: 1.3,
                },
              });
            }
          }

          // 3. Reveal "Khám phá dịch vụ của Hoa Nelly" section smoothly from bottom
          if (discoverSectionRef.current) {
            const discoverCardsEls = gsap.utils.toArray<HTMLElement>(
              '.ev-discover-card',
              discoverSectionRef.current
            );
            gsap.fromTo(
              '.ev-discover-head',
              { opacity: 0, y: 22 },
              {
                opacity: 1,
                y: 0,
                duration: 0.65,
                ease: MOTION_CONFIG.eases.primary,
                clearProps: 'transform,opacity',
                scrollTrigger: {
                  trigger: discoverSectionRef.current,
                  start: 'top 86%',
                  once: true,
                },
              }
            );
            if (discoverCardsEls.length > 0) {
              gsap.fromTo(
                discoverCardsEls,
                { opacity: 0, y: 28 },
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.65,
                  stagger: 0.09,
                  ease: MOTION_CONFIG.eases.primary,
                  clearProps: 'transform,opacity',
                  scrollTrigger: {
                    trigger: discoverSectionRef.current,
                    start: 'top 82%',
                    once: true,
                  },
                }
              );
            }
          }

          // 4. Desktop-only cinematic 3D mouse tilt, parallax wing shift & live specular spotlight
          if (hasFinePointer && tiltStageRef.current && galleryColRef.current) {
            const stage = tiltStageRef.current;
            const zone = galleryColRef.current;

            const rotXTo = gsap.quickTo(stage, 'rotationX', {
              duration: 0.55,
              ease: MOTION_CONFIG.eases.soft,
            });
            const rotYTo = gsap.quickTo(stage, 'rotationY', {
              duration: 0.55,
              ease: MOTION_CONFIG.eases.soft,
            });
            const leftWingXTo = leftWingRef.current
              ? gsap.quickTo(leftWingRef.current, 'x', { duration: 0.65, ease: MOTION_CONFIG.eases.soft })
              : null;
            const rightWingXTo = rightWingRef.current
              ? gsap.quickTo(rightWingRef.current, 'x', { duration: 0.65, ease: MOTION_CONFIG.eases.soft })
              : null;

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
              const px = (e.clientX - rect.left) / rect.width;
              const py = (e.clientY - rect.top) / rect.height;
              const nx = px - 0.5;
              const ny = py - 0.5;
              rotYTo(nx * 11);
              rotXTo(-ny * 8.5);
              leftWingXTo?.(-nx * 14);
              rightWingXTo?.(-nx * 14);
              if (glareRef.current) {
                glareRef.current.style.opacity = '1';
                glareRef.current.style.background = `radial-gradient(circle 280px at ${(px * 100).toFixed(1)}% ${(py * 100).toFixed(1)}%, rgba(255,255,255,0.40) 0%, rgba(255,228,242,0.16) 42%, rgba(255,255,255,0) 76%)`;
              }
            };

            const onPointerLeave = () => {
              cachedRect = null;
              rotXTo(0);
              rotYTo(0);
              leftWingXTo?.(0);
              rightWingXTo?.(0);
              if (glareRef.current) {
                glareRef.current.style.opacity = '0';
              }
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
            };
          }
        }
      );
    },
    { scope: rootRef, dependencies: [showcaseSlides.length] }
  );

  // Smooth cinematic focus-pull & bloom transition when switching slides
  useGSAP(
    () => {
      if (prefersReducedMotion() || !activeMediaRef.current) return;
      gsap.fromTo(
        activeMediaRef.current,
        { opacity: 0.45, scale: 1.07 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.62,
          ease: MOTION_CONFIG.eases.primary,
          clearProps: 'transform,opacity',
        }
      );
    },
    { dependencies: [safeIndex] }
  );

  return (
    <div ref={rootRef} className="w-full overflow-x-clip">
      {/* =====================================================================
          HERO SECTION - 6-LAYER LUXURY PASTEL ARCHITECTURE OVER EXISTING VIDEO
         ===================================================================== */}
      <section
        ref={heroSectionRef}
        className={`relative -mt-[64px] sm:-mt-[74px] pt-[80px] sm:pt-[94px] lg:pt-[102px] pb-12 sm:pb-14 lg:pb-16 w-full overflow-hidden bg-[#EFF7FD] ${
          !inView ? 'hn-motion-paused' : ''
        }`}
      >
        {/* LAYER 0 - RESPONSIVE H.264 FASTSTART VIDEO BACKGROUND (mobile 432p / desktop 720p + WebP poster) */}
        <video
          key={eventVideoSrc}
          ref={videoRef}
          poster={eventPosterSrc}
          autoPlay={!reducedMotion}
          loop
          muted
          playsInline
          preload={reducedMotion ? 'none' : 'metadata'}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
        >
          <source src={eventVideoSrc} type="video/mp4" />
          <source src={EVENT_HERO_VIDEO_FALLBACK_SRC} type="video/mp4" />
        </video>

        {/* LAYER 1 - LIGHT LUMINOUS PASTEL GRADIENT OVERLAY (VIDEO STAYS CLEARLY VISIBLE) */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.52) 28%, rgba(225,242,255,0.22) 56%, rgba(255,220,235,0.14) 82%, rgba(255,255,255,0.03) 100%)',
          }}
        />
        {/* Soft white radial readability veil strictly behind left headline copy */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-[1]"
          style={{
            background:
              'radial-gradient(ellipse 46% 58% at 24% 46%, rgba(255,255,255,0.56) 0%, rgba(255,255,255,0.18) 58%, rgba(255,255,255,0) 100%)',
          }}
        />
        {/* Seamless white bottom mist blending naturally into the white section below */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-28 sm:h-36 pointer-events-none z-[1] bg-gradient-to-t from-white via-white/75 to-transparent"
        />

        {/* LAYER 2 - DEPTH-OF-FIELD DECORATIVE ELEMENTS (SVG / CSS, NON-BLOCKING) */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-[2] overflow-hidden">
          {/* Background decorative soft light orbs (blur 8-12px feel, very low opacity) */}
          <div className="hidden sm:block absolute top-[12%] right-[14%] w-72 h-72 rounded-full bg-[#B9E2FF]/26 blur-[48px]" />
          <div className="hidden sm:block absolute bottom-[22%] left-[34%] w-60 h-60 rounded-full bg-[#FFC9DF]/22 blur-[42px]" />

          {/* Midground far-left translucent Bobo Heart Balloon with pastel pink satin bow */}
          <div
            ref={leftBalloonRef}
            className="hidden xl:block absolute left-3 2xl:left-7 top-[30%] w-[142px] opacity-85 hn-float-bubble"
          >
            <svg viewBox="0 0 160 245" fill="none" className="w-full h-auto drop-shadow-[0_12px_22px_rgba(220,88,142,0.18)]">
              <defs>
                <radialGradient id="evBoboGlass" cx="35%" cy="30%" r="68%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
                  <stop offset="55%" stopColor="#E6F4FF" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#F9BFD7" stopOpacity="0.34" />
                </radialGradient>
                <radialGradient id="evHeartFill" cx="38%" cy="32%" r="65%">
                  <stop offset="0%" stopColor="#FFDCE9" />
                  <stop offset="58%" stopColor="#F89EC0" />
                  <stop offset="100%" stopColor="#E66999" />
                </radialGradient>
              </defs>
              {/* Outer transparent bobo bubble */}
              <circle cx="80" cy="76" r="62" fill="url(#evBoboGlass)" stroke="#FFFFFF" strokeOpacity="0.88" strokeWidth="2.2" />
              {/* Specular glass reflection arcs */}
              <path d="M40 52 C46 32, 65 24, 82 24" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" strokeOpacity="0.72" />
              <circle cx="44" cy="64" r="3.5" fill="#FFFFFF" fillOpacity="0.78" />
              {/* Soft pink heart balloon floating inside */}
              <path
                d="M80 107 C58 92, 46 77, 46 62 C46 50, 56 42, 66 42 C73 42, 78 46, 80 51 C82 46, 87 42, 94 42 C104 42, 114 50, 114 62 C114 77, 102 92, 80 107 Z"
                fill="url(#evHeartFill)"
                fillOpacity="0.88"
              />
              <path d="M58 57 C59 52, 64 49, 69 49" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.65" />
              {/* Stem & pastel pink ribbon bow */}
              <line x1="80" y1="138" x2="80" y2="235" stroke="#FFFFFF" strokeOpacity="0.75" strokeWidth="3" strokeLinecap="round" />
              <path d="M80 144 C64 132, 46 136, 48 148 C50 158, 66 156, 80 147 Z" fill="#F8A9C7" fillOpacity="0.86" />
              <path d="M80 144 C96 132, 114 136, 112 148 C110 158, 94 156, 80 147 Z" fill="#F596BA" fillOpacity="0.86" />
              <path d="M77 148 C70 168, 62 184, 54 198" stroke="#F8A9C7" strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.8" />
              <path d="M83 148 C90 168, 98 184, 106 198" stroke="#F596BA" strokeWidth="5.5" strokeLinecap="round" strokeOpacity="0.8" />
              <circle cx="80" cy="146" r="5" fill="#F17EA9" />
            </svg>
          </div>

          {/* Midground drifting translucent rose petals & soft light sparkles */}
          <div ref={petalLayerRef} className="absolute inset-0">
            <svg
              viewBox="0 0 64 44"
              className="hidden md:block absolute top-[14%] left-[42%] w-11 opacity-70 hn-float-bubble-delayed"
            >
              <path
                d="M10 34 C14 14, 38 4, 56 12 C52 28, 32 40, 10 34 Z"
                fill="#F7A7C5"
                fillOpacity="0.72"
              />
              <path d="M18 28 C28 18, 40 14, 48 15" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
            </svg>

            <div className="hidden md:block absolute top-[24%] left-[48%] w-3 h-3 rounded-full bg-white/80 blur-[1px]" />
            <div className="hidden lg:block absolute top-[62%] left-[43%] w-4 h-4 rounded-full bg-[#FFE2EE]/80 blur-[1.5px]" />
          </div>

          {/* Foreground near-camera out-of-focus petal bottom-left (blur 2.5px) */}
          <svg
            viewBox="0 0 90 70"
            className="hidden md:block absolute -left-3 bottom-[14%] w-24 opacity-55 blur-[2.5px]"
          >
            <path
              d="M8 58 C12 20, 48 6, 82 22 C74 52, 42 68, 8 58 Z"
              fill="#F28AB4"
            />
          </svg>

          {/* Foreground near-camera translucent flower blossom peek bottom-right (blur 1.5px) */}
          <div
            ref={rightFlowerRef}
            className="hidden lg:block absolute -right-14 bottom-[6%] w-56 opacity-55 blur-[1.5px]"
          >
            <svg viewBox="0 0 220 220" fill="none" className="w-full h-auto">
              <defs>
                <radialGradient id="evCornerPetal" cx="40%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="65%" stopColor="#FFDCEB" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#F5A7C7" stopOpacity="0.72" />
                </radialGradient>
              </defs>
              <ellipse cx="110" cy="52" rx="34" ry="48" fill="url(#evCornerPetal)" />
              <ellipse cx="164" cy="92" rx="46" ry="34" transform="rotate(18 164 92)" fill="url(#evCornerPetal)" />
              <ellipse cx="144" cy="158" rx="34" ry="48" transform="rotate(-24 144 158)" fill="url(#evCornerPetal)" />
              <ellipse cx="76" cy="158" rx="34" ry="48" transform="rotate(24 76 158)" fill="url(#evCornerPetal)" />
              <ellipse cx="56" cy="92" rx="46" ry="34" transform="rotate(-18 56 92)" fill="url(#evCornerPetal)" />
              <circle cx="110" cy="108" r="24" fill="#FFF2F7" />
              <circle cx="110" cy="108" r="14" fill="#F7C794" fillOpacity="0.75" />
            </svg>
          </div>
        </div>

        {/* ===================================================================
            MAIN HERO CONTENT CONTAINER (LAYER 3 LEFT COPY + LAYER 4 RIGHT GALLERY)
           =================================================================== */}
        <div className="relative z-10 hn-container lg:max-w-[1396px] lg:px-5 xl:px-8">
          {/* Original unmodified butterfly flying in the open sky pocket between headline & 3D vitrine */}
          <div
            aria-hidden="true"
            className="hidden lg:block hn-butterfly-flight hn-butterfly-interactive select-none absolute top-[12%] left-[34.5%] xl:top-[11%] xl:left-[35.5%] w-[178px] xl:w-[214px] z-20"
          >
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
              />
            </picture>
          </div>

          <div className="hn-grid-12 items-center">
            {/* LAYER 3 - LEFT SIDE EDITORIAL COPY & CTAs (~42% on desktop) */}
            <div ref={copyColRef} className="lg:col-span-5 space-y-5 lg:pr-2">
              {/* Soft Frosted Badge */}
              <div className="ev-hero-badge inline-flex items-center px-3.5 py-1.5 rounded-full bg-white/82 backdrop-blur-md border border-[#F5C5D8] shadow-[0_6px_18px_-10px_rgba(204,64,124,0.35)]">
                <span className="text-[12.5px] sm:text-[13px] font-semibold text-[#7A2047] tracking-[0.01em]">
                  Tư vấn &amp; Báo giá theo không gian thực tế
                </span>
              </div>

              {/* Editorial Serif + Natural Calligraphic Script Heading */}
              <h1 className="space-y-0.5">
                <span className="ev-hero-line block font-serif font-semibold text-[clamp(2rem,3.4vw,3.35rem)] text-[#1B3B35] tracking-[-0.02em] leading-[1.12] drop-shadow-[0_2px_12px_rgba(255,255,255,0.85)]">
                  Dịch vụ trang trí
                </span>
                <span className="ev-hero-line flex items-center gap-2 flex-wrap">
                  <span className="font-script font-bold text-[clamp(2.9rem,4.8vw,4.65rem)] text-[#E1457E] leading-[0.98] pr-1 drop-shadow-[0_3px_14px_rgba(255,255,255,0.9)]">
                    sự kiện
                  </span>
                  {/* Delicate hand-drawn pink ribbon swoosh & heart flourish */}
                  <svg
                    viewBox="0 0 140 52"
                    fill="none"
                    aria-hidden="true"
                    className="w-[88px] sm:w-[112px] xl:w-[130px] h-auto -ml-1 translate-y-1 text-[#E1457E]"
                  >
                    <path
                      d="M4 34 C30 22, 54 44, 84 30 C98 23, 108 18, 114 26 C117 15, 130 10, 134 19 C138 28, 125 40, 112 46 C106 39, 98 31, 103 22"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </h1>

              {/* Description Paragraph */}
              <p className="ev-hero-desc text-[15px] sm:text-[15.5px] text-[#283B3F] leading-[1.7] max-w-[46ch] font-normal">
                Hoa Nelly thiết kế cụm bóng bay, backdrop chụp ảnh, bàn tiệc sinh nhật và không gian khai trương với màu sắc tinh tế. Mọi hạng mục, phụ phí thi công và điều kiện thực hiện đều được trao đổi minh bạch trong báo giá.
              </p>

              {/* Two Refined Micro-Interaction CTAs */}
              <div className="flex flex-col min-[420px]:flex-row flex-wrap items-stretch min-[420px]:items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => scrollToAnchor('form-su-kien')}
                  className="ev-hero-cta group inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 py-3 rounded-full bg-gradient-to-r from-[#EC5890] via-[#E1417D] to-[#D62E6E] text-white text-[14.5px] font-semibold shadow-[0_14px_28px_-12px_rgba(216,46,110,0.62)] hover:shadow-[0_18px_32px_-12px_rgba(216,46,110,0.75)] hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
                >
                  <CalendarHeart className="w-4 h-4 transition-transform duration-200 group-hover:-rotate-6" aria-hidden="true" />
                  <span>Tư vấn ngay</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                </button>

                <Link
                  to="/thu-vien"
                  className="ev-hero-cta group inline-flex items-center justify-center gap-2 min-h-[48px] px-5 py-3 rounded-full bg-white/85 backdrop-blur-md text-[#B82862] border border-[#EB94B7] text-[14.5px] font-semibold shadow-[0_10px_24px_-14px_rgba(110,36,72,0.28)] hover:bg-white hover:border-[#DF3E7C] hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <PlayCircle className="w-4 h-4 text-[#DF3E7C] transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                  <span>Xem mẫu thực tế</span>
                </Link>
              </div>
            </div>

            {/* LAYER 4 - RIGHT SIDE CINEMATIC 3D SCULPTED VITRINE & PERSPECTIVE DECK (~58% on desktop) */}
            <div ref={galleryColRef} className="lg:col-span-7">
              <div className="relative max-w-[650px] mx-auto lg:ml-auto lg:mr-0">
                {/* 3D Perspective Stage (1400px lens depth) */}
                <div className="relative" style={{ perspective: '1400px' }}>
                  {/* Interactive 3D Preserve-3D Diorama */}
                  <div
                    ref={tiltStageRef}
                    onTouchStart={handleTouchStart}
                    onTouchEnd={handleTouchEnd}
                    className="ev-main-frame hn-preserve-3d relative mx-auto pt-2 pb-10 sm:pt-3 sm:pb-12 px-2 sm:px-10"
                  >
                    {/* Z = -52px: Volumetric Studio Cinema Backlight Halo */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 w-[92%] h-[82%] rounded-full opacity-90 blur-[44px]"
                      style={{
                        transform: 'translateZ(-52px)',
                        background:
                          'radial-gradient(circle at 50% 45%, rgba(255,214,232,0.72) 0%, rgba(206,235,255,0.44) 48%, rgba(255,255,255,0) 76%)',
                      }}
                    />

                    {/* Z = -34px: Sculpted 3D Architectural Rose-Pearl Halo Arch Silhouette */}
                    <div
                      aria-hidden="true"
                      className="hidden sm:block pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[78%] max-w-[450px] h-[88%] rounded-t-[240px] rounded-b-[42px] border-[2px] border-white/85 bg-gradient-to-b from-white/36 via-[#FFE4F0]/24 to-white/10 shadow-[inset_0_2px_24px_rgba(255,255,255,0.85),0_26px_64px_-24px_rgba(92,24,62,0.34)]"
                      style={{ transform: 'translateZ(-34px) scale(1.04)' }}
                    />

                    {/* Z = -24px: 3D Peeking Wing Cards (Clickable Perspective Stack) */}
                    {prevSlide && (
                      <button
                        ref={leftWingRef}
                        type="button"
                        onClick={handlePrev}
                        aria-label={`Xem mẫu trước: ${prevSlide.title}`}
                        className="hidden sm:block group absolute left-0 lg:-left-2 top-[13%] w-[36%] max-w-[215px] aspect-[4/4.8] rounded-[26px] p-1.5 bg-white/80 backdrop-blur-md border border-white/95 shadow-[0_24px_48px_-18px_rgba(46,16,38,0.42)] cursor-pointer transition-opacity duration-300 opacity-88 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[#D83995]"
                        style={{
                          transform: 'translateZ(-24px) rotateY(19deg) rotateZ(-3.5deg)',
                        }}
                      >
                        <div className="relative w-full h-full rounded-[20px] overflow-hidden bg-[#2A1522]">
                          <SafeImage
                            src={prevSlide.image}
                            alt={prevSlide.title}
                            preset="card"
                            objectFit="cover"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 brightness-[0.84] saturate-[0.92] group-hover:brightness-95"
                          />
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-gradient-to-r from-[#1D0E18]/45 via-[#1D0E18]/18 to-transparent"
                          />
                        </div>
                      </button>
                    )}

                    {nextSlide && (
                      <button
                        ref={rightWingRef}
                        type="button"
                        onClick={handleNext}
                        aria-label={`Xem mẫu tiếp theo: ${nextSlide.title}`}
                        className="hidden sm:block group absolute right-0 lg:-right-2 top-[15%] w-[36%] max-w-[215px] aspect-[4/4.8] rounded-[26px] p-1.5 bg-white/80 backdrop-blur-md border border-white/95 shadow-[0_24px_48px_-18px_rgba(46,16,38,0.42)] cursor-pointer transition-opacity duration-300 opacity-88 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[#D83995]"
                        style={{
                          transform: 'translateZ(-24px) rotateY(-19deg) rotateZ(3.5deg)',
                        }}
                      >
                        <div className="relative w-full h-full rounded-[20px] overflow-hidden bg-[#2A1522]">
                          <SafeImage
                            src={nextSlide.image}
                            alt={nextSlide.title}
                            preset="card"
                            objectFit="cover"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 brightness-[0.84] saturate-[0.92] group-hover:brightness-95"
                          />
                          <div
                            aria-hidden="true"
                            className="absolute inset-0 bg-gradient-to-l from-[#1D0E18]/45 via-[#1D0E18]/18 to-transparent"
                          />
                        </div>
                      </button>
                    )}

                    {/* Z = +2px: Sculpted 3D Pearl-Blush Exhibition Pedestal Plinth */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[90%] sm:w-[82%] max-w-[490px] z-0"
                      style={{ transform: 'translateZ(2px)' }}
                    >
                      {/* Soft studio contact ambient occlusion */}
                      <div className="absolute -inset-x-6 -bottom-3 h-10 rounded-[100%] bg-[#2C1024]/30 blur-xl" />
                      {/* Top pearlescent deck surface */}
                      <div className="relative z-10 h-8 sm:h-9 rounded-[100%] bg-gradient-to-b from-white via-[#FFF7FB] to-[#EEDCEB] border-2 border-white shadow-[inset_0_3px_12px_rgba(255,255,255,0.98),0_6px_16px_rgba(88,30,68,0.2)]" />
                      {/* Extruded 3D cylindrical pedestal body with champagne specular rim */}
                      <div className="-mt-4 sm:-mt-4.5 h-10 sm:h-11 rounded-b-[100%] bg-gradient-to-r from-[#D9C6DC] via-[#FFFFFF] via-46% to-[#D8BDD4] border-x border-b border-white/95 shadow-[0_24px_40px_-10px_rgba(32,10,26,0.52)] relative overflow-hidden">
                        <div className="absolute inset-x-6 top-[40%] h-[1.5px] bg-white/92" />
                        <div className="absolute inset-x-10 top-[66%] h-px bg-[#E5B89B]/60" />
                      </div>
                    </div>

                    {/* Z = +24px: PRIMARY SCULPTED 3D GLASS-ARCH CINEMA VITRINE */}
                    <div
                      className="relative z-20 mx-auto w-full max-w-[420px] sm:max-w-[436px]"
                      style={{ transform: 'translateZ(24px)' }}
                    >
                      {/* Extruded 3D pearl-rose glass casing */}
                      <div className="relative rounded-t-[165px] sm:rounded-t-[195px] rounded-b-[30px] p-[8px] sm:p-[9px] bg-gradient-to-b from-white/96 via-[#FFF2F8]/88 to-[#F3DAE8]/92 backdrop-blur-md border-[1.5px] border-white shadow-[0_32px_68px_-20px_rgba(42,14,34,0.52),0_0_28px_rgba(255,255,255,0.45),inset_0_2px_18px_rgba(255,255,255,0.96),inset_0_-4px_12px_rgba(162,74,116,0.16)]">
                        {/* Inner beveled optical viewport */}
                        <div className="relative aspect-[4/4.65] sm:aspect-[4/4.55] w-full rounded-t-[157px] sm:rounded-t-[186px] rounded-b-[22px] overflow-hidden bg-[#1D1119] ring-1 ring-inset ring-white/80">
                          <div ref={activeMediaRef} className="w-full h-full">
                            {activeSlide ? (
                              <SafeImage
                                key={activeSlide.image}
                                src={activeSlide.image}
                                alt={activeSlide.title}
                                preset="detail"
                                objectFit="cover"
                                priority
                                className="w-full h-full object-cover object-center transition-transform duration-700 ease-out hover:scale-[1.04]"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-[#FFF1F6] to-[#EAF5FF]" />
                            )}
                          </div>

                          {/* Cinematic subtle top atmospheric vignette */}
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 top-0 h-24 z-10 bg-gradient-to-b from-[#1A0C16]/24 via-[#1A0C16]/6 to-transparent"
                          />

                          {/* Static crystal-glass rim reflection along the upper arch */}
                          <div
                            aria-hidden="true"
                            className="hn-glass-sheen pointer-events-none absolute inset-0 z-10 rounded-t-[157px] sm:rounded-t-[186px] rounded-b-[22px] ring-1 ring-inset ring-white/55"
                            style={{
                              background:
                                'linear-gradient(125deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 26%, rgba(255,255,255,0) 52%, rgba(202,232,255,0.16) 100%)',
                            }}
                          />

                          {/* Live Pointer-Tracking Specular Cinema Light Glint */}
                          <div
                            ref={glareRef}
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300"
                          />

                          {/* Measured Cinema Bottom Scrim for Effortless Editorial Legibility */}
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] z-10 bg-gradient-to-t from-[#190A14]/84 via-[#190A14]/38 to-transparent"
                          />

                          {/* Unboxed Cinema Caption + Inline Prev/Next Glass Controls */}
                          <div className="absolute inset-x-0 bottom-0 z-20 px-4 sm:px-5 pb-4 sm:pb-5 pt-6 flex items-end justify-between gap-3">
                            {activeSlide ? (
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-[11.5px] font-medium text-[#FFD9EA] tracking-[0.02em]">
                                  <span className="tabular-nums font-semibold text-white">
                                    {String(safeIndex + 1).padStart(2, '0')} / {String(showcaseSlides.length).padStart(2, '0')}
                                  </span>
                                  <span aria-hidden="true" className="text-white/55">·</span>
                                  <span className="truncate text-white/85">{activeSlide.tag}</span>
                                </div>
                                <p className="mt-0.5 font-serif text-[16px] sm:text-[18px] font-medium leading-snug text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.45)] truncate">
                                  {activeSlide.title}
                                </p>
                              </div>
                            ) : (
                              <div />
                            )}

                            {showcaseSlides.length > 1 && (
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={handlePrev}
                                  aria-label="Xem mẫu trang trí trước"
                                  className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/18 hover:bg-white/92 backdrop-blur-md border border-white/55 text-white hover:text-[#B82862] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                                >
                                  <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleNext}
                                  aria-label="Xem mẫu trang trí tiếp theo"
                                  className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/18 hover:bg-white/92 backdrop-blur-md border border-white/55 text-white hover:text-[#B82862] shadow-[0_8px_20px_-8px_rgba(0,0,0,0.45)] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
                                >
                                  <ChevronRight className="w-5 h-5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Z = +44px: Sculpted 3D Floating Foreground Orbs & Glossy Satin Ribbon Arc */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-30"
                      style={{ transform: 'translateZ(44px)' }}
                    >
                      {/* Floating hand-drawn rose heart flourish above top-right arch */}
                      <svg
                        viewBox="0 0 48 48"
                        fill="none"
                        className="hidden sm:block absolute top-1 right-10 w-9 h-9 text-[#E54B84] drop-shadow-[0_4px_12px_rgba(255,255,255,0.85)] hn-float-bubble-delayed"
                      >
                        <path
                          d="M20 38 C12 29, 8 22, 11 15 C14 9, 21 10, 24 16 C29 9, 37 11, 38 18 C39 25, 30 33, 18 40"
                          stroke="currentColor"
                          strokeWidth="2.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>

                      {/* 3D Iridescent Pearl Orb top-left */}
                      <span
                        className="hidden sm:block hn-float-bubble absolute top-[14%] left-[12%] w-10 h-10 rounded-full border border-white/92 shadow-[inset_0_3px_10px_rgba(255,255,255,0.98),0_12px_24px_rgba(128,44,92,0.28)]"
                        style={{
                          background:
                            'radial-gradient(circle at 28% 26%, rgba(255,255,255,0.96) 0%, rgba(255,204,228,0.52) 45%, rgba(176,224,255,0.46) 80%, rgba(255,255,255,0.72) 100%)',
                        }}
                      />

                      {/* 3D Pearlescent Sphere lower-right */}
                      <span
                        className="hidden sm:block hn-float-bubble-delayed absolute bottom-[18%] right-[9%] w-8 h-8 rounded-full border border-white/90 shadow-[inset_0_2px_8px_rgba(255,255,255,0.98),0_10px_20px_rgba(128,44,92,0.26)]"
                        style={{
                          background:
                            'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.96) 0%, rgba(190,232,255,0.52) 48%, rgba(247,178,210,0.48) 82%, rgba(255,255,255,0.75) 100%)',
                        }}
                      />

                      {/* Glossy 3D Rose-Satin Ribbon Sweeping Across the Pedestal Front */}
                      <svg
                        viewBox="0 0 520 90"
                        fill="none"
                        className="hidden sm:block absolute bottom-2 left-1/2 -translate-x-1/2 w-[78%] max-w-[440px] h-auto drop-shadow-[0_10px_18px_rgba(196,42,104,0.28)]"
                      >
                        <defs>
                          <linearGradient id="evPedestalRibbon" x1="0%" y1="50%" x2="100%" y2="50%">
                            <stop offset="0%" stopColor="#FBB8D5" stopOpacity="0.15" />
                            <stop offset="22%" stopColor="#F58CB8" stopOpacity="0.92" />
                            <stop offset="52%" stopColor="#FFD9EA" stopOpacity="0.96" />
                            <stop offset="80%" stopColor="#E4528E" stopOpacity="0.92" />
                            <stop offset="100%" stopColor="#FBB8D5" stopOpacity="0.12" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M22 44 C128 80, 384 78, 498 34"
                          stroke="url(#evPedestalRibbon)"
                          strokeWidth="10"
                          strokeLinecap="round"
                        />
                        <path
                          d="M42 48 C144 77, 378 74, 480 37"
                          stroke="rgba(255,255,255,0.76)"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* FLOATING 3D GLASS FILMSTRIP DOCK (All 4 Real Photos, Tactile 3D Lift) */}
                {thumbnails.length > 1 && (
                  <div className="relative z-30 -mt-3 sm:-mt-4 flex justify-center">
                    <div
                      role="tablist"
                      aria-label="Chọn ảnh trang trí sự kiện"
                      className="hn-scroll-rail inline-flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 rounded-[24px] bg-white/76 backdrop-blur-xl border border-white/95 shadow-[0_20px_42px_-18px_rgba(68,22,48,0.34),inset_0_1px_1px_rgba(255,255,255,0.95)]"
                    >
                      {thumbnails.map((thumb, idx) => {
                        const isSelected = idx === safeIndex;
                        return (
                          <div
                            key={`${thumb.image}-${idx}`}
                            className="ev-thumb-card shrink-0"
                          >
                            <button
                              type="button"
                              role="tab"
                              aria-selected={isSelected}
                              aria-label={`Chọn ảnh trưng bày ${idx + 1}: ${thumb.title}`}
                              onClick={() => setActiveIndex(idx)}
                              className={`group relative w-[64px] h-[54px] sm:w-[78px] sm:h-[62px] rounded-[15px] p-[3px] transition-all duration-250 cursor-pointer ${
                                isSelected
                                  ? '-translate-y-1.5 scale-[1.06] bg-gradient-to-b from-[#F472A8] to-[#D62E6E] shadow-[0_14px_26px_-10px_rgba(214,46,110,0.62)]'
                                  : 'bg-white/90 hover:-translate-y-1 hover:bg-white shadow-[0_8px_18px_-10px_rgba(68,22,48,0.28)]'
                              }`}
                            >
                              <div className="relative w-full h-full rounded-[12px] overflow-hidden bg-[#FFF6F9]">
                                <SafeImage
                                  src={thumb.image}
                                  alt={thumb.title}
                                  preset="thumbnail"
                                  objectFit="cover"
                                  className={`w-full h-full object-cover object-center transition-all duration-300 ${
                                    isSelected
                                      ? 'scale-105 brightness-105'
                                      : 'brightness-[0.92] group-hover:brightness-100 group-hover:scale-105'
                                  }`}
                                />
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* =================================================================
              FLOATING GLASSMORPHISM SERVICE BAR (ALIGNED TO MAX-W-7XL AXIS)
             ================================================================= */}
          <div
            ref={serviceBarRef}
            className="mt-8 sm:mt-10 lg:mt-12 w-full rounded-[24px] sm:rounded-[28px] bg-white/86 backdrop-blur-xl border border-white/95 shadow-[0_18px_44px_-22px_rgba(92,34,64,0.22)] px-4 sm:px-6 lg:px-7 py-4 sm:py-5"
          >
            <div className="grid grid-cols-1 min-[480px]:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 lg:gap-0 lg:divide-x lg:divide-[#F2DCE6]">
              {FLOATING_SERVICE_ITEMS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={() => scrollToAnchor(item.targetId)}
                    className={`group flex items-center gap-3.5 text-left min-h-[48px] rounded-2xl lg:rounded-none py-1 transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer ${
                      idx > 0 ? 'lg:pl-5' : ''
                    } ${idx < FLOATING_SERVICE_ITEMS.length - 1 ? 'lg:pr-5' : ''}`}
                  >
                    <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFF0F6] to-[#F2F8FF] border border-[#F5D0E0] flex items-center justify-center shrink-0 text-[#DF3E7C] transition-transform duration-200 group-hover:scale-105 group-hover:-rotate-3">
                      <Icon className="w-[19px] h-[19px]" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13.5px] font-semibold text-[#1B3B35] group-hover:text-[#C82867] transition-colors leading-snug">
                        {item.title}
                      </span>
                      <span className="block text-[12px] text-[#55696E] leading-snug mt-0.5">
                        {item.subtitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          NATURAL WHITE TRANSITION SECTION - "KHÁM PHÁ DỊCH VỤ CỦA HOA NELLY"
         ===================================================================== */}
      <section
        ref={discoverSectionRef}
        className="relative bg-gradient-to-b from-white via-[#FFFDFC] to-[#FDFBF7] hn-section"
      >
        <div className="hn-container">
          {/* Decorative Pink Bow + Botanical Dark-Green Editorial Heading */}
          <div className="ev-discover-head text-center space-y-2.5 mb-8 sm:mb-10">
            <div className="flex items-center justify-center gap-3" aria-hidden="true">
              <span className="w-8 h-[1.5px] rounded-full bg-[#E86D9E]/65" />
              <svg viewBox="0 0 46 24" fill="none" className="w-10 h-5 text-[#E1467F]">
                <path
                  d="M23 11 C17 3, 6 4, 7 11 C8 17, 17 15, 23 11 Z"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  fill="#FDE4EE"
                />
                <path
                  d="M23 11 C29 3, 40 4, 39 11 C38 17, 29 15, 23 11 Z"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  fill="#FDE4EE"
                />
                <path d="M21 12 L15 22" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                <path d="M25 12 L31 22" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                <circle cx="23" cy="11" r="2.6" fill="currentColor" />
              </svg>
              <span className="w-8 h-[1.5px] rounded-full bg-[#E86D9E]/65" />
            </div>

            <div className="flex items-center justify-center gap-4">
              <span aria-hidden="true" className="hidden sm:block w-14 h-[1px] bg-[#1B3B35]/35" />
              <h2 className="font-serif font-semibold text-[26px] sm:text-[34px] text-[#1B3B35] tracking-[-0.01em]">
                Khám phá dịch vụ của Hoa Nelly
              </h2>
              <span aria-hidden="true" className="hidden sm:block w-14 h-[1px] bg-[#1B3B35]/35" />
            </div>
          </div>

          {/* 4 Soft Pastel Floating Service Cards */}
          <div className="hn-grid-4">
            {discoverCards.map((card) => {
              const cardContent = (
                <div
                  className={`ev-discover-card group h-full flex items-center justify-between gap-3.5 px-4 sm:px-5 py-4 rounded-[28px] bg-gradient-to-br ${card.tint} backdrop-blur-md border ${card.ring} shadow-[0_14px_34px_-22px_rgba(128,48,86,0.28)] hover:shadow-[0_22px_40px_-18px_rgba(216,46,110,0.32)] hover:-translate-y-1.5 hover:border-[#EC8CB3] transition-all duration-300`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-16 h-16 rounded-[20px] bg-white p-1 border border-white shadow-[0_10px_20px_-12px_rgba(116,42,78,0.28)] shrink-0 overflow-hidden">
                      {card.image ? (
                        <SafeImage
                          src={card.image}
                          alt={`${card.title} ${card.line2}`}
                          preset="thumbnail"
                          objectFit="cover"
                          wrapperClassName="w-full h-full rounded-[15px]"
                          className="w-full h-full object-cover object-center rounded-[15px] transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full rounded-[15px] bg-[#FFF0F6]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-serif font-semibold text-[16.5px] leading-[1.28] text-[#1B3B35] group-hover:text-[#C82867] transition-colors">
                        {card.title}
                        <br />
                        {card.line2}
                      </p>
                    </div>
                  </div>

                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-full bg-white/95 border border-[#F3CBE0] text-[#D8397B] flex items-center justify-center shrink-0 shadow-xs transition-all duration-200 group-hover:bg-[#DF3E7C] group-hover:text-white group-hover:border-[#DF3E7C] group-hover:translate-x-0.5"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>
              );

              if (card.anchorId) {
                return (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => scrollToAnchor(card.anchorId!)}
                    className="text-left w-full cursor-pointer"
                  >
                    {cardContent}
                  </button>
                );
              }

              return (
                <Link key={card.title} to={card.to || '/san-pham'} className="block w-full">
                  {cardContent}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
