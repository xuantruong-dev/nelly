import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Star } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { ProductCard } from '../components/ProductCard.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import { HeroScene3D } from '../components/HeroScene3D.tsx';
import { CollectionStage3D } from '../components/CollectionStage3D.tsx';
import type { ShowcaseCollection } from '../components/CollectionStage3D.tsx';
import { RibbonDivider } from '../components/RibbonMotif.tsx';
import { CinematicFrame, CinematicHeading, ScrollReveal } from '../components/CinematicScroll.tsx';
import { formatDateVi, usePageMeta } from '../lib/format.ts';
import { MOTION_CONFIG, ScrollTrigger, gsap, useGSAP } from '../lib/motionConfig.ts';

const CUSTOM_FLOW_POINTS = [
  {
    title: 'Kể cho Nelly nghe về người nhận',
    desc: 'Chọn kiểu bó hoa, nhân vật yêu thích, bảng màu dịu mắt hay nổi bật và ngày bạn cần tặng.',
  },
  {
    title: 'Gửi lời nhắn & ảnh tham khảo',
    desc: 'Đính kèm ảnh mẫu bạn thích, tên cần dán lên bóng hoặc lời chúc để Nelly chuẩn bị thiệp đi kèm.',
  },
  {
    title: 'Chốt phương án và mức giá rõ ràng',
    desc: 'Cửa hàng trao đổi chi tiết phụ kiện, thời gian làm và báo giá trọn gói trước khi bắt tay thực hiện.',
  },
  {
    title: 'Tạo hình tỉ mỉ sát giờ hẹn',
    desc: 'Bó hoa được hoàn thiện gần sát khung giờ giao để giữ phom tròn căng khi đến tay người nhận.',
  },
];

const EVENT_SERVICES = [
  {
    title: 'Trang trí sinh nhật tại nhà & nhà hàng',
    desc: 'Phối màu hài hòa theo độ tuổi, gọn gàng cho bàn tiệc gia đình, quán café hoặc phòng tiệc riêng.',
  },
  {
    title: 'Backdrop & góc chụp ảnh kỷ niệm',
    desc: 'Phông nền tên nhân vật chính kết hợp cụm bóng tạo hình thủ công tạo điểm nhấn rõ nét khi chụp ảnh.',
  },
  {
    title: 'Cổng chào & cụm bóng lối vào',
    desc: 'Kết cấu đứng vững, phù hợp cho lễ khai trương, sự kiện cửa hàng hoặc tiệc đón khách.',
  },
  {
    title: 'Cụm hoa bóng trang trí bàn gallery',
    desc: 'Hoa bóng bay chân đế mica và phụ kiện đồng bộ cho bàn bánh kem, bàn quà hoặc quầy lễ tân.',
  },
];

export function HomePage() {
  const {
    loading,
    error,
    settings,
    categories,
    occasions,
    featuredProducts,
    recentReviews,
    refreshBootstrap,
  } = useStore();
  const [openFaqId, setOpenFaqId] = useState<string | null>('faq-order');
  const pageRef = useRef<HTMLDivElement>(null);

  usePageMeta(
    'Hoa Nelly – Hoa bóng bay nghệ thuật, tạo hình nhân vật & quà tặng',
    'Hoa bóng bay, làm theo ý bạn. Chọn mẫu bạn thích hoặc gửi Nelly màu sắc, lời nhắn và ngày bạn muốn nhận.'
  );

  // Subtle ribbon stroke draw-in when editorial divider enters viewport
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        { reduceMotion: MOTION_CONFIG.media.reducedMotion },
        (context) => {
          if (context.conditions?.reduceMotion) return;
          const strokes = gsap.utils.toArray<SVGPathElement>('.hn-ribbon-stroke');
          strokes.forEach((path) => {
            const len = path.getTotalLength();
            gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
            gsap.to(path, {
              strokeDashoffset: 0,
              duration: 0.9,
              ease: MOTION_CONFIG.eases.soft,
              scrollTrigger: {
                trigger: path,
                start: 'top 90%',
                once: true,
              },
            });
          });
        }
      );
      if (!loading) {
        requestAnimationFrame(() => ScrollTrigger.refresh());
      }
    },
    { scope: pageRef, dependencies: [loading] }
  );

  // Build the 4 featured occasions for the dedicated 3D Collection Showcase
  const showcaseCollections = useMemo<ShowcaseCollection[]>(() => {
    const findOcc = (slug: string) => occasions.find((o) => o.slug === slug);
    const eventCat = categories.find((c) => c.slug === 'trang-tri-su-kien');

    const birthday = findOcc('sinh-nhat');
    const graduation = findOcc('tot-nghiep');
    const lovedOne = findOcc('qua-tang-nguoi-thuong') || findOcc('ky-niem');
    const eventOcc = findOcc('su-kien-tiec');

    return [
      {
        slug: 'sinh-nhat',
        label: 'Sinh nhật',
        headline: 'Trang trí sinh nhật & bó hoa tặng ngày thêm tuổi mới',
        description:
          'Từ bó tulip màu kem đào đến túi quà Happy Birthday rực rỡ, bạn có thể chọn lại màu nơ, ghi lời chúc riêng và thêm bóng số tuổi.',
        prepHint: 'Đặt trước 6–12 giờ',
        imageUrl: birthday?.image_url || featuredProducts[0]?.images[0] || '',
        ctaPath: '/bo-suu-tap/sinh-nhat',
        ctaLabel: 'Xem mẫu sinh nhật',
      },
      {
        slug: 'tot-nghiep',
        label: 'Tốt nghiệp',
        headline: 'Tạo hình cử nhân & hoa chúc mừng ước mơ mới',
        description:
          'Nhân vật cử nhân bóng bay cầm tay nhỏ gọn hoặc bó hoa kết hợp nơ ánh kim, giữ phom đẹp suốt buổi lễ chụp ảnh cùng bạn bè và gia đình.',
        prepHint: 'Đặt trước 12–24 giờ',
        imageUrl: graduation?.image_url || featuredProducts[1]?.images[0] || '',
        ctaPath: '/bo-suu-tap/tot-nghiep',
        ctaLabel: 'Xem quà tốt nghiệp',
      },
      {
        slug: 'qua-tang-nguoi-thuong',
        label: 'Quà tặng người thương',
        headline: 'Quà tặng yêu thương gửi đúng sắc màu người ấy thích',
        description:
          'Những bó hoa hồng xoắn cánh, cúc họa mi hay tulip mềm mại đi kèm thiệp viết tay và tùy chọn ẩn giá khi gửi tặng bất ngờ.',
        prepHint: 'Có tùy chọn ẩn giá',
        imageUrl: lovedOne?.image_url || featuredProducts[2]?.images[0] || '',
        ctaPath: '/bo-suu-tap/qua-tang-nguoi-thuong',
        ctaLabel: 'Xem quà tặng người thương',
      },
      {
        slug: 'trang-tri-su-kien',
        label: 'Trang trí sự kiện',
        headline: 'Backdrop, cụm bóng & góc chụp ảnh cho buổi tiệc riêng',
        description:
          'Phù hợp cho tiệc gia đình, khai trương hoặc góc chụp ảnh thương hiệu. Gửi diện tích và tông màu để Nelly lên phương án kèm báo giá rõ từng hạng mục.',
        prepHint: 'Tư vấn & báo giá riêng',
        imageUrl: eventCat?.image_url || eventOcc?.image_url || featuredProducts[3]?.images[0] || '',
        ctaPath: '/trang-tri-su-kien',
        ctaLabel: 'Gửi yêu cầu báo giá',
      },
    ].filter((c) => Boolean(c.imageUrl));
  }, [occasions, categories, featuredProducts]);

  if (loading) {
    return (
      <div className="hn-page-shell">
        <div className="hn-grid-12 items-center animate-pulse">
          <div className="lg:col-span-6 space-y-5">
            <div className="h-4 w-48 bg-[#EFECE4] rounded" />
            <div className="h-16 w-full bg-[#EFECE4] rounded" />
            <div className="h-20 w-5/6 bg-[#F8F5EE] rounded" />
          </div>
          <div className="lg:col-span-6 aspect-[4/5] max-w-md mx-auto w-full bg-[#F8F5EE] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-5 py-12 sm:py-20 text-center space-y-4">
        <h1 className="font-serif text-2xl font-medium text-[#14222E]">
          Chưa thể tải dữ liệu cửa hàng
        </h1>
        <p className="text-[15px] text-[#4A5C6B]">{error}</p>
        <button
          type="button"
          onClick={() => refreshBootstrap()}
          className="hn-btn-primary px-5 py-2.5 text-sm font-semibold"
        >
          Thử tải lại
        </button>
      </div>
    );
  }

  const rawHeroTitle = settings?.hero_title?.trim();
  const heroTitle =
    !rawHeroTitle || rawHeroTitle === 'Một món quà xinh, gửi trọn điều muốn nói.'
      ? 'Hoa bóng bay, làm theo ý bạn.'
      : rawHeroTitle;

  const rawHeroSubtitle = settings?.hero_subtitle?.trim();
  const heroSubtitle =
    !rawHeroSubtitle ||
    rawHeroSubtitle.startsWith('Khám phá hoa bóng bay nghệ thuật, tạo hình nhân vật')
      ? 'Thiết kế & thi công hoa bóng bay theo yêu cầu, phù hợp mọi dịp đặc biệt.'
      : rawHeroSubtitle;

  const detailFeatureImg =
    featuredProducts[2]?.images[0] || settings?.hero_image_url || '';
  const detailCloseImg1 =
    featuredProducts[4]?.images[0] || settings?.hero_secondary_image_url || '';
  const detailCloseImg2 =
    featuredProducts[1]?.images[0] || categories[1]?.image_url || '';

  return (
    <div ref={pageRef}>
      {/* 1 & 2. Signature Pinned Bridge ("Bó hoa mở lối"): Hero -> 5 Product Categories */}
      <HeroScene3D
        title={heroTitle}
        subtitle={heroSubtitle}
        primaryImage={settings?.hero_image_url}
        secondaryImage={settings?.hero_secondary_image_url}
        categories={categories}
      />

      {/* 3. Interactive 3D Occasion Collection Stage (Enter -> Hold -> Exit + 3D switcher) */}
      <CollectionStage3D items={showcaseCollections} />

      {/* 4. Curated Products Grid - Steady Layout for Easy Comparison (no exit fade) */}
      <section className="bg-[#FDFBF7] border-b border-[#EFECE4] hn-section">
        <div className="hn-container">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-9">
            <div className="max-w-2xl">
              <p className="text-[14px] text-[#006A9E] font-medium mb-1">
                Mẫu hoa được chọn nhiều · Giá hiển thị rõ theo từng cấu hình
              </p>
              <CinematicHeading
                as="h2"
                className="font-serif font-medium text-[28px] sm:text-[36px] text-[#14222E]"
              >
                Hoa bóng bay &amp; quà tặng nổi bật
              </CinematicHeading>
            </div>
            <Link
              to="/san-pham"
              className="min-h-[44px] sm:min-h-0 text-[14px] font-medium text-[#006A9E] hover:underline underline-offset-4 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <span>Xem tất cả sản phẩm</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>

          <ScrollReveal
            staggerSelector=".hn-product-card"
            once
            y={20}
            stagger={0.055}
            className="hn-grid-4"
          >
            {featuredProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ScrollReveal>
        </div>
      </section>

      <div className="bg-[#FDFBF7] pt-8 sm:pt-10">
        <RibbonDivider />
      </div>

      {/* 5. Large Visual Spread - Craftsmanship Details & Practical Buyer Guide */}
      <section className="hn-container hn-section">
        <div className="hn-grid-12 items-start">
          {/* Large Showcase Photo */}
          <div className="lg:col-span-7 space-y-4">
            <CinematicFrame
              exitFade
              tilt3D
              className="aspect-[4/5] max-w-[520px] mx-auto rounded-2xl bg-[#F8F5EE] border border-[#EFECE4]"
            >
              <SafeImage
                src={detailFeatureImg}
                alt="Cận cảnh đường xoắn cánh hoa bóng bay và nơ ruy-băng tại Hoa Nelly"
                preset="detail"
                className="w-full h-full object-contain"
              />
            </CinematicFrame>
            <p className="text-[13.5px] text-[#4A5C6B]">
              Từng cánh hoa, nút thắt ruy-băng và cách phối màu được chăm chút thủ công theo bó hoa bạn chọn.
            </p>
          </div>

          {/* Right Editorial Details & Two Secondary Crops */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <p className="inline-flex items-center gap-2 text-[14px] font-medium text-[#006A9E] mb-1.5">
                <span className="w-3.5 h-[2px] bg-[#D83995] rounded-full" aria-hidden="true" />
                <span>Chăm chút từ nút thắt nhỏ</span>
              </p>
              <CinematicHeading
                as="h2"
                className="font-serif font-medium text-[26px] sm:text-[32px] text-[#14222E]"
              >
                Một bó hoa trọn vẹn gồm những gì?
              </CinematicHeading>
              <p className="text-[15.5px] text-[#4A5C6B] leading-[1.68] mt-3">
                Mỗi sản phẩm tại Hoa Nelly đều ghi rõ thành phần bóng, kích thước ước tính, phụ kiện đi kèm và phần bạn có thể đổi màu hoặc thêm chữ. Bạn không cần đoán xem giá đã gồm nơ hay thiệp chưa - mọi phụ phí đều hiện rõ ngay trước khi đặt.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <CinematicFrame
                radiusPx={12}
                className="aspect-[4/5] rounded-xl bg-[#F8F5EE] border border-[#EFECE4]"
              >
                <SafeImage
                  src={detailCloseImg1}
                  alt="Chi tiết phối màu bó hoa bóng bay"
                  preset="card"
                  className="w-full h-full object-cover"
                />
              </CinematicFrame>
              <CinematicFrame
                radiusPx={12}
                className="aspect-[4/5] rounded-xl bg-[#F8F5EE] border border-[#EFECE4]"
              >
                <SafeImage
                  src={detailCloseImg2}
                  alt="Tạo hình nhân vật và phụ kiện tặng quà Hoa Nelly"
                  preset="card"
                  className="w-full h-full object-cover"
                />
              </CinematicFrame>
            </div>

            <div className="pt-2 flex flex-wrap gap-5 text-[14px]">
              <Link
                to="/thu-vien"
                className="min-h-[44px] sm:min-h-0 font-medium text-[#006A9E] hover:underline underline-offset-4 inline-flex items-center gap-1.5"
              >
                <span>Xem thư viện hình ảnh</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                to="/gioi-thieu"
                className="min-h-[44px] sm:min-h-0 inline-flex items-center font-medium text-[#14222E] hover:text-[#006A9E] hover:underline underline-offset-4"
              >
                Tìm hiểu về Hoa Nelly
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Custom Design Section - Soft Pale-Beige Accent Section */}
      <section className="bg-[#F8F5EE] border-y border-[#EFECE4] hn-section">
        <div className="hn-container">
          <div className="hn-grid-12 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-[14px] text-[#006A9E] font-medium">Đặt theo yêu cầu</p>
              <CinematicHeading
                as="h2"
                className="font-serif font-medium text-[28px] sm:text-[36px] text-[#14222E]"
              >
                Có ý tưởng riêng? Nelly làm theo đúng màu và lời nhắn của bạn.
              </CinematicHeading>
              <p className="text-[16px] text-[#4A5C6B] leading-[1.68]">
                Nếu chưa thấy mẫu ưng ý trong danh mục, bạn chỉ cần gửi tông màu thích, nhân vật muốn tạo hình hoặc một tấm ảnh tham khảo. Hoa Nelly sẽ tư vấn cách làm vừa ngân sách và hẹn ngày nhận cụ thể.
              </p>
              <div className="pt-3">
                <Link
                  to="/dat-thiet-ke-rieng"
                  className="hn-btn-primary inline-flex items-center gap-2 px-6 py-3.5 text-[15px] font-semibold"
                >
                  <span>Gửi ý tưởng của bạn</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <ScrollReveal
              staggerSelector=".hn-reveal-item"
              once={false}
              y={18}
              stagger={0.075}
              className="lg:col-span-7 divide-y divide-[#D5C8A6] border-t border-[#D5C8A6]"
            >
              {CUSTOM_FLOW_POINTS.map((step) => (
                <div
                  key={step.title}
                  className="hn-reveal-item py-5 first:pt-5 grid sm:grid-cols-12 gap-2 sm:gap-6"
                >
                  <h3 className="sm:col-span-5 font-serif font-medium text-[19px] text-[#14222E]">
                    {step.title}
                  </h3>
                  <p className="sm:col-span-7 text-[15px] text-[#4A5C6B] leading-[1.65]">
                    {step.desc}
                  </p>
                </div>
              ))}
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 7. Event Decoration Services - Warm Beige with Soft Blush Accent Frame */}
      <section className="bg-[#FDFBF7] hn-section">
        <div className="hn-container">
          <div className="hn-grid-12 items-start">
            <div className="lg:col-span-5 space-y-5">
              <div>
                <p className="text-[14px] text-[#006A9E] font-medium mb-1">
                  Trang trí sự kiện &amp; tiệc riêng
                </p>
                <CinematicHeading
                  as="h2"
                  className="font-serif font-medium text-[28px] sm:text-[36px] text-[#14222E]"
                >
                  Dịch vụ trang trí sự kiện
                </CinematicHeading>
                <p className="text-[16px] text-[#4A5C6B] mt-3 leading-[1.68]">
                  Gửi ngày tổ chức, địa điểm và ảnh không gian thực tế để Hoa Nelly lên phương án và báo giá chi tiết từng hạng mục.
                </p>
              </div>

              <div className="relative p-3 sm:p-4 rounded-3xl bg-gradient-to-br from-[#F9E1E8]/80 via-[#F8F5EE]/75 to-[#FDFBF7] border border-[#EFECE4]">
                <CinematicFrame
                  exitFade
                  className="aspect-[4/5] max-w-[440px] mx-auto rounded-2xl border border-[#EFECE4] bg-[#FDFBF7]"
                >
                  <SafeImage
                    src={occasions[0]?.image_url}
                    alt="Ý tưởng trang trí tiệc và quà tặng Hoa Nelly"
                    preset="detail"
                    className="w-full h-full object-contain"
                  />
                </CinematicFrame>
              </div>

              <Link
                to="/trang-tri-su-kien"
                className="hn-btn-primary inline-flex items-center gap-2 px-6 py-3.5 text-[15px] font-semibold"
              >
                <span>Gửi yêu cầu báo giá</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>

          <ScrollReveal
            staggerSelector=".hn-reveal-item"
            once={false}
            y={18}
            stagger={0.075}
            className="lg:col-span-7 divide-y divide-[#EFECE4] border-y border-[#EFECE4]"
          >
            {EVENT_SERVICES.map((svc) => (
              <div key={svc.title} className="hn-reveal-item py-6">
                <h3 className="font-serif font-medium text-[20px] text-[#14222E]">{svc.title}</h3>
                <p className="text-[15px] text-[#4A5C6B] mt-1.5 leading-[1.65] max-w-[58ch]">
                  {svc.desc}
                </p>
              </div>
            ))}
          </ScrollReveal>
          </div>
        </div>
      </section>

      {/* 8. Real Customer Reviews & Photos (ONLY shown when published verified reviews exist) */}
      {recentReviews.length > 0 && (
        <section className="bg-[#FDFBF7] border-y border-[#EFECE4] hn-section">
          <div className="hn-container">
            <div className="mb-9">
              <p className="text-[14px] text-[#006A9E] font-medium mb-1">
                Đánh giá xác thực từ đơn hàng hoàn tất
              </p>
              <CinematicHeading
                as="h2"
                className="font-serif font-medium text-[28px] sm:text-[36px] text-[#14222E]"
              >
                Nhận xét &amp; ảnh khách gửi
              </CinematicHeading>
            </div>

            <ScrollReveal
              staggerSelector=".hn-reveal-item"
              once
              y={18}
              stagger={0.07}
              className="hn-grid-3"
            >
              {recentReviews.map((rev) => (
                <article
                  key={rev.id}
                  className="hn-reveal-item p-6 rounded-xl bg-[#FDFBF7] border border-[#EFECE4] flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-0.5" aria-label={`${rev.rating} sao`}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating
                                ? 'fill-[#E09619] text-[#E09619]'
                                : 'text-[#EFECE4]'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-[13px] text-[#4A5C6B] tabular-nums">
                        {formatDateVi(rev.created_at)}
                      </span>
                    </div>

                    <p className="text-[15px] text-[#14222E] leading-[1.65]">{rev.comment}</p>

                    {rev.images.length > 0 && (
                      <div className="flex gap-2">
                        {rev.images.slice(0, 3).map((img, i) => (
                          <div
                            key={i}
                            className="w-16 h-16 rounded-lg overflow-hidden border border-[#EFECE4]"
                          >
                            <SafeImage
                              src={img}
                              alt={`Ảnh đánh giá của ${rev.display_name}`}
                              preset="thumbnail"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#EFECE4] text-[13px] text-[#4A5C6B]">
                    <p className="font-semibold text-[#14222E]">
                      {rev.display_name}
                      {rev.verified_purchase && (
                        <span className="font-normal text-[#0B7A53]"> · Đã mua hàng</span>
                      )}
                    </p>
                    {rev.product_slug && rev.product_name && (
                      <Link
                        to={`/san-pham/${rev.product_slug}`}
                        className="hover:text-[#006A9E] underline underline-offset-2 mt-0.5 inline-block"
                      >
                        {rev.product_name}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </ScrollReveal>
          </div>
        </section>
      )}

      {/* 9. FAQ & Direct Contact */}
      <section className="hn-container hn-section">
        <div className="hn-grid-12 items-start">
          <div className="lg:col-span-4 space-y-4">
            <p className="text-[14px] text-[#006A9E] font-medium">Giải đáp trước khi đặt</p>
            <CinematicHeading
              as="h2"
              className="font-serif font-medium text-[28px] sm:text-[34px] text-[#14222E]"
            >
              Câu hỏi thường gặp
            </CinematicHeading>
            <p className="text-[15px] text-[#4A5C6B] leading-[1.65]">
              Cần hỏi thêm về thời gian nhận trong ngày, màu bóng hoặc giao tận nơi? Bạn có thể nhắn trực tiếp cho Hoa Nelly.
            </p>
            <div className="pt-2 flex flex-wrap gap-4 text-[14px]">
              <Link
                to="/lien-he"
                className="inline-flex items-center min-h-[44px] sm:min-h-0 font-semibold text-[#006A9E] hover:underline underline-offset-4"
              >
                Liên hệ Hoa Nelly
              </Link>
              <Link
                to="/huong-dan-va-hoi-dap"
                className="inline-flex items-center min-h-[44px] sm:min-h-0 font-medium text-[#14222E] hover:text-[#006A9E] hover:underline underline-offset-4"
              >
                Hướng dẫn đặt hàng
              </Link>
            </div>
          </div>

          <ScrollReveal
            once
            y={18}
            className="lg:col-span-8 divide-y divide-[#EFECE4] border-y border-[#EFECE4] bg-[#FDFBF7] rounded-xl px-5 sm:px-7"
          >
            {(settings?.faqs || []).map((faq) => {
              const isOpen = openFaqId === faq.id;
              return (
                <div key={faq.id} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                    className="w-full min-h-[44px] flex items-center justify-between gap-4 text-left py-2"
                    aria-expanded={isOpen}
                  >
                    <span className="text-[16px] font-medium text-[#14222E]">{faq.question}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#006A9E] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="pt-2.5 pb-1.5 text-[15px] text-[#4A5C6B] leading-[1.68] space-y-1.5 max-w-[65ch]">
                      <p>{faq.answer}</p>
                      {!faq.confirmed && (
                        <p className="text-[13px] text-[#006A9E]">
                          Lưu ý: Mốc thời gian và biểu phí cụ thể sẽ được cập nhật khi cửa hàng xác nhận cấu hình chính thức.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </ScrollReveal>
        </div>
      </section>
    </div>
  );
}
