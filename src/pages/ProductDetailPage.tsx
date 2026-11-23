import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImagePlus,
  MessageSquare,
  Minus,
  Plus,
  ShoppingBag,
  Star,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  CartItem,
  Product,
  ProductQuestion,
  ProductReview,
  ProductVariant,
} from '../../shared/types.ts';
import { useStore } from '../context/StoreContext.tsx';
import {
  AVAILABILITY_LABELS,
  formatDateTimeVi,
  formatDateVi,
  formatProductPrice,
  formatVnd,
  uploadImages,
  usePageMeta,
} from '../lib/format.ts';
import { ApiError, fetchJson } from '../lib/api.ts';
import { ProductCard } from '../components/ProductCard.tsx';
import { SafeImage } from '../components/SafeImage.tsx';
import { CinematicHeading, ScrollReveal } from '../components/CinematicScroll.tsx';
import { MOTION_CONFIG, gsap, prefersReducedMotion, useGSAP } from '../lib/motionConfig.ts';
import { useOverlayLock } from '../hooks/useOverlayLock.ts';

interface PdpResponse {
  product: Product;
  reviews: ProductReview[];
  review_distribution: Record<number, number>;
  questions: ProductQuestion[];
  related_products: Product[];
  suggested_accessories: Product[];
}

const VARIANT_GROUP_LABELS: Record<string, string> = {
  size: 'Kích thước',
  color: 'Chọn màu',
  style: 'Kiểu bó / Trưng bày',
  theme: 'Chủ đề / Tạo hình',
};

export function ProductDetailPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart, setCartDrawerOpen, showToast } = useStore();

  const [data, setData] = useState<PdpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  // Gallery state
  const [activeImage, setActiveImage] = useState<string>('');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const mainMediaRef = useRef<HTMLDivElement>(null);
  const prevActiveImageRef = useRef<string>('');
  const lightboxBackdropRef = useRef<HTMLDivElement>(null);
  const lightboxPanelRef = useRef<HTMLDivElement>(null);
  const lightboxCloseBtnRef = useRef<HTMLButtonElement>(null);
  const lastLightboxTriggerRef = useRef<HTMLElement | null>(null);
  const lightboxTouchRef = useRef<{ x: number; y: number } | null>(null);

  useOverlayLock(Boolean(lightboxImage));

  const openLightbox = (img: string, trigger?: HTMLElement | null) => {
    lastLightboxTriggerRef.current = trigger || (document.activeElement as HTMLElement | null);
    setLightboxImage(img);
  };

  const closeLightbox = () => {
    setLightboxImage(null);
    requestAnimationFrame(() => {
      lastLightboxTriggerRef.current?.focus();
    });
  };

  useGSAP(
    () => {
      const prev = prevActiveImageRef.current;
      prevActiveImageRef.current = activeImage;
      if (!prev || !activeImage || prev === activeImage || prefersReducedMotion()) return;
      if (mainMediaRef.current) {
        gsap.fromTo(
          mainMediaRef.current,
          { opacity: 0.72, scale: 0.982 },
          {
            opacity: 1,
            scale: 1,
            duration: MOTION_CONFIG.durations.mediaSwap,
            ease: MOTION_CONFIG.eases.primary,
            clearProps: 'transform,opacity',
          }
        );
      }
    },
    { dependencies: [activeImage] }
  );

  useGSAP(
    () => {
      if (!lightboxImage || prefersReducedMotion()) return;
      if (lightboxBackdropRef.current) {
        gsap.fromTo(
          lightboxBackdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: MOTION_CONFIG.durations.overlay * 0.75, ease: 'power2.out' }
        );
      }
      if (lightboxPanelRef.current) {
        gsap.fromTo(
          lightboxPanelRef.current,
          { opacity: 0, scale: 0.94 },
          {
            opacity: 1,
            scale: 1,
            duration: MOTION_CONFIG.durations.overlay,
            ease: MOTION_CONFIG.eases.primary,
            clearProps: 'transform,opacity',
          }
        );
      }
    },
    { dependencies: [lightboxImage] }
  );

  const productGalleryImages = data?.product?.images || [];
  const lightboxProductIdx = lightboxImage ? productGalleryImages.indexOf(lightboxImage) : -1;
  const canNavigateLightbox = lightboxProductIdx >= 0 && productGalleryImages.length > 1;

  const showPrevLightboxImage = () => {
    if (!canNavigateLightbox) return;
    const prevIdx =
      (lightboxProductIdx - 1 + productGalleryImages.length) % productGalleryImages.length;
    setLightboxImage(productGalleryImages[prevIdx]);
  };

  const showNextLightboxImage = () => {
    if (!canNavigateLightbox) return;
    const nextIdx = (lightboxProductIdx + 1) % productGalleryImages.length;
    setLightboxImage(productGalleryImages[nextIdx]);
  };

  useEffect(() => {
    if (!lightboxImage) return;
    requestAnimationFrame(() => lightboxCloseBtnRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
      } else if (e.key === 'ArrowLeft' && canNavigateLightbox) {
        e.preventDefault();
        showPrevLightboxImage();
      } else if (e.key === 'ArrowRight' && canNavigateLightbox) {
        e.preventDefault();
        showNextLightboxImage();
      } else if (e.key === 'Tab' && lightboxBackdropRef.current) {
        const focusables = lightboxBackdropRef.current.querySelectorAll<HTMLElement>(
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
  }, [lightboxImage, canNavigateLightbox, lightboxProductIdx]);

  // Purchase configuration state
  const [selectedVariants, setSelectedVariants] = useState<Record<string, ProductVariant>>({});
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [cardMessage, setCardMessage] = useState('');
  const [customText, setCustomText] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [note, setNote] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [uploadingRef, setUploadingRef] = useState(false);
  const [requiresCustomQuote, setRequiresCustomQuote] = useState(false);

  // Reviews filter state
  const [starFilter, setStarFilter] = useState<number | null>(null);
  const [withPhotosOnly, setWithPhotosOnly] = useState(false);
  const [reviewSort, setReviewSort] = useState<'newest' | 'oldest'>('newest');
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(8);
  const [visibleQuestionsCount, setVisibleQuestionsCount] = useState(6);

  useEffect(() => {
    setVisibleReviewsCount(8);
  }, [slug, starFilter, withPhotosOnly, reviewSort]);

  useEffect(() => {
    setVisibleQuestionsCount(6);
  }, [slug]);

  // Review submission modal/panel
  const reviewTokenFromUrl = searchParams.get('reviewToken') || '';
  const [reviewPanelOpen, setReviewPanelOpen] = useState(Boolean(reviewTokenFromUrl));
  const [reviewTokenInput, setReviewTokenInput] = useState(reviewTokenFromUrl);
  const [verifiedInfo, setVerifiedInfo] = useState<{
    order_code: string;
    product_id: number;
    product_name: string;
    default_display_name: string;
    variant_summary: string;
    existing_review: ProductReview | null;
    can_edit: boolean;
  } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [revDisplayName, setRevDisplayName] = useState('');
  const [revRating, setRevRating] = useState(5);
  const [revComment, setRevComment] = useState('');
  const [revImages, setRevImages] = useState<string[]>([]);
  const [revUploading, setRevUploading] = useState(false);
  const [revPreviewStep, setRevPreviewStep] = useState(false);
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [revSubmitError, setRevSubmitError] = useState<string | null>(null);

  // Q&A form state
  const [askerName, setAskerName] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [qaSubmitting, setQaSubmitting] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  const fetchPdp = async (signal?: AbortSignal) => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    try {
      const json = await fetchJson<PdpResponse>(`/api/products/${encodeURIComponent(slug)}`, {
        signal,
        fallbackError: 'Không tìm thấy sản phẩm.',
      });
      if (signal?.aborted) return;
      setData(json);
      setActiveImage(json.product.images[0] || '');

      // Default select first in-stock variant per group
      const defaults: Record<string, ProductVariant> = {};
      for (const v of json.product.variants) {
        if (!defaults[v.group] && v.in_stock) {
          defaults[v.group] = v;
        }
      }
      setSelectedVariants(defaults);
      setSelectedAddonIds([]);
      setQuantity(1);
      setCardMessage('');
      setCustomText('');
      setThemeInput('');
      setNote('');
      setReferenceImageUrl('');
      setRequiresCustomQuote(false);
      setStarFilter(null);
      setWithPhotosOnly(false);
      prevActiveImageRef.current = json.product.images[0] || '';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setErrorStatus(err instanceof ApiError ? err.status : null);
      setError(err instanceof Error ? err.message : 'Lỗi tải sản phẩm.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchPdp(controller.signal);
    return () => controller.abort();
  }, [slug]);

  // Auto-verify review token if provided in URL
  const verifyReviewToken = async (tokenToCheck: string) => {
    const clean = tokenToCheck.trim();
    if (!clean) {
      setVerifyError('Vui lòng nhập mã xác thực từ trang tra cứu đơn hàng hoàn tất.');
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const json = await fetchJson<{
        order_code: string;
        product_id: number;
        product_name: string;
        default_display_name: string;
        variant_summary: string;
        existing_review: ProductReview | null;
        can_edit: boolean;
      }>(`/api/reviews/verify?token=${encodeURIComponent(clean)}`, {
        fallbackError: 'Không thể xác thực mã đánh giá.',
      });
      if (data && json.product_id !== data.product.id) {
        setVerifyError(
          `Liên kết này dành cho sản phẩm "${json.product_name}". Vui lòng mở đúng trang sản phẩm tương ứng.`
        );
        return;
      }
      setVerifiedInfo(json);
      setRevDisplayName(json.existing_review?.display_name || json.default_display_name || '');
      setRevRating(json.existing_review?.rating || 5);
      setRevComment(json.existing_review?.comment || '');
      setRevImages(json.existing_review?.images || []);
      setRevPreviewStep(false);
    } catch (err) {
      setVerifiedInfo(null);
      setVerifyError(err instanceof Error ? err.message : 'Lỗi kết nối khi xác thực mã đánh giá.');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (reviewTokenFromUrl && data) {
      setReviewPanelOpen(true);
      verifyReviewToken(reviewTokenFromUrl);
    }
  }, [reviewTokenFromUrl, data?.product.id]);

  // Dynamic Schema.org Product JSON-LD matching ONLY real published reviews
  const productJsonLd = useMemo(() => {
    if (!data?.product) return null;
    const p = data.product;
    const ld: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: p.name,
      sku: p.sku,
      description: p.short_description,
      image: p.images,
      brand: { '@type': 'Brand', name: 'Hoa Nelly' },
    };
    if (p.base_price !== null && p.pricing_type !== 'quote') {
      ld.offers = {
        '@type': 'Offer',
        priceCurrency: 'VND',
        price: p.base_price,
        availability:
          p.availability_status === 'paused'
            ? 'https://schema.org/OutOfStock'
            : 'https://schema.org/InStock',
      };
    }
    if (p.review_count > 0) {
      ld.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: p.rating_avg,
        reviewCount: p.review_count,
      };
    }
    return ld;
  }, [data?.product]);

  usePageMeta(
    data?.product ? `${data.product.name} – Hoa Nelly` : 'Chi tiết sản phẩm – Hoa Nelly',
    data?.product?.short_description,
    productJsonLd
  );

  // Price calculation
  const pricing = useMemo(() => {
    if (!data?.product || data.product.base_price === null || data.product.pricing_type === 'quote') {
      return { base: 0, perUnitSurcharge: 0, total: 0 };
    }
    const base = data.product.base_price;
    let variantDelta = 0;
    for (const v of Object.values(selectedVariants)) {
      variantDelta += v.price_delta;
    }
    let addonSum = 0;
    for (const aid of selectedAddonIds) {
      const found = data.product.addons.find((a) => a.id === aid);
      if (found) addonSum += found.price;
    }
    const customTextFee =
      customText.trim() && data.product.personalization.allow_custom_text
        ? data.product.personalization.custom_text_surcharge
        : 0;
    const perUnitSurcharge = variantDelta + addonSum + customTextFee;
    return {
      base,
      perUnitSurcharge,
      total: (base + perUnitSurcharge) * quantity,
    };
  }, [data?.product, selectedVariants, selectedAddonIds, customText, quantity]);

  const variantGroups = useMemo(() => {
    if (!data?.product) return [];
    const grouped: Record<string, ProductVariant[]> = {};
    for (const v of data.product.variants) {
      if (!grouped[v.group]) grouped[v.group] = [];
      grouped[v.group].push(v);
    }
    return Object.entries(grouped);
  }, [data?.product]);

  const filteredReviews = useMemo(() => {
    if (!data) return [];
    let list = [...data.reviews];
    if (starFilter !== null) list = list.filter((r) => r.rating === starFilter);
    if (withPhotosOnly) list = list.filter((r) => r.images.length > 0);
    if (reviewSort === 'oldest') list.reverse();
    return list;
  }, [data, starFilter, withPhotosOnly, reviewSort]);

  const buildCartItem = (): CartItem | null => {
    if (!data?.product || data.product.base_price === null) return null;
    const p = data.product;
    const variantsPayload: CartItem['selected_variants'] = {};
    for (const [grp, v] of Object.entries(selectedVariants)) {
      variantsPayload[grp] = { id: v.id, label: v.label, price_delta: v.price_delta };
    }
    const addonsPayload = p.addons
      .filter((a) => selectedAddonIds.includes(a.id))
      .map((a) => ({ id: a.id, label: a.label, price: a.price }));

    const personalization = {
      card_message: cardMessage.trim() || undefined,
      custom_text: customText.trim() || undefined,
      theme_input: themeInput.trim() || undefined,
      note: note.trim() || undefined,
      reference_image_url: referenceImageUrl || undefined,
      requires_custom_quote: requiresCustomQuote,
    };

    const cartKey = JSON.stringify({
      id: p.id,
      v: Object.values(variantsPayload)
        .map((x) => x.id)
        .sort(),
      a: addonsPayload.map((x) => x.id).sort(),
      p: personalization,
    });

    return {
      cart_key: cartKey,
      product_id: p.id,
      product_slug: p.slug,
      product_name: p.name,
      product_sku: p.sku,
      product_image: activeImage || p.images[0] || '',
      pricing_type: p.pricing_type,
      base_price: p.base_price ?? 0,
      quantity,
      selected_variants: variantsPayload,
      selected_addons: addonsPayload,
      personalization,
      unit_price: pricing.base,
      surcharge_total: pricing.perUnitSurcharge * quantity,
      line_total: pricing.total,
    };
  };

  const handleAddToCart = (goToCheckout = false) => {
    const item = buildCartItem();
    if (!item) return;
    addToCart(item);
    if (goToCheckout) {
      navigate('/dat-hang');
    } else {
      setCartDrawerOpen(true);
    }
  };

  const handleRefImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploadingRef(true);
    try {
      const urls = await uploadImages([e.target.files[0]]);
      if (urls[0]) setReferenceImageUrl(urls[0]);
      showToast('Đã tải ảnh tham khảo.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Không thể tải ảnh.');
    } finally {
      setUploadingRef(false);
      e.target.value = '';
    }
  };

  const handleReviewImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    if (revImages.length + e.target.files.length > 4) {
      setRevSubmitError('Tối đa 4 ảnh cho mỗi đánh giá.');
      return;
    }
    setRevUploading(true);
    setRevSubmitError(null);
    try {
      const urls = await uploadImages(e.target.files);
      setRevImages((prev) => [...prev, ...urls].slice(0, 4));
    } catch (err) {
      setRevSubmitError(err instanceof Error ? err.message : 'Không thể tải ảnh.');
    } finally {
      setRevUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmitReview = async () => {
    if (!verifiedInfo || revSubmitting) return;
    setRevSubmitting(true);
    setRevSubmitError(null);
    try {
      const json = await fetchJson<{ updated?: boolean }>('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        fallbackError: 'Không thể gửi đánh giá.',
        body: JSON.stringify({
          review_token: reviewTokenInput.trim(),
          display_name: revDisplayName.trim(),
          rating: revRating,
          comment: revComment.trim(),
          images: revImages,
        }),
      });
      showToast(json.updated ? 'Đã cập nhật đánh giá của bạn.' : 'Cảm ơn bạn đã gửi đánh giá!');
      setReviewPanelOpen(false);
      setRevPreviewStep(false);
      await fetchPdp();
    } catch (err) {
      setRevSubmitError(err instanceof Error ? err.message : 'Lỗi kết nối khi gửi đánh giá.');
    } finally {
      setRevSubmitting(false);
    }
  };

  const handleQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.product || qaSubmitting) return;
    setQaSubmitting(true);
    setQaError(null);
    try {
      await fetchJson(`/api/products/${data.product.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        fallbackError: 'Không thể gửi câu hỏi.',
        body: JSON.stringify({
          asker_name: askerName.trim(),
          question: questionText.trim(),
        }),
      });
      setAskerName('');
      setQuestionText('');
      showToast('Đã gửi câu hỏi tới Hoa Nelly.');
      await fetchPdp();
    } catch (err) {
      setQaError(err instanceof Error ? err.message : 'Lỗi kết nối khi gửi câu hỏi.');
    } finally {
      setQaSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="hn-page-shell animate-pulse">
        <div className="hn-grid-12">
          <div className="lg:col-span-6 aspect-[4/5] bg-[#F8F5EE] rounded-2xl" />
          <div className="lg:col-span-6 space-y-4">
            <div className="h-4 w-32 bg-[#D8ECF8] rounded" />
            <div className="h-10 w-3/4 bg-[#D8ECF8] rounded" />
            <div className="h-8 w-40 bg-[#F8F5EE] rounded" />
            <div className="h-24 w-full bg-[#F8F5EE] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const isNotFound = errorStatus === 404;
    return (
      <div className="max-w-xl mx-auto px-5 py-12 sm:py-20 text-center space-y-4">
        <h1 className="font-serif text-2xl font-semibold text-[#14222E]">
          {isNotFound ? 'Không tìm thấy sản phẩm' : 'Không thể tải thông tin sản phẩm'}
        </h1>
        <p className="text-sm text-[#5C6F80]">{error || 'Sản phẩm không tồn tại hoặc đã tạm ẩn.'}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {!isNotFound && (
            <button
              type="button"
              onClick={() => fetchPdp()}
              className="inline-flex px-5 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-sm font-medium cursor-pointer"
            >
              Thử tải lại
            </button>
          )}
          <Link
            to="/san-pham"
            className="inline-flex px-5 py-2.5 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] text-[#14222E] hover:bg-[#F9E1E8] text-sm font-medium"
          >
            Quay lại danh mục sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  const { product, reviews, review_distribution, questions, related_products, suggested_accessories } =
    data;
  const isQuoteOnly = product.pricing_type === 'quote' || product.base_price === null;
  const isPaused = product.availability_status === 'paused';

  return (
    <div className="pb-20 lg:pb-0">
      <div className="hn-page-shell">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="text-xs text-[#5C6F80] mb-6 flex flex-wrap items-center gap-2">
          <Link to="/" className="hover:text-[#006A9E]">
            Trang chủ
          </Link>
          <span>/</span>
          <Link to={`/danh-muc/${product.category_slug}`} className="hover:text-[#006A9E]">
            {product.category_name}
          </Link>
          <span>/</span>
          <span className="text-[#14222E] font-medium">{product.name}</span>
        </nav>

        {/* Main 2-Column PDP */}
        <div className="hn-grid-12 items-start">
          {/* Left Sticky Gallery */}
          <div className="lg:col-span-6 lg:sticky lg:top-24 space-y-3.5">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-[#F8F5EE] border border-[#EFECE4] group">
              <div ref={mainMediaRef} className="w-full h-full">
                <SafeImage
                  src={activeImage || product.images[0]}
                  alt={product.name}
                  preset="detail"
                  priority
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={(e) => openLightbox(activeImage || product.images[0], e.currentTarget)}
                className="absolute bottom-3.5 right-3.5 z-10 inline-flex items-center justify-center gap-1.5 min-h-[44px] min-w-[44px] px-3.5 py-2.5 rounded-xl bg-[#FDFBF7]/92 backdrop-blur-sm text-xs font-medium text-[#14222E] border border-[#EFECE4] hover:bg-[#F9E1E8] cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
                <span>Phóng to</span>
              </button>
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                {product.images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-colors ${
                      activeImage === img
                        ? 'border-[#D47B97]'
                        : 'border-[#EFECE4] hover:border-[#D47B97]'
                    }`}
                  >
                    <SafeImage
                      src={img}
                      alt={`${product.name} - ảnh ${i + 1}`}
                      preset="thumbnail"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Purchase Module */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3 pb-6 border-b border-[#EFECE4]">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#5C6F80]">
                <span>{product.category_name}</span>
                <span>·</span>
                <span className="font-mono">Mã: {product.sku}</span>
                <span>·</span>
                <span
                  className={
                    isPaused ? 'text-red-700 font-medium' : 'text-[#0B7A53] font-medium'
                  }
                >
                  {AVAILABILITY_LABELS[product.availability_status]}
                </span>
              </div>

              <h1 className="font-serif text-2xl sm:text-3xl lg:text-[34px] font-medium text-[#14222E]">
                {product.name}
              </h1>

              {/* Real Star Summary */}
              <div className="flex items-center gap-3 text-sm">
                {product.review_count > 0 ? (
                  <a
                    href="#danh-gia"
                    className="inline-flex items-center gap-1.5 text-[#14222E] hover:text-[#006A9E]"
                  >
                    <Star className="w-4 h-4 fill-[#E09619] text-[#E09619]" />
                    <span className="font-semibold tabular-nums">{product.rating_avg.toFixed(1)}</span>
                    <span className="text-[#5C6F80] tabular-nums">
                      ({product.review_count} đánh giá)
                    </span>
                  </a>
                ) : (
                  <a href="#danh-gia" className="text-xs text-[#5C6F80] hover:text-[#006A9E]">
                    Chưa có đánh giá
                  </a>
                )}
              </div>

              {/* Price Display */}
              <div className="pt-1">
                <div className="flex items-baseline gap-3">
                  <p className="text-2xl sm:text-[28px] font-semibold text-[#006A9E] tabular-nums">
                    {isQuoteOnly
                      ? 'Liên hệ báo giá'
                      : requiresCustomQuote
                        ? `${formatVnd(pricing.total)} (Tạm tính · Chờ xác nhận)`
                        : formatVnd(pricing.total)}
                  </p>
                  {product.original_price &&
                    product.base_price &&
                    product.original_price > product.base_price && (
                      <span className="text-sm text-[#5C6F80] line-through tabular-nums">
                        {formatVnd(product.original_price)}
                      </span>
                    )}
                </div>
                {product.pricing_type === 'from' && (
                  <p className="text-xs text-[#5C6F80] mt-1">
                    Giá từ {formatVnd(product.base_price)} áp dụng cho cấu hình cơ bản; tổng tiền cập nhật theo tùy chọn bên dưới.
                  </p>
                )}
              </div>

              <p className="text-sm sm:text-[15px] text-[#5C6F80] leading-relaxed">
                {product.short_description}
              </p>
            </div>

            {/* Variants */}
            {variantGroups.length > 0 && (
              <div className="space-y-5">
                {variantGroups.map(([group, opts]) => (
                  <div key={group} className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-[#14222E]">
                        {VARIANT_GROUP_LABELS[group] || group}
                      </span>
                      {selectedVariants[group] && (
                        <span className="text-xs text-[#5C6F80]">
                          {selectedVariants[group].label}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {opts.map((v) => {
                        const isSelected = selectedVariants[group]?.id === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={!v.in_stock}
                            onClick={() => {
                              setSelectedVariants((prev) => ({ ...prev, [group]: v }));
                              if (v.image_url) setActiveImage(v.image_url);
                            }}
                            className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl text-sm border transition-all disabled:opacity-40 cursor-pointer ${
                              isSelected
                                ? 'border-[#D47B97] bg-[#F4B6C8] text-[#4A1829] font-semibold shadow-[0_6px_16px_-10px_rgba(196,94,128,0.45)]'
                                : 'border-[#EFECE4] bg-[#FDFBF7] text-[#14222E] hover:border-[#D47B97] hover:bg-[#F9E1E8]'
                            }`}
                          >
                            {v.color_hex && (
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                                style={{ backgroundColor: v.color_hex }}
                              />
                            )}
                            <span>{v.label}</span>
                            {v.price_delta > 0 && (
                              <span className="text-xs text-[#5C6F80] tabular-nums">
                                +{formatVnd(v.price_delta)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add-ons */}
            {!isQuoteOnly && product.addons.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <p className="text-sm font-semibold text-[#14222E]">Phụ kiện bổ sung</p>
                <div className="space-y-2">
                  {product.addons.map((addon) => {
                    const checked = selectedAddonIds.includes(addon.id);
                    return (
                      <label
                        key={addon.id}
                        className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? 'border-[#D47B97] bg-[#F9E1E8]/80'
                            : 'border-[#EFECE4] bg-[#FDFBF7] hover:border-[#D47B97]'
                        }`}
                      >
                        <span className="flex items-center gap-2.5 text-sm text-[#14222E]">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedAddonIds((prev) =>
                                checked ? prev.filter((x) => x !== addon.id) : [...prev, addon.id]
                              )
                            }
                            className="accent-[#D83995] w-4 h-4"
                          />
                          <span>{addon.label}</span>
                        </span>
                        <span className="text-sm font-medium text-[#006A9E] tabular-nums">
                          +{formatVnd(addon.price)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Personalization fields (contextual per product) */}
            {!isQuoteOnly && (
              <div className="space-y-4 pt-4 border-t border-[#EFECE4]">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#14222E]">
                  <Heart className="w-4 h-4 hn-icon-heart shrink-0" aria-hidden="true" />
                  <span>Thêm lời nhắn &amp; cá nhân hóa</span>
                </p>

                {product.personalization.allow_custom_text && (
                  <div>
                    <label className="block text-xs font-medium text-[#14222E] mb-1">
                      Tên hoặc lời chúc in trên bóng/túi
                      {product.personalization.custom_text_surcharge > 0
                        ? ` (+${formatVnd(product.personalization.custom_text_surcharge)} khi điền)`
                        : ' (Đã bao gồm)'}
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="Ví dụ: Happy Birthday Minh Anh"
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    />
                  </div>
                )}

                {product.personalization.allow_theme_input && (
                  <div>
                    <label className="block text-xs font-medium text-[#14222E] mb-1">
                      Chi tiết nhân vật / chủ đề mong muốn
                    </label>
                    <input
                      type="text"
                      maxLength={150}
                      value={themeInput}
                      onChange={(e) => setThemeInput(e.target.value)}
                      placeholder="Ví dụ: Tóc ngắn, đeo kính, áo cử nhân màu xanh than..."
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    />
                  </div>
                )}

                {product.personalization.allow_card_message && (
                  <div>
                    <label className="block text-xs font-medium text-[#14222E] mb-1">
                      Nội dung thiệp gửi người nhận (tùy chọn)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={cardMessage}
                      onChange={(e) => setCardMessage(e.target.value)}
                      placeholder="Viết lời chúc để Hoa Nelly ghi giúp bạn..."
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    />
                  </div>
                )}

                {product.personalization.allow_note && (
                  <div>
                    <label className="block text-xs font-medium text-[#14222E] mb-1">
                      Ghi chú thêm cho cửa hàng
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Ví dụ: Đổi nơ sang màu trắng kem, giao nhẹ tay..."
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    />
                  </div>
                )}

                {product.personalization.allow_reference_image && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[#14222E]">
                      Ảnh tham khảo màu sắc / chi tiết (tùy chọn, JPG/PNG/WebP tối đa 5MB)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-xs font-medium text-[#14222E] hover:bg-[#F9E1E8] cursor-pointer">
                        <ImagePlus className="w-4 h-4 text-[#006A9E]" />
                        <span>{uploadingRef ? 'Đang tải...' : 'Chọn ảnh tham khảo'}</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleRefImageUpload}
                          disabled={uploadingRef}
                          className="hidden"
                        />
                      </label>
                      {referenceImageUrl && (
                        <div className="flex items-center gap-2">
                          <SafeImage
                            src={referenceImageUrl}
                            alt="Ảnh tham khảo đã tải"
                            preset="thumbnail"
                            wrapperClassName="w-11 h-11 rounded-lg border border-[#EFECE4]"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setReferenceImageUrl('')}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-2 text-xs text-red-700 hover:underline cursor-pointer"
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <label className="flex items-start gap-2.5 text-xs text-[#5C6F80] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={requiresCustomQuote}
                    onChange={(e) => setRequiresCustomQuote(e.target.checked)}
                    className="mt-0.5 accent-[#006A9E]"
                  />
                  <span>
                    Tôi có yêu cầu chỉnh sửa ngoài bảng giá tiêu chuẩn (đơn hàng sẽ chuyển sang trạng thái chờ cửa hàng xác nhận phụ phí trước khi làm).
                  </span>
                </label>
              </div>
            )}

            {/* Quantity & Primary Actions */}
            <div className="pt-4 border-t border-[#EFECE4] space-y-3">
              {!isQuoteOnly ? (
                <>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-[#14222E]">Số lượng</span>
                    <div className="inline-flex items-center border border-[#EFECE4] rounded-xl bg-[#FDFBF7]">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-11 h-11 inline-flex items-center justify-center hover:bg-[#F9E1E8] rounded-l-xl cursor-pointer"
                        aria-label="Giảm số lượng"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-10 text-center text-sm font-semibold tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                        className="w-11 h-11 inline-flex items-center justify-center hover:bg-[#F9E1E8] rounded-r-xl cursor-pointer"
                        aria-label="Tăng số lượng"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      disabled={isPaused}
                      onClick={() => handleAddToCart(false)}
                      className="hn-btn-secondary inline-flex items-center justify-center gap-2 min-h-[48px] py-3.5 px-5 text-sm font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Thêm vào giỏ</span>
                    </button>
                    <button
                      type="button"
                      disabled={isPaused}
                      onClick={() => handleAddToCart(true)}
                      className="hn-btn-primary inline-flex items-center justify-center min-h-[48px] py-3.5 px-5 text-sm font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Mua ngay
                    </button>
                  </div>
                </>
              ) : (
                <Link
                  to={
                    product.category_slug === 'trang-tri-su-kien'
                      ? `/trang-tri-su-kien?mau=${encodeURIComponent(product.name)}`
                      : `/dat-thiet-ke-rieng?mau=${encodeURIComponent(product.name)}`
                  }
                  className="hn-btn-primary flex items-center justify-center w-full min-h-[48px] text-center py-3.5 px-5 text-sm font-semibold"
                >
                  {product.category_slug === 'trang-tri-su-kien'
                    ? 'Nhận tư vấn & báo giá sự kiện'
                    : 'Gửi yêu cầu báo giá mẫu này'}
                </Link>
              )}

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1 text-xs sm:text-sm">
                <Link
                  to={`/lien-he?chuDe=${encodeURIComponent(`Tư vấn mẫu ${product.name} (${product.sku})`)}`}
                  className="inline-flex items-center min-h-[44px] sm:min-h-0 text-[#006A9E] font-medium hover:underline underline-offset-4"
                >
                  Tư vấn mẫu này
                </Link>
                <span className="text-[#D8ECF8]" aria-hidden="true">|</span>
                <Link
                  to={`/dat-thiet-ke-rieng?mau=${encodeURIComponent(product.name)}`}
                  className="inline-flex items-center min-h-[44px] sm:min-h-0 text-[#14222E] hover:text-[#006A9E] hover:underline underline-offset-4"
                >
                  Yêu cầu thiết kế tương tự
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Specifications */}
        <ScrollReveal once y={20}>
          <section className="mt-12 sm:mt-14 pt-10 sm:pt-12 border-t border-[#EFECE4]">
            <CinematicHeading
              as="h2"
              className="font-serif text-2xl font-medium text-[#14222E] mb-6"
            >
              Thông tin chi tiết sản phẩm
            </CinematicHeading>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 sm:p-8 text-sm">
              {[
                ['Thành phần bộ sản phẩm', product.specs.components],
                ['Kích thước ước tính', product.specs.dimensions],
                ['Vật liệu', product.specs.materials],
                ['Phụ kiện đi kèm', product.specs.included_accessories],
                ['Phần có thể tùy chỉnh', product.specs.customizable_parts],
                ['Hướng dẫn sử dụng & bảo quản', product.specs.care_guide],
                ['Thời gian chuẩn bị', product.specs.prep_time],
                ['Điều kiện giao nhận', product.specs.delivery_notes],
                ['Lưu ý từ Hoa Nelly', product.specs.store_notes],
              ]
                .filter(([, val]) => Boolean(val))
                .map(([label, val]) => (
                  <div key={label} className="space-y-1">
                    <dt className="font-semibold text-[#14222E]">{label}</dt>
                    <dd className="text-[#5C6F80] leading-relaxed">{val}</dd>
                  </div>
                ))}
            </dl>
          </section>
        </ScrollReveal>

        {/* SECTION 8: REVIEWS & HOA NELLY REPLIES */}
        <section id="danh-gia" className="mt-12 sm:mt-14 pt-10 sm:pt-12 border-t border-[#EFECE4] scroll-mt-24">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-serif text-2xl font-semibold text-[#14222E]">
                Đánh giá từ khách hàng
              </h2>
              <p className="text-xs sm:text-sm text-[#5C6F80] mt-1">
                Chỉ đơn hàng hoàn tất mới có liên kết xác thực gửi đánh giá. Hoa Nelly giữ nguyên nhận xét trung thực.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReviewPanelOpen((v) => !v)}
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D47B97] text-[#006A9E] text-sm font-medium hover:bg-[#F9E1E8] self-start sm:self-auto cursor-pointer"
            >
              {reviewPanelOpen ? 'Đóng khung gửi đánh giá' : 'Viết đánh giá (dành cho khách đã mua)'}
            </button>
          </div>

          {/* Verified Review Submission Panel */}
          {reviewPanelOpen && (
            <div className="mb-8 bg-[#FDFBF7] rounded-2xl border border-[#E093AB] p-5 sm:p-7 space-y-5">
              <div>
                <h3 className="font-serif text-lg font-semibold text-[#14222E]">
                  Xác thực đơn hàng để gửi đánh giá
                </h3>
                <p className="text-xs sm:text-sm text-[#5C6F80] mt-1">
                  Nhập mã xác thực đánh giá từ trang{' '}
                  <Link to="/tra-cuu-don-hang" className="text-[#006A9E] underline">
                    Tra cứu đơn hàng
                  </Link>{' '}
                  (hiển thị khi đơn hàng ở trạng thái Hoàn tất).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={reviewTokenInput}
                  onChange={(e) => setReviewTokenInput(e.target.value)}
                  placeholder="Dán mã xác thực đánh giá của sản phẩm trong đơn hoàn tất..."
                  className="flex-1 px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg font-mono"
                />
                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => verifyReviewToken(reviewTokenInput)}
                  className="px-5 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] disabled:opacity-50"
                >
                  {verifying ? 'Đang kiểm tra...' : 'Xác thực đơn'}
                </button>
              </div>

              {verifyError && <p className="text-sm text-red-700">{verifyError}</p>}

              {verifiedInfo && (
                <div className="pt-4 border-t border-[#EFECE4] space-y-4">
                  <div className="flex items-center gap-2 text-xs text-[#0B7A53] font-medium">
                    <Check className="w-4 h-4" />
                    <span>
                      Đã xác minh đơn hàng {verifiedInfo.order_code}
                      {verifiedInfo.variant_summary ? ` · ${verifiedInfo.variant_summary}` : ''}
                    </span>
                  </div>

                  {!verifiedInfo.can_edit ? (
                    <p className="text-sm text-[#5C6F80]">
                      Bạn đã đánh giá lượt mua này và đã quá thời hạn 7 ngày chỉnh sửa.
                    </p>
                  ) : !revPreviewStep ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-[#14222E] mb-1.5">
                          Mức độ hài lòng (1 đến 5 sao)
                        </label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setRevRating(star)}
                              className="w-11 h-11 inline-flex items-center justify-center rounded-xl hover:bg-[#F9E1E8]/60 cursor-pointer"
                              aria-label={`${star} sao`}
                            >
                              <Star
                                className={`w-7 h-7 ${
                                  star <= revRating
                                    ? 'fill-[#E09619] text-[#E09619]'
                                    : 'text-[#D8ECF8]'
                                }`}
                              />
                            </button>
                          ))}
                          <span className="text-sm font-medium text-[#14222E] ml-2">
                            {revRating} / 5 sao
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#14222E] mb-1">
                          Tên hiển thị công khai (không công khai SĐT hay email của bạn)
                        </label>
                        <input
                          type="text"
                          value={revDisplayName}
                          onChange={(e) => setRevDisplayName(e.target.value)}
                          maxLength={80}
                          className="w-full max-w-md min-h-[44px] px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-[#14222E] mb-1">
                          Nhận xét của bạn
                        </label>
                        <textarea
                          rows={3}
                          value={revComment}
                          onChange={(e) => setRevComment(e.target.value)}
                          maxLength={1500}
                          placeholder="Chia sẻ trải nghiệm thực tế về dáng hoa, màu sắc, đóng gói và thời gian giao..."
                          className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-[#14222E]">
                          Ảnh thực tế sản phẩm (tối đa 4 ảnh · JPG, PNG, WebP · mỗi ảnh ≤ 5MB)
                        </label>
                        <div className="flex flex-wrap items-center gap-3">
                          {revImages.length < 4 && (
                            <label className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#EFECE4] text-xs font-medium cursor-pointer hover:bg-[#F9E1E8]">
                              <ImagePlus className="w-4 h-4 text-[#006A9E]" />
                              <span>{revUploading ? 'Đang tải...' : 'Thêm ảnh'}</span>
                              <input
                                type="file"
                                multiple
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleReviewImagesUpload}
                                disabled={revUploading}
                                className="hidden"
                              />
                            </label>
                          )}
                          {revImages.map((url, idx) => (
                            <div key={url} className="relative w-16 h-16">
                              <SafeImage
                                src={url}
                                alt={`Ảnh đánh giá ${idx + 1}`}
                                preset="thumbnail"
                                wrapperClassName="w-16 h-16 rounded-lg border border-[#EFECE4]"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setRevImages((prev) => prev.filter((_, i) => i !== idx))
                                }
                                className="absolute -top-3.5 -right-3.5 w-11 h-11 inline-flex items-center justify-center cursor-pointer"
                                aria-label="Xóa ảnh"
                              >
                                <span className="w-6 h-6 rounded-full bg-[#14222E] text-white flex items-center justify-center shadow-sm">
                                  <X className="w-3.5 h-3.5" />
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {revSubmitError && <p className="text-sm text-red-700">{revSubmitError}</p>}

                      <button
                        type="button"
                        onClick={() => {
                          if (revComment.trim().length < 5) {
                            setRevSubmitError('Vui lòng viết nhận xét tối thiểu 5 ký tự.');
                            return;
                          }
                          setRevSubmitError(null);
                          setRevPreviewStep(true);
                        }}
                        className="px-5 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5]"
                      >
                        Xem lại trước khi gửi
                      </button>
                    </div>
                  ) : (
                    /* Preview step before final submit */
                    <div className="p-4 rounded-xl bg-[#FDFBF7] border border-[#EFECE4] space-y-3">
                      <p className="text-xs font-semibold text-[#006A9E]">
                        Xem trước nội dung đánh giá sẽ hiển thị công khai
                      </p>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold text-[#14222E]">
                          {revDisplayName || verifiedInfo.default_display_name}
                        </span>
                        <span className="text-xs text-[#0B7A53]">· Đã mua hàng</span>
                        <span className="text-xs text-[#E09619] font-semibold">{revRating} sao</span>
                      </div>
                      <p className="text-sm text-[#14222E]">{revComment}</p>
                      {revImages.length > 0 && (
                        <div className="flex gap-2">
                          {revImages.map((u) => (
                            <SafeImage
                              key={u}
                              src={u}
                              alt="Xem trước ảnh"
                              preset="thumbnail"
                              wrapperClassName="w-16 h-16 rounded-lg border border-[#EFECE4]"
                              className="w-full h-full object-cover"
                            />
                          ))}
                        </div>
                      )}
                      {revSubmitError && <p className="text-sm text-red-700">{revSubmitError}</p>}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setRevPreviewStep(false)}
                          className="px-4 py-2 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] text-sm"
                        >
                          Chỉnh sửa lại
                        </button>
                        <button
                          type="button"
                          disabled={revSubmitting}
                          onClick={handleSubmitReview}
                          className="px-5 py-2 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] disabled:opacity-50"
                        >
                          {revSubmitting
                            ? 'Đang gửi...'
                            : verifiedInfo.existing_review
                              ? 'Xác nhận cập nhật đánh giá'
                              : 'Xác nhận đăng đánh giá'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Review Summary + Distribution */}
          {product.review_count === 0 ? (
            <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-8 text-center space-y-2">
              <p className="font-serif text-lg font-semibold text-[#14222E]">Chưa có đánh giá</p>
              <p className="text-sm text-[#5C6F80] max-w-md mx-auto">
                Sản phẩm này hiện chưa có đánh giá công khai. Nếu bạn đã hoàn tất đơn hàng với mẫu này, hãy dùng mã xác thực đơn để chia sẻ cảm nhận đầu tiên.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6">
                <div className="md:col-span-4 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-[#EFECE4] pb-5 md:pb-0">
                  <p className="text-4xl font-semibold text-[#14222E] tabular-nums">
                    {product.rating_avg.toFixed(1)}
                    <span className="text-lg font-normal text-[#5C6F80]"> / 5</span>
                  </p>
                  <div className="flex items-center gap-1 my-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${
                          s <= Math.round(product.rating_avg)
                            ? 'fill-[#E09619] text-[#E09619]'
                            : 'text-[#D8ECF8]'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-[#5C6F80] tabular-nums">
                    Dựa trên {product.review_count} đánh giá hợp lệ
                  </p>
                </div>

                {/* 5-to-1 Distribution Chart */}
                <div className="md:col-span-8 space-y-1 justify-center flex flex-col">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = review_distribution[star] || 0;
                    const pct =
                      product.review_count > 0 ? Math.round((count / product.review_count) * 100) : 0;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setStarFilter(starFilter === star ? null : star)}
                        className="flex items-center gap-3 text-xs w-full min-h-[44px] sm:min-h-[32px] py-1 group cursor-pointer"
                      >
                        <span className="w-10 text-left font-medium text-[#14222E] tabular-nums">
                          {star} sao
                        </span>
                        <div className="flex-1 h-2 bg-[#F8F5EE] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#E587A8] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-[#5C6F80] tabular-nums">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStarFilter(null);
                      setWithPhotosOnly(false);
                    }}
                    className={`inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      starFilter === null && !withPhotosOnly
                        ? 'bg-[#F4B6C8] text-[#4A1829] border-[#D47B97] font-semibold'
                        : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:border-[#D47B97]'
                    }`}
                  >
                    Tất cả ({reviews.length})
                  </button>
                  {[5, 4, 3, 2, 1].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStarFilter(starFilter === s ? null : s)}
                      className={`inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                        starFilter === s
                          ? 'bg-[#F4B6C8] text-[#4A1829] border-[#D47B97] font-semibold'
                          : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:border-[#D47B97]'
                      }`}
                    >
                      {s} sao ({review_distribution[s] || 0})
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setWithPhotosOnly((v) => !v)}
                    className={`inline-flex items-center justify-center min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                      withPhotosOnly
                        ? 'bg-[#F4B6C8] text-[#4A1829] border-[#D47B97] font-semibold'
                        : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:border-[#D47B97]'
                    }`}
                  >
                    Xem ảnh khách gửi
                  </button>
                </div>

                <select
                  value={reviewSort}
                  onChange={(e) => setReviewSort(e.target.value as 'newest' | 'oldest')}
                  aria-label="Sắp xếp đánh giá"
                  className="min-h-[44px] bg-[#FDFBF7] border border-[#EFECE4] rounded-xl px-3 py-2 text-xs text-[#14222E]"
                >
                  <option value="newest">Mới nhất</option>
                  <option value="oldest">Cũ nhất</option>
                </select>
              </div>

              {/* Reviews List */}
              <div className="space-y-4">
                {filteredReviews.length === 0 ? (
                  <p className="text-sm text-[#5C6F80] py-6 text-center bg-[#FDFBF7] rounded-xl border border-[#EFECE4]">
                    Không có đánh giá nào khớp bộ lọc đang chọn.
                  </p>
                ) : (
                  filteredReviews.slice(0, visibleReviewsCount).map((rev) => (
                    <article
                      key={rev.id}
                      className="bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-semibold text-[#14222E]">{rev.display_name}</span>
                          {rev.verified_purchase && (
                            <span className="text-xs font-medium text-[#0B7A53]">
                              · Đã mua hàng
                            </span>
                          )}
                          {rev.variant_summary && (
                            <span className="text-xs text-[#5C6F80]">· {rev.variant_summary}</span>
                          )}
                        </div>
                        <span className="text-xs text-[#5C6F80] tabular-nums">
                          {formatDateVi(rev.created_at)}
                          {rev.is_edited ? ' · Đã chỉnh sửa' : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-0.5" aria-label={`${rev.rating} sao`}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= rev.rating
                                ? 'fill-[#E09619] text-[#E09619]'
                                : 'text-[#D8ECF8]'
                            }`}
                          />
                        ))}
                      </div>

                      <p className="text-sm text-[#14222E] leading-relaxed whitespace-pre-line">
                        {rev.comment}
                      </p>

                      {rev.images.length > 0 && (
                        <div className="flex flex-wrap gap-2.5 pt-1">
                          {rev.images.map((img, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={(e) => openLightbox(img, e.currentTarget)}
                              className="w-20 h-20 rounded-lg overflow-hidden border border-[#EFECE4] cursor-pointer"
                            >
                              <SafeImage
                                src={img}
                                alt={`Ảnh đánh giá ${i + 1}`}
                                preset="thumbnail"
                              />
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Official Hoa Nelly Reply */}
                      {rev.reply && (
                        <div className="mt-4 p-4 rounded-xl bg-[#F8F5EE]/70 border border-[#EFECE4] space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-[#006A9E]">
                              Phản hồi từ Hoa Nelly · {rev.reply.staff_name}
                            </span>
                            <span className="text-[#5C6F80] tabular-nums">
                              {formatDateTimeVi(rev.reply.updated_at)}
                              {rev.reply.is_edited ? ' · Đã chỉnh sửa' : ''}
                            </span>
                          </div>
                          <p className="text-sm text-[#14222E] leading-relaxed whitespace-pre-line">
                            {rev.reply.content}
                          </p>
                        </div>
                      )}
                    </article>
                  ))
                )}
                {filteredReviews.length > visibleReviewsCount && (
                  <div className="flex justify-center pt-2">
                    <button
                      type="button"
                      onClick={() => setVisibleReviewsCount((n) => n + 10)}
                      className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl border border-[#D47B97] bg-[#FDFBF7] text-xs font-semibold text-[#4A1829] hover:bg-[#F9E1E8] transition-colors cursor-pointer"
                    >
                      Xem thêm đánh giá (còn {filteredReviews.length - visibleReviewsCount} đánh giá)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* SECTION 8.6: PRODUCT Q&A */}
        <section id="hoi-dap" className="mt-12 sm:mt-14 pt-10 sm:pt-12 border-t border-[#EFECE4]">
          <div className="hn-grid-12">
            <div className="lg:col-span-5 space-y-4">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-[#14222E]">
                  Hỏi đáp về sản phẩm
                </h2>
                <p className="text-sm text-[#5C6F80] mt-1">
                  Đặt câu hỏi về màu sắc, thời gian làm hoặc khả năng tùy chỉnh trước khi mua. Câu hỏi không ảnh hưởng đến điểm đánh giá sao.
                </p>
              </div>

              <form
                onSubmit={handleQuestionSubmit}
                className="bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-5 space-y-3.5"
              >
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Tên của bạn
                  </label>
                  <input
                    type="text"
                    required
                    value={askerName}
                    onChange={(e) => setAskerName(e.target.value)}
                    placeholder="Ví dụ: Ngọc Lan"
                    className="w-full px-3.5 py-2 text-sm border border-[#EFECE4] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Câu hỏi của bạn
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    placeholder="Ví dụ: Mẫu này có thể đổi sang tông tím pastel không?"
                    className="w-full px-3.5 py-2 text-sm border border-[#EFECE4] rounded-lg"
                  />
                </div>
                {qaError && <p className="text-xs text-red-700">{qaError}</p>}
                <button
                  type="submit"
                  disabled={qaSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{qaSubmitting ? 'Đang gửi...' : 'Gửi câu hỏi'}</span>
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-3.5">
              {questions.length === 0 ? (
                <div className="bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-8 text-center text-sm text-[#5C6F80]">
                  Chưa có câu hỏi nào cho sản phẩm này. Hãy gửi thắc mắc của bạn để Hoa Nelly giải đáp.
                </div>
              ) : (
                questions.slice(0, visibleQuestionsCount).map((q) => (
                  <div
                    key={q.id}
                    className="bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#5C6F80]">
                      <span className="font-semibold text-[#14222E]">{q.asker_name}</span>
                      <span className="tabular-nums">{formatDateVi(q.created_at)}</span>
                    </div>
                    <p className="text-sm text-[#14222E]">{q.question}</p>
                    {q.answer ? (
                      <div className="p-3.5 rounded-lg bg-[#F8F5EE] text-sm space-y-1">
                        <p className="text-xs font-semibold text-[#006A9E]">
                          Trả lời từ Hoa Nelly{q.answered_by ? ` · ${q.answered_by}` : ''}
                        </p>
                        <p className="text-[#14222E]">{q.answer}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-[#5C6F80] italic">
                        Hoa Nelly đã nhận câu hỏi và sẽ phản hồi sớm.
                      </p>
                    )}
                  </div>
                ))
              )}
              {questions.length > visibleQuestionsCount && (
                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={() => setVisibleQuestionsCount((n) => n + 8)}
                    className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-xs font-semibold text-[#14222E] hover:border-[#D47B97] hover:bg-[#F9E1E8] transition-colors cursor-pointer"
                  >
                    Xem thêm câu hỏi (còn {questions.length - visibleQuestionsCount} câu hỏi)
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Suggested Accessories & Related Products */}
        {suggested_accessories.length > 0 && (
          <section className="mt-12 sm:mt-14 pt-10 sm:pt-12 border-t border-[#EFECE4]">
            <CinematicHeading
              as="h2"
              className="font-serif text-2xl font-medium text-[#14222E] mb-6"
            >
              Phụ kiện &amp; quà tặng gợi ý mua kèm
            </CinematicHeading>
            <ScrollReveal
              staggerSelector=".hn-product-card"
              once
              y={18}
              stagger={0.06}
              className="hn-grid-3"
            >
              {suggested_accessories.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ScrollReveal>
          </section>
        )}

        {related_products.length > 0 && (
          <section className="mt-12 sm:mt-14 pt-10 sm:pt-12 border-t border-[#EFECE4]">
            <CinematicHeading
              as="h2"
              className="font-serif text-2xl font-medium text-[#14222E] mb-6"
            >
              Sản phẩm tương tự
            </CinematicHeading>
            <ScrollReveal
              staggerSelector=".hn-product-card"
              once
              y={18}
              stagger={0.06}
              className="hn-grid-4"
            >
              {related_products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </ScrollReveal>
          </section>
        )}
      </div>

      {/* Mobile Compact Bottom Sticky Action Bar (z-[35], above page content & Back-to-Top) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-[35] bg-[#FDFBF7]/96 backdrop-blur-md border-t border-[#EFECE4] px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3 shadow-[0_-8px_24px_-14px_rgba(20,34,46,0.18)]">
        <div className="min-w-0">
          <p className="text-[11px] text-[#5C6F80] truncate">{product.name}</p>
          <p className="text-sm font-semibold text-[#006A9E] tabular-nums">
            {isQuoteOnly ? 'Liên hệ báo giá' : formatVnd(pricing.total)}
          </p>
        </div>
        {!isQuoteOnly ? (
          <button
            type="button"
            disabled={isPaused}
            onClick={() => handleAddToCart(false)}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold shrink-0 disabled:opacity-40 cursor-pointer"
          >
            Thêm vào giỏ
          </button>
        ) : (
          <Link
            to={
              product.category_slug === 'trang-tri-su-kien'
                ? `/trang-tri-su-kien?mau=${encodeURIComponent(product.name)}`
                : `/dat-thiet-ke-rieng?mau=${encodeURIComponent(product.name)}`
            }
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold shrink-0"
          >
            {product.category_slug === 'trang-tri-su-kien' ? 'Tư vấn sự kiện' : 'Nhận báo giá'}
          </Link>
        )}
      </div>

      {/* Accessible Lightbox Modal (Portaled to body at z-[70], supports Prev/Next & touch swipe) */}
      {lightboxImage &&
        createPortal(
          <div
            ref={lightboxBackdropRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Xem phóng to ảnh ${product.name}`}
            data-lenis-prevent
            data-hn-overlay-layer="lightbox"
            className="fixed inset-0 z-[70] bg-[#14222E]/88 backdrop-blur-[2px] flex items-center justify-center p-4 overscroll-contain"
            onClick={closeLightbox}
          >
            <button
              ref={lightboxCloseBtnRef}
              type="button"
              onClick={closeLightbox}
              className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 sm:top-5 sm:right-5 z-20 w-11 h-11 rounded-full bg-[#FDFBF7] text-[#14222E] shadow-lg flex items-center justify-center hover:bg-[#F9E1E8] transition-colors cursor-pointer"
              aria-label="Đóng xem ảnh lớn"
            >
              <X className="w-5 h-5" />
            </button>

            {canNavigateLightbox && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showPrevLightboxImage();
                  }}
                  aria-label="Ảnh sản phẩm trước"
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#FDFBF7]/92 text-[#14222E] shadow-lg flex items-center justify-center hover:bg-[#F9E1E8] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    showNextLightboxImage();
                  }}
                  aria-label="Ảnh sản phẩm tiếp theo"
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#FDFBF7]/92 text-[#14222E] shadow-lg flex items-center justify-center hover:bg-[#F9E1E8] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            <div
              ref={lightboxPanelRef}
              className="relative w-[92vw] max-w-4xl h-[82vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => {
                if (e.touches.length !== 1) return;
                lightboxTouchRef.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                };
              }}
              onTouchEnd={(e) => {
                const start = lightboxTouchRef.current;
                lightboxTouchRef.current = null;
                if (!start || e.changedTouches.length !== 1 || !canNavigateLightbox) return;
                const dx = e.changedTouches[0].clientX - start.x;
                const dy = e.changedTouches[0].clientY - start.y;
                if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
                  if (dx < 0) showNextLightboxImage();
                  else showPrevLightboxImage();
                }
              }}
            >
              <SafeImage
                src={lightboxImage}
                alt="Xem chi tiết ảnh"
                preset="lightbox"
                priority
                objectFit="contain"
                wrapperClassName="w-full h-full rounded-xl bg-transparent"
                className="w-full h-full object-contain rounded-xl"
              />
              {canNavigateLightbox && (
                <span className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/92 text-[#14222E] text-xs font-semibold tabular-nums shadow-sm">
                  {lightboxProductIdx + 1} / {productGalleryImages.length}
                </span>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
