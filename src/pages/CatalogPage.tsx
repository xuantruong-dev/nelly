import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { Product } from '../../shared/types.ts';
import { useStore } from '../context/StoreContext.tsx';
import { ProductCard } from '../components/ProductCard.tsx';
import { CinematicHeading } from '../components/CinematicScroll.tsx';
import { usePageMeta } from '../lib/format.ts';
import { fetchJson } from '../lib/api.ts';
import { useOverlayLock } from '../hooks/useOverlayLock.ts';
import {
  MOTION_CONFIG,
  ScrollTrigger,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from '../lib/motionConfig.ts';

interface CatalogPageProps {
  mode?: 'all' | 'category' | 'occasion';
}

const PRICE_RANGES = [
  { id: '', label: 'Mọi mức giá', min: '', max: '' },
  { id: 'under-350', label: 'Dưới 350.000₫', min: '0', max: '350000' },
  { id: '350-450', label: '350.000₫ – 450.000₫', min: '350000', max: '450000' },
  { id: 'over-450', label: 'Trên 450.000₫', min: '450000', max: '' },
];

export function CatalogPage({ mode = 'all' }: CatalogPageProps) {
  const { slug, occasionSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories, occasions } = useStore();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [availableColors, setAvailableColors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [headerInView, setHeaderInView] = useState(true);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const mobileFilterTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileFilterCloseRef = useRef<HTMLButtonElement>(null);
  const mobileFilterPanelRef = useRef<HTMLDivElement>(null);
  const prevFilterOpenRef = useRef(false);

  useOverlayLock(mobileFilterOpen);

  // Pause occasion butterfly animations automatically when header scrolls out of view
  useEffect(() => {
    if (mode !== 'occasion' || !headerRef.current || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setHeaderInView(entry.isIntersecting);
      },
      { threshold: 0.05 }
    );
    observer.observe(headerRef.current);
    return () => observer.disconnect();
  }, [mode]);

  useEffect(() => {
    if (mobileFilterOpen) {
      prevFilterOpenRef.current = true;
      const id = window.setTimeout(() => mobileFilterCloseRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
    if (prevFilterOpenRef.current) {
      prevFilterOpenRef.current = false;
      mobileFilterTriggerRef.current?.focus();
    }
  }, [mobileFilterOpen]);

  useEffect(() => {
    if (!mobileFilterOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setMobileFilterOpen(false);
        return;
      }
      if (e.key === 'Tab' && mobileFilterPanelRef.current) {
        const focusables = mobileFilterPanelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [mobileFilterOpen]);

  useGSAP(
    () => {
      if (loading || products.length === 0 || prefersReducedMotion() || !gridRef.current) return;
      const cards = gsap.utils.toArray<HTMLElement>('.hn-product-card', gridRef.current);
      if (cards.length === 0) return;

      gsap.set(cards, { opacity: 0, y: 18 });
      const triggers = ScrollTrigger.batch(cards, {
        batchMax: 3,
        start: 'top 92%',
        once: true,
        onEnter: (batch) => {
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.48,
            stagger: 0.055,
            ease: MOTION_CONFIG.eases.primary,
            clearProps: 'opacity,transform',
            overwrite: 'auto',
          });
        },
      });
      requestAnimationFrame(() => ScrollTrigger.refresh());
      return () => {
        triggers.forEach((t) => t.kill());
      };
    },
    { scope: gridRef, dependencies: [products, loading] }
  );

  const activeCategory = mode === 'category' ? slug || '' : searchParams.get('category') || '';
  const activeOccasion =
    mode === 'occasion' ? occasionSlug || '' : searchParams.get('occasion') || '';
  const qParam = searchParams.get('q') || '';
  const colorParam = searchParams.get('color') || '';
  const availabilityParam = searchParams.get('availability') || '';
  const pricingTypeParam = searchParams.get('pricingType') || '';
  const minPriceParam = searchParams.get('minPrice') || '';
  const maxPriceParam = searchParams.get('maxPrice') || '';
  const sortParam = searchParams.get('sort') || 'newest';
  const pageParam = Math.max(1, Number(searchParams.get('page') || 1));

  const [searchDraft, setSearchDraft] = useState(qParam);
  useEffect(() => {
    setSearchDraft(qParam);
  }, [qParam]);

  const currentCategoryObj = categories.find((c) => c.slug === activeCategory);
  const currentOccasionObj = occasions.find((o) => o.slug === activeOccasion);

  const pageTitle = currentCategoryObj
    ? currentCategoryObj.name
    : currentOccasionObj
      ? `Quà tặng dịp ${currentOccasionObj.name}`
      : 'Danh mục sản phẩm';

  const pageDesc = currentCategoryObj
    ? currentCategoryObj.description
    : currentOccasionObj
      ? currentOccasionObj.subtitle
      : 'Khám phá trọn bộ hoa bóng bay nghệ thuật, tạo hình nhân vật, phụ kiện sinh nhật, trang trí sự kiện và quà tặng tại Hoa Nelly.';

  usePageMeta(`${pageTitle} – Hoa Nelly`, pageDesc);

  const updateParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === '') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    if (!('page' in updates)) {
      next.delete('page');
    }
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    setSearchDraft('');
    setSearchParams(new URLSearchParams());
  };

  const retryFetch = () => {
    setRetryNonce((n) => n + 1);
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        if (qParam) qs.set('q', qParam);
        if (activeCategory) qs.set('category', activeCategory);
        if (activeOccasion) qs.set('occasion', activeOccasion);
        if (colorParam) qs.set('color', colorParam);
        if (availabilityParam) qs.set('availability', availabilityParam);
        if (pricingTypeParam) qs.set('pricingType', pricingTypeParam);
        if (minPriceParam) qs.set('minPrice', minPriceParam);
        if (maxPriceParam) qs.set('maxPrice', maxPriceParam);
        qs.set('sort', sortParam);
        qs.set('page', String(pageParam));
        qs.set('limit', '12');

        const json = await fetchJson<{
          items?: Product[];
          total?: number;
          totalPages?: number;
          facets?: { colors?: string[] };
        }>(`/api/products?${qs.toString()}`, {
          signal: controller.signal,
          fallbackError: 'Không thể tải danh sách sản phẩm.',
        });
        if (controller.signal.aborted) return;
        setProducts(json.items || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
        setAvailableColors(json.facets?.colors || []);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    fetchCatalog();
    return () => controller.abort();
  }, [
    qParam,
    activeCategory,
    activeOccasion,
    colorParam,
    availabilityParam,
    pricingTypeParam,
    minPriceParam,
    maxPriceParam,
    sortParam,
    pageParam,
    retryNonce,
  ]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (qParam) count++;
    if (mode === 'all' && activeCategory) count++;
    if (mode !== 'occasion' && activeOccasion) count++;
    if (colorParam) count++;
    if (availabilityParam) count++;
    if (pricingTypeParam) count++;
    if (minPriceParam || maxPriceParam) count++;
    return count;
  }, [
    qParam,
    mode,
    activeCategory,
    activeOccasion,
    colorParam,
    availabilityParam,
    pricingTypeParam,
    minPriceParam,
    maxPriceParam,
  ]);

  const activePriceRangeId =
    PRICE_RANGES.find((r) => r.min === minPriceParam && r.max === maxPriceParam)?.id || '';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateParam({ q: searchDraft.trim() || null });
  };

  const renderFilterControls = () => (
    <div className="space-y-6">
      {/* Category */}
      {mode !== 'category' && (
        <div>
          <h3 className="text-xs font-semibold text-[#14222E] mb-2.5">Loại sản phẩm</h3>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => updateParam({ category: null })}
              className={`flex items-center w-full text-left text-sm min-h-[44px] lg:min-h-[36px] py-2 lg:py-1.5 px-3 rounded-xl transition-colors cursor-pointer ${
                !activeCategory
                  ? 'bg-[#F4B6C8]/70 text-[#4A1829] font-semibold'
                  : 'text-[#5C6F80] hover:bg-[#F9E1E8]'
              }`}
            >
              Tất cả danh mục
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                type="button"
                onClick={() => updateParam({ category: cat.slug })}
                className={`flex items-center w-full text-left text-sm min-h-[44px] lg:min-h-[36px] py-2 lg:py-1.5 px-3 rounded-xl transition-colors cursor-pointer ${
                  activeCategory === cat.slug
                    ? 'bg-[#F4B6C8]/70 text-[#4A1829] font-semibold'
                    : 'text-[#5C6F80] hover:bg-[#F9E1E8]'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Occasion */}
      {mode !== 'occasion' && (
        <div className="pt-4 border-t border-[#EFECE4]">
          <h3 className="text-xs font-semibold text-[#14222E] mb-2.5">Dịp tặng</h3>
          <div className="space-y-1">
            <button
              type="button"
              onClick={() => updateParam({ occasion: null })}
              className={`flex items-center w-full text-left text-sm min-h-[44px] lg:min-h-[36px] py-2 lg:py-1.5 px-3 rounded-xl transition-colors cursor-pointer ${
                !activeOccasion
                  ? 'bg-[#F4B6C8]/70 text-[#4A1829] font-semibold'
                  : 'text-[#5C6F80] hover:bg-[#F9E1E8]'
              }`}
            >
              Mọi dịp tặng
            </button>
            {occasions.map((occ) => (
              <button
                key={occ.slug}
                type="button"
                onClick={() => updateParam({ occasion: occ.slug })}
                className={`flex items-center w-full text-left text-sm min-h-[44px] lg:min-h-[36px] py-2 lg:py-1.5 px-3 rounded-xl transition-colors cursor-pointer ${
                  activeOccasion === occ.slug
                    ? 'bg-[#F4B6C8]/70 text-[#4A1829] font-semibold'
                    : 'text-[#5C6F80] hover:bg-[#F9E1E8]'
                }`}
              >
                {occ.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div className="pt-4 border-t border-[#EFECE4]">
        <h3 className="text-xs font-semibold text-[#14222E] mb-2.5">Khoảng giá</h3>
        <div className="space-y-1">
          {PRICE_RANGES.map((r) => (
            <button
              key={r.id || 'all'}
              type="button"
              onClick={() => updateParam({ minPrice: r.min || null, maxPrice: r.max || null })}
              className={`flex items-center w-full text-left text-sm min-h-[44px] lg:min-h-[36px] py-2 lg:py-1.5 px-3 rounded-xl transition-colors cursor-pointer ${
                activePriceRangeId === r.id
                  ? 'bg-[#F4B6C8]/70 text-[#4A1829] font-semibold'
                  : 'text-[#5C6F80] hover:bg-[#F9E1E8]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pricing Model */}
      <div className="pt-4 border-t border-[#EFECE4]">
        <h3 className="text-xs font-semibold text-[#14222E] mb-2.5">Hình thức giá</h3>
        <div className="space-y-1">
          {[
            { id: '', label: 'Tất cả hình thức' },
            { id: 'fixed', label: 'Giá cố định' },
            { id: 'from', label: 'Giá từ (cấu hình cơ bản)' },
            { id: 'quote', label: 'Liên hệ báo giá' },
          ].map((pt) => (
            <button
              key={pt.id || 'all'}
              type="button"
              onClick={() => updateParam({ pricingType: pt.id || null })}
              className={`flex items-center w-full text-left text-sm min-h-[44px] lg:min-h-[36px] py-2 lg:py-1.5 px-3 rounded-xl transition-colors cursor-pointer ${
                pricingTypeParam === pt.id
                  ? 'bg-[#F4B6C8]/70 text-[#4A1829] font-semibold'
                  : 'text-[#5C6F80] hover:bg-[#F9E1E8]'
              }`}
            >
              {pt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      {availableColors.length > 0 && (
        <div className="pt-4 border-t border-[#EFECE4]">
          <h3 className="text-xs font-semibold text-[#14222E] mb-2.5">Tông màu</h3>
          <div className="flex flex-wrap gap-2">
            {availableColors.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => updateParam({ color: colorParam === col ? null : col })}
                className={`inline-flex items-center justify-center min-h-[44px] min-w-[44px] lg:min-h-[34px] lg:min-w-0 px-3.5 py-2 lg:px-3 lg:py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                  colorParam === col
                    ? 'bg-[#F4B6C8] text-[#4A1829] border-[#D47B97] font-semibold'
                    : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:border-[#D47B97]'
                }`}
              >
                {col}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Availability */}
      <div className="pt-4 border-t border-[#EFECE4]">
        <h3 className="text-xs font-semibold text-[#14222E] mb-2.5">Trạng thái nhận đặt</h3>
        <div className="space-y-1">
          {[
            { id: '', label: 'Tất cả trạng thái' },
            { id: 'in_stock', label: 'Nhận làm trong ngày' },
            { id: 'made_to_order', label: 'Nhận đặt làm thủ công' },
          ].map((av) => (
            <button
              key={av.id || 'all'}
              type="button"
              onClick={() => updateParam({ availability: av.id || null })}
              className={`flex items-center w-full text-left text-sm min-h-[44px] lg:min-h-[36px] py-2 lg:py-1.5 px-3 rounded-xl transition-colors cursor-pointer ${
                availabilityParam === av.id
                  ? 'bg-[#F4B6C8]/70 text-[#4A1829] font-semibold'
                  : 'text-[#5C6F80] hover:bg-[#F9E1E8]'
              }`}
            >
              {av.label}
            </button>
          ))}
        </div>
      </div>

      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="w-full min-h-[44px] py-2.5 rounded-xl border border-[#E093AB] text-xs font-semibold text-[#006A9E] hover:bg-[#F9E1E8] cursor-pointer"
        >
          Xóa toàn bộ bộ lọc ({activeFilterCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="hn-page-shell">
      {/* Header & Breadcrumb */}
      <div
        ref={headerRef}
        className={`relative pb-8 border-b border-[#EFECE4] ${
          !headerInView ? 'hn-motion-paused' : ''
        }`}
      >
        {/* Decorative butterfly flock in the empty right-hand space on "Theo dịp" */}
        {mode === 'occasion' && (
          <div
            aria-hidden="true"
            className="pointer-events-none select-none hidden md:block absolute inset-0 overflow-visible z-10"
          >
            {/* Lead hero butterfly */}
            <div className="hn-butterfly-flight hn-butterfly-interactive absolute -top-2 right-6 lg:right-[74px] xl:right-[118px] w-[164px] lg:w-[204px] xl:w-[232px]">
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
                    className="block w-full h-auto object-contain hn-butterfly-wingbeat-slow"
                  />
                </picture>
              </div>
            </div>

            {/* Second large trailing butterfly */}
            <div
              className="hn-butterfly-flight-alt hn-butterfly-interactive absolute top-[58px] -right-4 lg:-right-2 xl:right-2 w-[132px] lg:w-[158px] xl:w-[180px]"
              style={{ animationDelay: '-1.8s' }}
            >
              <div className="-scale-x-100 rotate-[10deg]">
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
                    style={{ animationDelay: '-0.5s' }}
                  />
                </picture>
              </div>
            </div>
          </div>
        )}

        <div className="relative z-20">
          <nav aria-label="Breadcrumb" className="text-xs text-[#5C6F80] mb-4 flex items-center gap-2">
            <Link to="/" className="hover:text-[#006A9E]">
              Trang chủ
            </Link>
            <span aria-hidden="true">/</span>
            {mode === 'occasion' ? (
              <>
                <Link to="/bo-suu-tap" className="hover:text-[#006A9E]">
                  Bộ sưu tập theo dịp
                </Link>
                {currentOccasionObj && (
                  <>
                    <span aria-hidden="true">/</span>
                    <span className="text-[#14222E] font-medium">{currentOccasionObj.name}</span>
                  </>
                )}
              </>
            ) : (
              <span className="text-[#14222E] font-medium">{pageTitle}</span>
            )}
          </nav>

          <CinematicHeading
            as="h1"
            triggerOnScroll={false}
            className="font-serif text-3xl sm:text-4xl font-medium text-[#14222E]"
          >
            {pageTitle}
          </CinematicHeading>
          <p className="mt-2.5 text-sm sm:text-[15px] text-[#5C6F80] max-w-2xl leading-relaxed">
            {pageDesc}
          </p>

          {/* Occasion quick strip on /bo-suu-tap (horizontal rail on mobile, wrap on md+) */}
          {mode === 'occasion' && (
            <div className="hn-scroll-rail mt-5 flex flex-nowrap md:flex-wrap gap-2 pb-1 md:pb-0">
              <Link
                to="/bo-suu-tap"
                className={`shrink-0 inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${
                  !activeOccasion
                    ? 'bg-[#F4B6C8] text-[#4A1829] border-[#D47B97] font-semibold'
                    : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:border-[#D47B97]'
                }`}
              >
                Tất cả dịp tặng
              </Link>
              {occasions.map((occ) => (
                <Link
                  key={occ.slug}
                  to={`/bo-suu-tap/${occ.slug}`}
                  className={`shrink-0 inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    activeOccasion === occ.slug
                      ? 'bg-[#F4B6C8] text-[#4A1829] border-[#D47B97] font-semibold'
                      : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:border-[#D47B97]'
                  }`}
                >
                  {occ.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search & Sort Toolbar */}
      <div className="py-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-[#5C6F80] absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Tìm tên hoa, màu sắc, mã SKU..."
              className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-xl focus:border-[#D47B97]"
            />
          </div>
          <button
            type="submit"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] shrink-0 cursor-pointer"
          >
            Tìm
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 sm:gap-3">
          <button
            ref={mobileFilterTriggerRef}
            type="button"
            onClick={() => setMobileFilterOpen(true)}
            aria-expanded={mobileFilterOpen}
            aria-controls="hn-catalog-filter-drawer"
            className="lg:hidden inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-sm font-medium text-[#14222E] hover:border-[#D47B97] cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Bộ lọc{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </button>

          <p className="text-xs sm:text-sm text-[#5C6F80] tabular-nums">
            {total} kết quả
          </p>

          <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#5C6F80]">
            <span className="hidden sm:inline">Sắp xếp:</span>
            <select
              value={sortParam}
              onChange={(e) => updateParam({ sort: e.target.value })}
              className="min-h-[44px] bg-[#FDFBF7] border border-[#EFECE4] rounded-xl px-3 py-2 text-sm text-[#14222E]"
            >
              <option value="newest">Sản phẩm mới</option>
              <option value="price_asc">Giá tăng dần</option>
              <option value="price_desc">Giá giảm dần</option>
              <option value="rating">Đánh giá cao nhất</option>
            </select>
          </label>
        </div>
      </div>

      {/* Main Grid */}
      <div className="hn-grid-12 mt-2">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-3">
          <div className="bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-5 sticky top-24">
            {renderFilterControls()}
          </div>
        </aside>

        {/* Product Results */}
        <div className="lg:col-span-9">
          {loading ? (
            <div className="hn-grid-3 animate-pulse">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div key={n} className="bg-[#FDFBF7] rounded-xl border border-[#EFECE4] overflow-hidden">
                  <div className="aspect-[4/5] bg-[#F8F5EE]" />
                  <div className="p-4 space-y-2.5">
                    <div className="h-3 w-24 bg-[#F8F5EE] rounded" />
                    <div className="h-5 w-4/5 bg-[#D8ECF8] rounded" />
                    <div className="h-4 w-28 bg-[#F8F5EE] rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-8 rounded-xl bg-[#FDFBF7] border border-[#EFECE4] text-center space-y-3">
              <p className="text-sm text-red-700">{error}</p>
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={retryFetch}
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-sm font-medium cursor-pointer"
                >
                  Tải lại
                </button>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl border border-[#EFECE4] text-sm text-[#14222E] hover:bg-[#F9E1E8] cursor-pointer"
                  >
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 rounded-xl bg-[#FDFBF7] border border-[#EFECE4] text-center space-y-4">
              <h2 className="font-serif text-xl font-semibold text-[#14222E]">
                Không tìm thấy sản phẩm phù hợp
              </h2>
              <p className="text-sm text-[#5C6F80] max-w-md mx-auto">
                Thử bỏ bớt điều kiện lọc hoặc gửi trực tiếp ý tưởng để Hoa Nelly thiết kế riêng mẫu bạn đang tìm.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl border border-[#EFECE4] text-sm font-medium text-[#14222E] hover:bg-[#F9E1E8] cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
                <Link
                  to="/dat-thiet-ke-rieng"
                  className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5]"
                >
                  Đặt thiết kế theo yêu cầu
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div ref={gridRef} className="hn-grid-3">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-10 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    disabled={pageParam <= 1}
                    onClick={() => updateParam({ page: String(pageParam - 1) })}
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-sm font-medium disabled:opacity-40 hover:border-[#D47B97] cursor-pointer"
                  >
                    Trước
                  </button>
                  <span className="text-sm text-[#5C6F80] px-3 tabular-nums">
                    Trang {pageParam} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={pageParam >= totalPages}
                    onClick={() => updateParam({ page: String(pageParam + 1) })}
                    className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-sm font-medium disabled:opacity-40 hover:border-[#D47B97] cursor-pointer"
                  >
                    Tiếp
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile Slide-Over Filter Drawer (Portaled to body at z-[60]) */}
      {mobileFilterOpen &&
        createPortal(
          <div
            id="hn-catalog-filter-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Bộ lọc sản phẩm"
            data-hn-overlay-layer="drawer"
            className="fixed inset-0 z-[60] lg:hidden flex justify-end"
          >
            <div
              className="fixed inset-0 bg-[#14222E]/40 backdrop-blur-[1px]"
              onClick={() => setMobileFilterOpen(false)}
            />
            <div
              ref={mobileFilterPanelRef}
              className="relative z-10 w-full max-w-sm bg-[#FDFBF7] h-full flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-[#EFECE4] bg-[#FDFBF7] shrink-0">
                <h2 className="font-serif text-lg font-semibold text-[#14222E]">Bộ lọc sản phẩm</h2>
                <button
                  ref={mobileFilterCloseRef}
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="w-11 h-11 inline-flex items-center justify-center rounded-xl hover:bg-[#F9E1E8] transition-colors cursor-pointer"
                  aria-label="Đóng bộ lọc"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain p-5">
                {renderFilterControls()}
              </div>
              <div className="p-4 border-t border-[#EFECE4] bg-[#FDFBF7] shrink-0">
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="w-full min-h-[48px] py-3 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-sm font-semibold transition-colors cursor-pointer"
                >
                  Xem {total} kết quả
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
