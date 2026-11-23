import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Flower2, Palette, Truck } from 'lucide-react';
import { ScrollReveal } from '../components/CinematicScroll.tsx';
import { useBackgroundVideo } from '../hooks/useBackgroundVideo.ts';
import { MOTION_CONFIG, gsap, useGSAP } from '../lib/motionConfig.ts';
import { usePageMeta } from '../lib/format.ts';

// Responsive H.264 faststart companions (mobile 432p / desktop 720p + fallback)
const ABOUT_BG_VIDEO_DESKTOP_SRC = '/assets/aistudio/hero_bg_desktop.mp4';
const ABOUT_BG_VIDEO_MOBILE_SRC = '/assets/aistudio/hero_bg_mobile.mp4';
const ABOUT_BG_VIDEO_FALLBACK_SRC = '/assets/aistudio/hero_bg_web.mp4';
const ABOUT_BG_VIDEO_POSTER_DESKTOP = '/assets/aistudio/hero_video_poster_opt.webp';
const ABOUT_BG_VIDEO_POSTER_MOBILE = '/assets/aistudio/hero_video_poster_mobile.webp';
// True alpha-channel transparent 3D floral cutout (responsive WebP variants)
const ABOUT_FLORAL_3D_560 = '/assets/aistudio/about_floral_3d_560.webp';
const ABOUT_FLORAL_3D_860 = '/assets/aistudio/about_floral_3d_860.webp';
const ABOUT_FLORAL_3D_SRC = '/assets/aistudio/about_floral_3d.webp';
// True alpha-channel transparent 3D headline typography (responsive WebP variants)
const ABOUT_HEADLINE_3D_640 = '/assets/aistudio/about_headline_3d_640.webp';
const ABOUT_HEADLINE_3D_1040 = '/assets/aistudio/about_headline_3d_1040.webp';
const ABOUT_HEADLINE_3D_SRC = '/assets/aistudio/about_headline_3d.webp';

const BRAND_PILLARS = [
  {
    icon: Flower2,
    title: 'Tạo hình thủ công tỉ mỉ',
    desc: 'Chăm chút từng nếp xoắn, nâng niu từng chi tiết để giữ phom tròn đầy khi trao tay.',
  },
  {
    icon: Palette,
    title: 'Bảng màu tinh tế, gần gũi',
    desc: 'Phối sắc nhẹ nhàng, hài hòa giữa pastel và kem sữa trong từng món quà kỷ niệm.',
  },
  {
    icon: Truck,
    title: 'Minh bạch từ tư vấn đến giao nhận',
    desc: 'Rõ ràng mọi tùy chọn, chi phí và thời gian chuẩn bị để bạn yên tâm khi gửi tặng.',
  },
];

export function AboutPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const heroSectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const floralTiltRef = useRef<HTMLDivElement>(null);

  usePageMeta(
    'Về Hoa Nelly – Hoa Bóng Bay Nghệ Thuật & Quà Tặng',
    'Câu chuyện về sự chăm chút thủ công, bảng màu tinh tế và trải nghiệm tặng quà đáng nhớ tại Hoa Nelly.'
  );

  const { inView, isMobileViewport, reducedMotion } = useBackgroundVideo(videoRef, heroSectionRef);
  const aboutVideoSrc = isMobileViewport
    ? ABOUT_BG_VIDEO_MOBILE_SRC
    : ABOUT_BG_VIDEO_DESKTOP_SRC;
  const aboutPosterSrc = isMobileViewport
    ? ABOUT_BG_VIDEO_POSTER_MOBILE
    : ABOUT_BG_VIDEO_POSTER_DESKTOP;

  // Gentle entrance reveal + subtle desktop fine-pointer 3D tilt strictly on the floral cluster
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: MOTION_CONFIG.media.reducedMotion,
          finePointerDesktop: MOTION_CONFIG.media.desktopFinePointer,
        },
        (context) => {
          const { reduceMotion, finePointerDesktop } = context.conditions || {};
          if (reduceMotion) return;

          // Subtle entrance for left copy and right 3D floral cluster
          gsap.from('.hn-about-stagger', {
            y: 18,
            opacity: 0,
            duration: 0.72,
            stagger: 0.08,
            ease: MOTION_CONFIG.eases.primary,
            clearProps: 'transform,opacity',
          });

          gsap.from('.hn-about-floral-enter', {
            y: 22,
            scale: 0.975,
            opacity: 0,
            duration: 0.9,
            delay: 0.12,
            ease: MOTION_CONFIG.eases.primary,
            clearProps: 'transform,opacity',
          });

          // Very light interactive tilt strictly on the 3D floral cutout wrapper (never text/buttons)
          const heroEl = heroSectionRef.current;
          const tiltEl = floralTiltRef.current;
          if (!finePointerDesktop || !heroEl || !tiltEl) return;

          const rotXTo = gsap.quickTo(tiltEl, 'rotationX', {
            duration: 0.65,
            ease: 'power2.out',
          });
          const rotYTo = gsap.quickTo(tiltEl, 'rotationY', {
            duration: 0.65,
            ease: 'power2.out',
          });
          const xTo = gsap.quickTo(tiltEl, 'x', {
            duration: 0.75,
            ease: 'power2.out',
          });

          let cachedRect: DOMRect | null = null;
          const invalidateRect = () => {
            cachedRect = null;
          };
          const handlePointerEnter = () => {
            cachedRect = heroEl.getBoundingClientRect();
          };

          const handlePointerMove = (e: PointerEvent) => {
            const rect = cachedRect || (cachedRect = heroEl.getBoundingClientRect());
            if (!rect.width || !rect.height) return;
            const nx = (e.clientX - rect.left) / rect.width - 0.5;
            const ny = (e.clientY - rect.top) / rect.height - 0.5;
            rotYTo(nx * 5.2); // max ±2.6deg
            rotXTo(-ny * 4.4); // max ±2.2deg
            xTo(nx * 8);
          };

          const handlePointerLeave = () => {
            cachedRect = null;
            rotXTo(0);
            rotYTo(0);
            xTo(0);
          };

          heroEl.addEventListener('pointerenter', handlePointerEnter);
          heroEl.addEventListener('pointermove', handlePointerMove);
          heroEl.addEventListener('pointerleave', handlePointerLeave);
          window.addEventListener('resize', invalidateRect, { passive: true });
          window.addEventListener('scroll', invalidateRect, { passive: true });

          return () => {
            heroEl.removeEventListener('pointerenter', handlePointerEnter);
            heroEl.removeEventListener('pointermove', handlePointerMove);
            heroEl.removeEventListener('pointerleave', handlePointerLeave);
            window.removeEventListener('resize', invalidateRect);
            window.removeEventListener('scroll', invalidateRect);
            gsap.set(tiltEl, { clearProps: 'transform' });
          };
        }
      );
    },
    { scope: pageRef }
  );

  return (
    <div ref={pageRef} className="w-full overflow-x-clip bg-[#FFF9FB]">
      {/* ====================================================================
          HERO: Existing Looping Video Background + Transparent 3D Floral Cutout
         ==================================================================== */}
      <section
        ref={heroSectionRef}
        className={`relative isolate -mt-[64px] sm:-mt-[74px] pt-[80px] sm:pt-[98px] lg:pt-[108px] pb-12 sm:pb-16 lg:pb-[70px] bg-[#FCEFF4] ${
          !inView ? 'hn-motion-paused' : ''
        }`}
      >
        {/* Layer 0 (z-0): Responsive looping video background with lightweight poster & off-screen pause */}
        <div
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
          aria-hidden="true"
        >
          <video
            key={aboutVideoSrc}
            ref={videoRef}
            poster={aboutPosterSrc}
            autoPlay={!reducedMotion}
            loop
            muted
            playsInline
            preload={reducedMotion ? 'none' : 'metadata'}
            tabIndex={-1}
            className="w-full h-full object-cover object-center scale-[1.01]"
          >
            <source src={aboutVideoSrc} type="video/mp4" />
            <source src={ABOUT_BG_VIDEO_FALLBACK_SRC} type="video/mp4" />
          </video>
        </div>

        {/* Layer 1 (z-[1]): Soft directional pastel-pink/white readability veil
            Stronger behind the left copy for effortless contrast; sheer on the right
            so the moving video stays clearly visible behind and around the 3D floral cluster. */}
        <div
          className="absolute inset-0 z-[1] pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(96deg, rgba(255, 250, 252, 0.90) 0%, rgba(255, 246, 250, 0.80) 36%, rgba(253, 236, 243, 0.38) 64%, rgba(252, 231, 240, 0.22) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-28 z-[1] pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 249, 252, 0.56) 0%, rgba(255, 249, 252, 0) 100%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-24 z-[1] pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, rgba(251, 234, 240, 0) 0%, rgba(251, 234, 240, 0.92) 100%)',
          }}
        />

        {/* Foreground Grid: Mobile order = Heading + Opening Lead -> 3D Floral Cluster -> Remaining Story + CTA
            Desktop (lg+) = Left column (Heading + Full Story + CTA) | Right column (3D Floral Cluster + Caption) */}
        <div className="relative hn-container">
          <div className="hn-grid-12 gap-y-6 lg:gap-y-4 items-center">
            {/* Block A: Eyebrow + Headline + Opening Lead */}
            <div className="lg:col-span-5 lg:col-start-1 lg:row-start-1 lg:self-end relative z-[3] space-y-4 sm:space-y-5">
              <p className="hn-about-stagger text-[12px] sm:text-[12.5px] uppercase tracking-[0.14em] font-semibold text-[#B23860]">
                Về thương hiệu Hoa Nelly
              </p>

              <h1 className="hn-about-stagger">
                <span className="sr-only">
                  Chăm chút từng cánh hoa bóng bay để khoảnh khắc trao quà thêm trọn vẹn.
                </span>
                <picture>
                  <source
                    srcSet={`${ABOUT_HEADLINE_3D_640} 640w, ${ABOUT_HEADLINE_3D_1040} 1040w, ${ABOUT_HEADLINE_3D_SRC} 1538w`}
                    sizes="(max-width: 640px) 92vw, 520px"
                    type="image/webp"
                  />
                  <img
                    src={ABOUT_HEADLINE_3D_1040}
                    alt=""
                    aria-hidden="true"
                    width={1538}
                    height={820}
                    decoding="async"
                    fetchPriority="high"
                    draggable={false}
                    className="block w-full max-w-[460px] sm:max-w-[500px] lg:max-w-[520px] h-auto object-contain select-none pointer-events-none"
                  />
                </picture>
              </h1>

              <div
                className="hn-about-stagger w-11 h-[1.5px] bg-[#B23860]/75 rounded-full"
                aria-hidden="true"
              />

              <p className="hn-about-stagger text-[15px] sm:text-[15.5px] text-[#334652] leading-[1.72] max-w-[490px]">
                Hoa Nelly mang đến góc nhìn mới mẻ cho nghệ thuật tặng quà: những bó hoa bóng bay
                tạo hình thủ công mềm mại, những nhân vật nhỏ nhắn đáng yêu và các góc trang trí
                sự kiện phối màu dịu mắt.
              </p>
            </div>

            {/* Block B: Transparent 3D Floral Frames & Pedestal over moving video (2nd on mobile, right column on desktop) */}
            <div className="lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-span-2 lg:self-center relative z-[2] flex flex-col items-center lg:items-end hn-perspective">
              <div
                ref={floralTiltRef}
                className="hn-about-floral-enter relative w-full max-w-[520px] sm:max-w-[610px] lg:max-w-[690px] hn-preserve-3d"
              >
                {/* 3 unmodified flying butterflies in the upper-right open sky pocket */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute inset-0 z-10 overflow-visible"
                  style={{ transform: 'translateZ(24px)' }}
                >
                  {/* Main butterfly hovering in the central upper-right clouds */}
                  <div className="hn-butterfly-flight hn-butterfly-interactive absolute top-[4%] sm:top-[3%] right-[16%] sm:right-[18%] w-[138px] sm:w-[172px] lg:w-[202px]">
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

                  {/* Medium companion butterfly drifting toward the lead butterfly */}
                  <div
                    className="hn-butterfly-flight-alt hn-butterfly-interactive absolute top-[22%] sm:top-[21%] -right-[2%] sm:right-0 w-[106px] sm:w-[134px] lg:w-[154px]"
                    style={{ animationDelay: '-2.1s' }}
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
                          style={{ animationDelay: '-0.55s' }}
                        />
                      </picture>
                    </div>
                  </div>

                  {/* Smaller upper-right butterfly gliding high in the clouds */}
                  <div
                    className="hn-butterfly-flight-glide hn-butterfly-interactive absolute -top-[2%] sm:-top-[3%] right-[2%] sm:right-[4%] w-[84px] sm:w-[104px] lg:w-[120px]"
                    style={{ animationDelay: '-4.2s' }}
                  >
                    <div className="rotate-[10deg]">
                      <picture>
                        <source srcSet="/assets/aistudio/butterfly_web.webp" type="image/webp" />
                        <img
                          src="/assets/aistudio/image_24ff80ce.png"
                          alt=""
                          width={1671}
                          height={941}
                          decoding="async"
                          draggable={false}
                          className="block w-full h-auto object-contain hn-butterfly-wingbeat-fast"
                          style={{ animationDelay: '-0.25s' }}
                        />
                      </picture>
                    </div>
                  </div>
                </div>

                <div className="hn-about-float">
                  <picture>
                    <source
                      srcSet={`${ABOUT_FLORAL_3D_560} 560w, ${ABOUT_FLORAL_3D_860} 860w, ${ABOUT_FLORAL_3D_SRC} 892w`}
                      sizes="(max-width: 640px) 92vw, (max-width: 1024px) 610px, 690px"
                      type="image/webp"
                    />
                    <img
                      src={ABOUT_FLORAL_3D_860}
                      alt="Hai bó hoa bóng bay nghệ thuật trong khung 3D màu hồng phấn đặt trên bệ trưng bày Hoa Nelly"
                      width={892}
                      height={654}
                      decoding="async"
                      fetchPriority="high"
                      draggable={false}
                      className="w-full h-auto object-contain select-none pointer-events-none"
                    />
                  </picture>
                </div>
              </div>

              {/* High-contrast frosted caption pill so text remains effortlessly legible over any video frame */}
              <p className="hn-about-stagger mt-2 lg:self-start lg:ml-14 inline-flex items-center px-3.5 py-1 rounded-full bg-white/78 backdrop-blur-sm border border-white/90 font-serif italic text-[14px] sm:text-[15px] text-[#6B2740] shadow-[0_6px_18px_-12px_rgba(107,39,64,0.35)]">
                Từ đôi tay, gửi đến trái tim.
              </p>
            </div>

            {/* Block C: Remaining Brand Story + Primary CTA (after 3D visual on mobile, left row 2 on desktop) */}
            <div className="lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:self-start relative z-[3] space-y-5">
              <p className="hn-about-stagger text-[15px] sm:text-[15.5px] text-[#334652] leading-[1.72] max-w-[490px]">
                Mỗi bó hoa đều bắt đầu từ sự lắng nghe - người nhận yêu sắc màu nào, buổi tiệc
                mang không khí ra sao, và câu chúc nào bạn muốn gửi gắm. Thay vì sao chép rập
                khuôn, Hoa Nelly chú trọng cân đối tỷ lệ cánh hoa, chiếc nơ vừa vặn và tấm thiệp
                chỉn chu để món quà thật sự có dấu ấn riêng.
              </p>

              <div className="hn-about-stagger pt-0.5">
                <Link
                  to="/san-pham"
                  className="group inline-flex items-center justify-center gap-2.5 w-full min-[420px]:w-auto min-h-[48px] px-6 py-3 rounded-xl border border-[#B23860]/65 bg-white/86 backdrop-blur-[8px] text-[#9E2B53] text-[14.5px] font-semibold shadow-[0_10px_24px_-14px_rgba(178,56,96,0.38)] hover:bg-[#FBEAF0] hover:border-[#B23860] hover:text-[#7A1D3E] active:scale-[0.985] transition-all duration-200"
                >
                  <span>Khám phá bộ sưu tập</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          BRAND PILLARS: Soft Pastel-Pink Horizontal Strip matching reference
         ==================================================================== */}
      <section className="relative z-[3] bg-[#FBEAF0] border-y border-[#F4CEDB]">
        <div className="hn-container py-12 sm:py-12">
          <ScrollReveal
            staggerSelector=".hn-about-pillar"
            once
            y={16}
            stagger={0.08}
            className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#EDC8D6]"
          >
            {BRAND_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="hn-about-pillar flex items-start gap-4 py-5 first:pt-0 last:pb-0 md:py-1 md:px-7 md:first:pl-0 md:last:pr-0"
                >
                  <div className="shrink-0 mt-0.5 text-[#B23860]" aria-hidden="true">
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.35} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-serif text-[18.5px] sm:text-[19.5px] leading-snug font-semibold text-[#172B35]">
                      {pillar.title}
                    </h2>
                    <p className="text-[13.5px] sm:text-[14px] text-[#4C5B66] leading-relaxed">
                      {pillar.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </ScrollReveal>
        </div>
      </section>

      {/* ====================================================================
          EXISTING BOTTOM CTA: Preserved & Harmonized in Pastel-Pink Palette
         ==================================================================== */}
      <section className="hn-container hn-section">
        <ScrollReveal once y={18}>
          <div className="rounded-2xl bg-[#FFF3F7] border border-[#F4CEDB] p-7 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_14px_34px_-24px_rgba(178,56,96,0.28)]">
            <div className="max-w-xl space-y-2">
              <h2 className="font-serif text-2xl sm:text-[26px] font-semibold text-[#172B35]">
                Sẵn sàng chuẩn bị món quà tiếp theo cùng Hoa Nelly?
              </h2>
              <p className="text-sm sm:text-[15px] text-[#4C5B66] leading-relaxed">
                Chọn ngay một mẫu yêu thích hoặc gửi cho chúng tôi ý tưởng thiết kế riêng của bạn.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <Link
                to="/san-pham"
                className="inline-flex items-center justify-center min-h-[44px] gap-2 px-5 py-3 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] transition-colors"
              >
                <span>Xem sản phẩm</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/dat-thiet-ke-rieng"
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-3 rounded-xl border border-[#B23860]/55 bg-white text-[#9E2B53] text-sm font-semibold hover:bg-[#FBEAF0] transition-colors"
              >
                Đặt thiết kế riêng
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
}
