import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import type { GalleryItem } from '../../shared/types.ts';
import { GALLERY_TYPE_LABELS, usePageMeta } from '../lib/format.ts';
import { fetchJson } from '../lib/api.ts';
import { MOTION_CONFIG, ScrollTrigger, gsap, useGSAP } from '../lib/motionConfig.ts';
import { SafeImage } from '../components/SafeImage.tsx';
import { CinematicHeading } from '../components/CinematicScroll.tsx';
import { useOverlayLock } from '../hooks/useOverlayLock.ts';

const GALLERY_CATEGORIES = [
  'Tất cả',
  'Hoa bóng bay nghệ thuật',
  'Tạo hình nhân vật',
  'Phụ kiện sinh nhật',
  'Trang trí sự kiện',
  'Quà tặng',
];

const TYPE_FILTERS = [
  { id: '', label: 'Tất cả loại ảnh' },
  { id: 'sample_product', label: 'Sản phẩm tiêu biểu' },
  { id: 'reference_idea', label: 'Ảnh ý tưởng tham khảo' },
  { id: 'completed_project', label: 'Dự án đã thực hiện' },
];

const PAGE_SIZE = 12;

export function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [category, setCategory] = useState('Tất cả');
  const [imageType, setImageType] = useState('');
  const [mobileTypeOpen, setMobileTypeOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const lightboxDialogRef = useRef<HTMLDivElement>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useOverlayLock(activeIndex !== null);

  usePageMeta(
    'Thư viện hình ảnh – Hoa Nelly',
    'Khám phá ý tưởng hoa bóng bay nghệ thuật, tạo hình nhân vật và trang trí sự kiện tại Hoa Nelly.'
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setVisibleCount(PAGE_SIZE);
    setActiveIndex(null);
    const qs = new URLSearchParams();
    if (category !== 'Tất cả') qs.set('category', category);
    if (imageType) qs.set('imageType', imageType);

    fetchJson<{ items?: GalleryItem[] }>(`/api/gallery?${qs.toString()}`, {
      signal: controller.signal,
      fallbackError: 'Không thể tải thư viện hình ảnh.',
    })
      .then((d) => {
        if (!controller.signal.aborted) {
          setItems(d.items || []);
        }
      })
      .catch((err) => {
        if ((err as Error).name !== 'AbortError') {
          setItems([]);
          setError(err instanceof Error ? err.message : 'Không thể tải thư viện hình ảnh.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [category, imageType, retryNonce]);

  const visibleItems = items.slice(0, visibleCount);
  const activeItem =
    activeIndex !== null && activeIndex >= 0 && activeIndex < items.length
      ? items[activeIndex]
      : null;

  const closeLightbox = useCallback(() => {
    setActiveIndex(null);
    requestAnimationFrame(() => {
      lastTriggerRef.current?.focus();
    });
  }, []);

  const showPrevItem = useCallback(() => {
    if (items.length < 2) return;
    setActiveIndex((prev) =>
      prev === null ? null : (prev - 1 + items.length) % items.length
    );
  }, [items.length]);

  const showNextItem = useCallback(() => {
    if (items.length < 2) return;
    setActiveIndex((prev) =>
      prev === null ? null : (prev + 1) % items.length
    );
  }, [items.length]);

  useEffect(() => {
    if (activeIndex === null) return;
    requestAnimationFrame(() => closeBtnRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        showPrevItem();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        showNextItem();
      } else if (e.key === 'Tab' && lightboxDialogRef.current) {
        const focusables = lightboxDialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, closeLightbox, showPrevItem, showNextItem]);

  const handleLightboxTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleLightboxTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || e.changedTouches.length !== 1 || items.length < 2) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      if (dx < 0) showNextItem();
      else showPrevItem();
    }
  };

  // Reset revealed markers whenever filter tabs change so fresh results animate cleanly
  useEffect(() => {
    if (!gridRef.current) return;
    gridRef.current
      .querySelectorAll<HTMLElement>('.hn-gallery-card[data-hn-revealed="1"]')
      .forEach((card) => card.removeAttribute('data-hn-revealed'));
  }, [category, imageType]);

  // Rhythmic small-group gallery reveal (animates only unrevealed cards so "Xem thêm" never hides visible ones)
  useGSAP(
    () => {
      if (loading || visibleItems.length === 0 || !gridRef.current) return;

      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: MOTION_CONFIG.media.reducedMotion,
          isDesktop: MOTION_CONFIG.media.desktop,
        },
        (context) => {
          const { reduceMotion, isDesktop } = context.conditions || {};
          const cards = gsap.utils.toArray<HTMLElement>(
            '.hn-gallery-card:not([data-hn-revealed="1"])',
            gridRef.current
          );
          if (cards.length === 0) return;

          if (reduceMotion) {
            cards.forEach((card) => card.setAttribute('data-hn-revealed', '1'));
            return;
          }

          const stagger = MOTION_CONFIG.cinematicScroll.galleryBatchStagger;
          const shiftY = isDesktop ? 22 : 14;

          gsap.set(cards, { opacity: 0, y: shiftY });

          const triggers = ScrollTrigger.batch(cards, {
            batchMax: 4,
            start: 'top 92%',
            once: true,
            onEnter: (batch) => {
              batch.forEach((el) => (el as HTMLElement).setAttribute('data-hn-revealed', '1'));
              gsap.to(batch, {
                opacity: 1,
                y: 0,
                duration: 0.52,
                stagger,
                ease: MOTION_CONFIG.eases.primary,
                clearProps: 'transform,opacity',
                overwrite: 'auto',
              });
            },
          });

          requestAnimationFrame(() => ScrollTrigger.refresh());

          return () => {
            triggers.forEach((t) => t.kill());
          };
        }
      );
    },
    { scope: gridRef, dependencies: [visibleItems.length, loading, category, imageType] }
  );

  const hasActiveFilters = category !== 'Tất cả' || imageType !== '';
  const activeTypeLabel =
    TYPE_FILTERS.find((tf) => tf.id === imageType)?.label || 'Tất cả loại ảnh';

  const resetFilters = () => {
    setCategory('Tất cả');
    setImageType('');
    setMobileTypeOpen(false);
  };

  return (
    <div className="hn-page-shell">
      {/* Compact Editorial Header */}
      <div className="pb-5 border-b border-[#EFECE4] max-w-3xl">
        <p className="text-[12.5px] text-[#006A9E] font-semibold mb-1">
          Cảm hứng sắc màu &amp; tạo hình
        </p>
        <CinematicHeading
          as="h1"
          triggerOnScroll={false}
          className="font-serif text-[clamp(1.75rem,3.2vw,2.45rem)] leading-tight font-medium text-[#14222E]"
        >
          Thư viện hình ảnh
        </CinematicHeading>
        <p className="text-sm sm:text-[15px] text-[#4A5C6B] mt-2 leading-relaxed">
          Khám phá các mẫu hoa bóng bay tiêu biểu, gợi ý phối màu theo chủ đề và những dự án đã thực hiện tại Hoa Nelly.
        </p>
      </div>

      {/* Unified Filter Toolbar */}
      <div className="py-4 sm:py-5 space-y-3 border-b border-[#EFECE4]/70">
        {/* Row 1: Danh mục sản phẩm (horizontal scroll rail on mobile, wrap on desktop) */}
        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="flex items-center justify-between gap-2 md:shrink-0">
            <span className="text-xs font-semibold text-[#14222E]">Danh mục sản phẩm</span>
            <button
              type="button"
              onClick={() => setMobileTypeOpen((prev) => !prev)}
              aria-expanded={mobileTypeOpen}
              className={`md:hidden inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border text-xs font-semibold transition-colors ${
                imageType || mobileTypeOpen
                  ? 'bg-[#FFF0F6] text-[#9E2B53] border-[#E093AB]'
                  : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Loại ảnh</span>
              {imageType && (
                <span className="w-2 h-2 rounded-full bg-[#DF3E7C]" aria-hidden="true" />
              )}
            </button>
          </div>

          <div className="hn-scroll-rail flex flex-nowrap md:flex-wrap items-center gap-2 pb-1 md:pb-0">
            {GALLERY_CATEGORIES.map((c) => {
              const isActive = category === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  aria-pressed={isActive}
                  className={`shrink-0 inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#F4B6C8] text-[#4A1829] border-[#D47B97] font-semibold'
                      : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:border-[#D47B97]'
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Loại ảnh (always visible on md+, toggled cleanly on mobile so grid appears immediately) */}
        <div
          className={`${
            mobileTypeOpen ? 'flex' : 'hidden md:flex'
          } flex-col md:flex-row md:items-center gap-2 md:gap-3 pt-1`}
        >
          <span className="text-xs font-semibold text-[#5C6F80] md:shrink-0">Loại ảnh</span>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {TYPE_FILTERS.map((tf) => {
              const isActive = imageType === tf.id;
              return (
                <button
                  key={tf.id || 'all'}
                  type="button"
                  onClick={() => setImageType(tf.id)}
                  aria-pressed={isActive}
                  className={`inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-xl border transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#F4B6C8]/75 text-[#4A1829] border-[#D47B97] font-semibold'
                      : 'bg-[#FDFBF7] text-[#5C6F80] border-[#EFECE4] hover:text-[#14222E] hover:border-[#D47B97]'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Status & One-Click Filter Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#5C6F80]">
          <p className="tabular-nums">
            {loading
              ? 'Đang tải hình ảnh...'
              : `Đang hiển thị ${visibleItems.length} / ${items.length} hình ảnh${
                  imageType ? ` · ${activeTypeLabel}` : ''
                }`}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-[#9E2B53] hover:bg-[#FFF0F6] font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      </div>

      {/* Responsive 1 -> 2 -> 3 -> 4 Image Grid */}
      {loading ? (
        <div className="hn-grid-4 animate-pulse mt-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
            <div key={n} className="aspect-[4/5] rounded-2xl bg-[#F8F5EE]" />
          ))}
        </div>
      ) : error ? (
        <div className="my-8 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-8 sm:p-10 text-center space-y-3">
          <p className="text-sm text-red-700">{error}</p>
          <button
            type="button"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-xs font-semibold hover:bg-[#EC9EB5] transition-colors cursor-pointer"
          >
            Tải lại
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="my-8 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-8 sm:p-10 text-center space-y-3">
          <p className="font-serif text-xl font-semibold text-[#14222E]">
            Chưa có hình ảnh trong nhóm này
          </p>
          <p className="text-sm text-[#5C6F80] max-w-lg mx-auto">
            {imageType === 'completed_project'
              ? 'Mục "Dự án đã thực hiện" sẽ hiển thị ngay khi Hoa Nelly đăng tải hình ảnh dự án thực tế có xác nhận trong trang Quản trị.'
              : 'Thử chọn danh mục khác hoặc gửi ý tưởng riêng của bạn để Hoa Nelly tư vấn.'}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#E093AB] bg-[#FFF3F7] text-xs font-semibold text-[#7A2047] hover:bg-[#F4B6C8]/60 transition-colors cursor-pointer"
          >
            Xem tất cả hình ảnh
          </button>
        </div>
      ) : (
        <>
          <div
            ref={gridRef}
            className="hn-grid-4 mt-6"
          >
            {visibleItems.map((item, idx) => {
              const isSampleBouquet = item.image_type === 'sample_product';
              return (
                <article
                  key={item.id}
                  className="hn-gallery-card bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] overflow-hidden flex flex-col hover:border-[#E5B8CB] transition-colors"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      lastTriggerRef.current = e.currentTarget;
                      setActiveIndex(idx);
                    }}
                    aria-label={`Xem phóng to: ${item.title}`}
                    className={`aspect-[4/5] w-full overflow-hidden text-left group cursor-pointer ${
                      isSampleBouquet ? 'bg-[#FFFDFC]' : 'bg-[#F8F5EE]'
                    }`}
                  >
                    <div className="hn-gallery-scale w-full h-full">
                      <SafeImage
                        src={item.image_url}
                        alt={item.title}
                        preset="gallery"
                        objectFit={isSampleBouquet ? 'contain' : 'cover'}
                        wrapperClassName="w-full h-full"
                        className={`w-full h-full transition-transform duration-300 group-hover:scale-[1.03] ${
                          isSampleBouquet ? 'object-contain p-2' : 'object-cover'
                        }`}
                      />
                    </div>
                  </button>
                  <div className="p-3.5 sm:p-4 space-y-1 flex-1 flex flex-col">
                    <p className="text-[11px] text-[#5C6F80] leading-snug">
                      {item.category} · {GALLERY_TYPE_LABELS[item.image_type] || item.image_type}
                    </p>
                    <h2 className="font-serif text-[15px] sm:text-base font-semibold text-[#14222E] leading-snug">
                      {item.title}
                    </h2>
                    {item.caption && (
                      <p className="text-xs text-[#5C6F80] leading-relaxed line-clamp-2 pt-0.5">
                        {item.caption}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Progressive Load More */}
          {visibleCount < items.length && (
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white border border-[#E093AB] text-[#7A2047] text-sm font-semibold hover:bg-[#FFF0F6] transition-colors cursor-pointer"
              >
                Xem thêm ({items.length - visibleCount} hình ảnh)
              </button>
            </div>
          )}
        </>
      )}

      {/* Accessible Lightbox Modal with Prev/Next, Swipe & Keyboard Navigation (Portaled at z-[70]) */}
      {activeItem &&
        activeIndex !== null &&
        createPortal(
          <div
            ref={lightboxDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={activeItem.title}
            data-lenis-prevent
            data-hn-overlay-layer="lightbox"
            className="fixed inset-0 z-[70] bg-[#14222E]/88 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5 overscroll-contain"
            onClick={closeLightbox}
          >
            <button
              ref={closeBtnRef}
              type="button"
              onClick={closeLightbox}
              className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 rounded-full bg-[#FDFBF7] text-[#14222E] shadow-lg flex items-center justify-center hover:bg-[#F9E1E8] transition-colors cursor-pointer"
              aria-label="Đóng hộp xem ảnh"
            >
              <X className="w-5 h-5" />
            </button>

            <div
              className="relative max-w-3xl w-full max-h-[90vh] bg-[#FDFBF7] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative h-[56vh] sm:h-[66vh] max-h-[68vh] bg-[#F8F5EE] flex items-center justify-center overflow-hidden"
                onTouchStart={handleLightboxTouchStart}
                onTouchEnd={handleLightboxTouchEnd}
              >
                <SafeImage
                  key={activeItem.id}
                  src={activeItem.image_url}
                  alt={activeItem.title}
                  preset="lightbox"
                  priority
                  objectFit="contain"
                  wrapperClassName="w-full h-full"
                  className="w-full h-full object-contain"
                />

                {items.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={showPrevItem}
                      aria-label="Ảnh trước"
                      className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#FDFBF7]/92 text-[#14222E] shadow-lg flex items-center justify-center hover:bg-[#F9E1E8] transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={showNextItem}
                      aria-label="Ảnh tiếp theo"
                      className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#FDFBF7]/92 text-[#14222E] shadow-lg flex items-center justify-center hover:bg-[#F9E1E8] transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                    <span className="absolute bottom-3 right-3 z-10 px-2.5 py-1 rounded-full bg-white/92 text-[#14222E] text-xs font-semibold tabular-nums shadow-xs">
                      {activeIndex + 1} / {items.length}
                    </span>
                  </>
                )}
              </div>
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="min-w-0">
                  <p className="text-xs text-[#006A9E]">
                    {activeItem.category} ·{' '}
                    {GALLERY_TYPE_LABELS[activeItem.image_type] || activeItem.image_type}
                  </p>
                  <h3 className="font-serif text-lg font-semibold text-[#14222E]">
                    {activeItem.title}
                  </h3>
                  {activeItem.caption && (
                    <p className="text-xs text-[#5C6F80] mt-0.5 leading-relaxed">
                      {activeItem.caption}
                    </p>
                  )}
                </div>
                <Link
                  to={`/dat-thiet-ke-rieng?mau=${encodeURIComponent(activeItem.title)}`}
                  onClick={() => setActiveIndex(null)}
                  className="min-h-[44px] inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-xs font-semibold text-center shrink-0 hover:bg-[#EC9EB5] transition-colors"
                >
                  Đặt mẫu tương tự
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

