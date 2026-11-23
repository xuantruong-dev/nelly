import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import type { Product } from '../../shared/types.ts';
import { formatProductPrice } from '../lib/format.ts';
import { MOTION_CONFIG, gsap, useGSAP } from '../lib/motionConfig.ts';
import { SafeImage } from './SafeImage.tsx';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const colorVariants = product.variants.filter((v) => v.group === 'color' && v.color_hex);
  const mediaZoneRef = useRef<HTMLAnchorElement>(null);
  const tiltInnerRef = useRef<HTMLDivElement>(null);

  // Selective, gentle 3D tilt strictly on the image frame on desktop mice;
  // product name, price, stars, and CTA remain completely flat and steady.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: MOTION_CONFIG.media.reducedMotion,
          hasFinePointer: MOTION_CONFIG.media.desktopFinePointer,
        },
        (context) => {
          const { reduceMotion, hasFinePointer } = context.conditions || {};
          if (reduceMotion || !hasFinePointer || !mediaZoneRef.current || !tiltInnerRef.current) {
            return;
          }

          const zone = mediaZoneRef.current;
          const inner = tiltInnerRef.current;
          const rotXTo = gsap.quickTo(inner, 'rotationX', {
            duration: 0.35,
            ease: MOTION_CONFIG.eases.soft,
          });
          const rotYTo = gsap.quickTo(inner, 'rotationY', {
            duration: 0.35,
            ease: MOTION_CONFIG.eases.soft,
          });
          const maxDeg = MOTION_CONFIG.depth3D.cardMaxTiltDeg;

          const onMove = (e: PointerEvent) => {
            const rect = zone.getBoundingClientRect();
            const nx = (e.clientX - rect.left) / rect.width - 0.5;
            const ny = (e.clientY - rect.top) / rect.height - 0.5;
            rotYTo(nx * maxDeg * 2);
            rotXTo(-ny * maxDeg * 2);
          };

          const onLeave = () => {
            rotXTo(0);
            rotYTo(0);
          };

          zone.addEventListener('pointermove', onMove);
          zone.addEventListener('pointerleave', onLeave);
          return () => {
            zone.removeEventListener('pointermove', onMove);
            zone.removeEventListener('pointerleave', onLeave);
          };
        }
      );
    },
    { scope: mediaZoneRef }
  );

  return (
    <article className="hn-product-card group flex flex-col bg-[#FDFBF7] rounded-xl border border-[#EFECE4] overflow-hidden transition-all duration-200 hover:border-[#E093AB] hover:shadow-[0_16px_32px_-20px_rgba(196,94,128,0.32)]">
      <Link
        ref={mediaZoneRef}
        to={`/san-pham/${product.slug}`}
        className="relative block aspect-[4/5] w-full overflow-hidden bg-[#F8F5EE] hn-perspective"
      >
        <div ref={tiltInnerRef} className="w-full h-full hn-preserve-3d scale-[1.03]">
          <SafeImage
            src={product.images[0]}
            alt={product.name}
            preset="card"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      </Link>

      <div className="flex flex-col flex-1 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 text-[12.5px] text-[#4A5C6B] mb-1.5">
          <span className="truncate">{product.category_name}</span>
        </div>

        <h3 className="font-serif font-medium text-[17.5px] leading-[1.35] text-[#14222E] mb-2.5 line-clamp-2">
          <Link
            to={`/san-pham/${product.slug}`}
            className="hover:text-[#006A9E] transition-colors"
          >
            {product.name}
          </Link>
        </h3>

        <div className="flex items-center justify-between gap-2 min-h-[20px] mb-3.5">
          {colorVariants.length > 0 ? (
            <div className="flex items-center gap-1.5" aria-label="Tùy chọn màu sắc">
              {colorVariants.slice(0, 4).map((cv) => (
                <span
                  key={cv.id}
                  title={cv.label}
                  className="w-3.5 h-3.5 rounded-full border border-[#14222E]/15 shrink-0"
                  style={{ backgroundColor: cv.color_hex }}
                />
              ))}
            </div>
          ) : (
            <span className="text-[12.5px] text-[#4A5C6B]">
              {product.colors.slice(0, 2).join(' · ')}
            </span>
          )}

          {product.review_count > 0 && (
            <span className="inline-flex items-center gap-1 text-[12.5px] text-[#14222E] tabular-nums shrink-0">
              <Star className="w-3.5 h-3.5 fill-[#E09619] text-[#E09619]" aria-hidden="true" />
              <span className="font-medium">{product.rating_avg.toFixed(1)}</span>
              <span className="text-[#4A5C6B]">({product.review_count})</span>
            </span>
          )}
        </div>

        <div className="mt-auto pt-3 border-t border-[#EFECE4] flex items-center justify-between gap-3">
          <div>
            <p className="text-[15.5px] font-semibold text-[#006A9E] tabular-nums">
              {formatProductPrice(product)}
            </p>
            {product.original_price &&
              product.base_price &&
              product.original_price > product.base_price && (
                <p className="text-[12.5px] text-[#4A5C6B] line-through tabular-nums">
                  {product.original_price.toLocaleString('vi-VN')}₫
                </p>
              )}
          </div>

          <Link
            to={
              product.pricing_type === 'quote'
                ? product.category_slug === 'trang-tri-su-kien'
                  ? `/trang-tri-su-kien?mau=${encodeURIComponent(product.name)}`
                  : `/dat-thiet-ke-rieng?mau=${encodeURIComponent(product.name)}`
                : `/san-pham/${product.slug}`
            }
            className="inline-flex items-center min-h-[44px] text-[13px] font-medium text-[#4A1829] hover:text-[#D83995] underline underline-offset-4 decoration-[#E093AB] whitespace-nowrap shrink-0 py-2"
          >
            {product.pricing_type === 'quote' ? 'Gửi yêu cầu báo giá' : 'Chọn màu & đặt'}
          </Link>
        </div>
      </div>
    </article>
  );
}
