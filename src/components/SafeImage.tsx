import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEventHandler } from 'react';
import {
  IMAGE_PRESETS,
  buildOptimizedImageUrl,
  buildResponsiveImageProps,
} from '../lib/imageOptimizer.ts';
import type { ImagePreset } from '../lib/imageOptimizer.ts';

export { IMAGE_PRESETS, buildOptimizedImageUrl, buildResponsiveImageProps };
export type { ImagePreset };

export interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  preset?: ImagePreset;
  widths?: readonly number[];
  sizes?: string;
  quality?: number;
  priority?: boolean;
  blurPlaceholder?: boolean;
  objectFit?: 'cover' | 'contain';
  className?: string;
  wrapperClassName?: string;
  loading?: 'lazy' | 'eager';
  onClick?: MouseEventHandler<HTMLImageElement>;
}

export function SafeImage({
  src,
  alt,
  preset = 'card',
  widths,
  sizes,
  quality,
  priority,
  blurPlaceholder = true,
  objectFit = 'contain',
  className = 'w-full h-full object-contain object-center',
  wrapperClassName = 'w-full h-full',
  loading,
  onClick,
}: SafeImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [useRawFallback, setUseRawFallback] = useState(false);
  const [failed, setFailed] = useState(false);

  const isPriority =
    priority ?? (loading !== undefined ? loading === 'eager' : Boolean(IMAGE_PRESETS[preset]?.priority));
  const resolvedLoading: 'eager' | 'lazy' = loading ?? (isPriority ? 'eager' : 'lazy');

  const responsive = useMemo(
    () =>
      buildResponsiveImageProps(src, {
        preset,
        widths,
        sizes,
        quality,
      }),
    [src, preset, widths, sizes, quality]
  );

  const finalSrc = useRawFallback ? (src || '') : responsive.src;
  const finalSrcSet = useRawFallback ? undefined : responsive.srcSet;
  const finalSizes = useRawFallback ? undefined : responsive.sizes;

  // Reset error/fallback only when the incoming source prop changes
  useEffect(() => {
    setFailed(false);
    setUseRawFallback(false);
  }, [src]);

  // Synchronize loaded state cleanly for each distinct rendered image URL
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setLoaded(true);
    } else {
      setLoaded(false);
    }
  }, [finalSrc]);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[#F8F5EE] text-[#4A1829]/70 p-4 text-center ${wrapperClassName}`}
        role="img"
        aria-label={alt}
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          className="w-8 h-8 mb-1.5 opacity-60 shrink-0"
          aria-hidden="true"
        >
          <path
            d="M18 5C14.2 5 11.5 8.2 11.5 12.2C11.5 16.4 14.8 19.6 18 21.4C21.2 19.6 24.5 16.4 24.5 12.2C24.5 8.2 21.8 5 18 5Z"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path d="M18 21.6V31" stroke="#0297DE" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {alt && <span className="text-xs text-[#5C6F80] line-clamp-2 max-w-[180px]">{alt}</span>}
      </div>
    );
  }

  const showBlurLayer = Boolean(blurPlaceholder && !isPriority && responsive.lqipSrc && !useRawFallback);
  const fitClass = objectFit === 'cover' ? 'object-cover object-center' : 'object-contain object-center';
  const resolvedImgClass =
    objectFit === 'contain'
      ? className.replace(/\bobject-cover\b/g, 'object-contain object-center')
      : className;

  const handleError = () => {
    if (!useRawFallback && responsive.isOptimizable) {
      setUseRawFallback(true);
      return;
    }
    setFailed(true);
  };

  return (
    <div className={`relative overflow-hidden bg-[#F8F5EE] ${wrapperClassName}`}>
      {showBlurLayer && (
        <img
          src={responsive.lqipSrc}
          alt=""
          aria-hidden="true"
          decoding="async"
          referrerPolicy="no-referrer"
          className={`absolute inset-0 w-full h-full ${fitClass} blur-md scale-105 pointer-events-none select-none transition-opacity duration-300 ease-out motion-reduce:transition-none ${
            loaded ? 'opacity-0' : 'opacity-100'
          }`}
        />
      )}
      <img
        key={finalSrc}
        ref={imgRef}
        src={finalSrc}
        srcSet={finalSrcSet}
        sizes={finalSizes}
        alt={alt}
        loading={resolvedLoading}
        decoding={isPriority ? 'sync' : 'async'}
        fetchPriority={isPriority ? 'high' : 'auto'}
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={handleError}
        onClick={onClick}
        className={`relative z-[1] ${resolvedImgClass} transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          isPriority || loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}

export const OptimizedImage = SafeImage;
