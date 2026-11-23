export type ImagePreset =
  | 'hero'
  | 'card'
  | 'detail'
  | 'gallery'
  | 'lightbox'
  | 'thumbnail';

export interface ImagePresetConfig {
  widths: readonly number[];
  defaultWidth: number;
  sizes: string;
  quality: number;
  priority?: boolean;
}

export const IMAGE_PRESETS: Record<ImagePreset, ImagePresetConfig> = {
  hero: {
    widths: [640, 1024, 1440],
    defaultWidth: 1024,
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 92vw, 55vw',
    quality: 84,
    priority: true,
  },
  card: {
    widths: [320, 480, 720, 960],
    defaultWidth: 480,
    sizes: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
    quality: 82,
  },
  detail: {
    widths: [640, 1000, 1440],
    defaultWidth: 1000,
    sizes: '(max-width: 1024px) 100vw, 55vw',
    quality: 85,
    priority: true,
  },
  gallery: {
    widths: [320, 480, 760, 1080],
    defaultWidth: 480,
    sizes: '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
    quality: 82,
  },
  lightbox: {
    widths: [960, 1440, 1800],
    defaultWidth: 1440,
    sizes: '95vw',
    quality: 88,
    priority: true,
  },
  thumbnail: {
    widths: [160, 320],
    defaultWidth: 200,
    sizes: '(max-width: 640px) 96px, 140px',
    quality: 80,
  },
};

/**
 * Checks whether an image path is a local Hoa Nelly asset that can be
 * resized and converted to WebP by the server's /api/img optimizer.
 * External URLs are safely passed through unmodified.
 */
export function isOptimizableLocalImage(src: string | null | undefined): boolean {
  if (!src) return false;
  const trimmed = src.trim();
  return (
    trimmed.startsWith('/assets/aistudio/') ||
    trimmed.startsWith('/api/uploads/')
  );
}

/**
 * Builds an optimized image URL for a given width, quality, and format.
 */
export function buildOptimizedImageUrl(
  src: string,
  options: {
    width?: number;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'avif';
  } = {}
): string {
  const trimmed = src.trim();
  if (!isOptimizableLocalImage(trimmed)) {
    return trimmed;
  }
  const params = new URLSearchParams();
  params.set('src', trimmed);
  if (options.width) params.set('w', String(options.width));
  if (options.quality) params.set('q', String(options.quality));
  params.set('fm', options.format || 'webp');
  params.set('v', '4');
  return `/api/img?${params.toString()}`;
}

export interface ResponsiveImageProps {
  src: string;
  srcSet?: string;
  sizes?: string;
  lqipSrc?: string;
  isOptimizable: boolean;
}

/**
 * Generates responsive image attributes (src, srcSet, sizes, and 24px blurred LQIP URL)
 * tailored to the chosen screen preset or custom breakpoint widths.
 */
export function buildResponsiveImageProps(
  src: string | null | undefined,
  options: {
    preset?: ImagePreset;
    widths?: readonly number[];
    sizes?: string;
    quality?: number;
    format?: 'webp' | 'jpeg' | 'png' | 'avif';
  } = {}
): ResponsiveImageProps {
  const trimmed = String(src || '').trim();
  if (!trimmed || !isOptimizableLocalImage(trimmed)) {
    return {
      src: trimmed,
      isOptimizable: false,
    };
  }

  const presetConfig = IMAGE_PRESETS[options.preset || 'card'];
  const widths = options.widths && options.widths.length > 0 ? options.widths : presetConfig.widths;
  const quality = options.quality ?? presetConfig.quality;
  const format = options.format ?? 'webp';
  const defaultWidth = widths.includes(presetConfig.defaultWidth)
    ? presetConfig.defaultWidth
    : widths[Math.min(1, widths.length - 1)] || widths[0];

  const srcSet = widths
    .map((w) => `${buildOptimizedImageUrl(trimmed, { width: w, quality, format })} ${w}w`)
    .join(', ');

  return {
    src: buildOptimizedImageUrl(trimmed, { width: defaultWidth, quality, format }),
    srcSet,
    sizes: options.sizes || presetConfig.sizes,
    lqipSrc: buildOptimizedImageUrl(trimmed, { width: 24, quality: 35, format: 'webp' }),
    isOptimizable: true,
  };
}
