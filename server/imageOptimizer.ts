import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const ALLOWED_WIDTHS = [
  24, 160, 200, 240, 320, 360, 480, 640, 720, 800, 960, 1024, 1200, 1280, 1440, 1600, 1920,
] as const;
export type AllowedWidth = (typeof ALLOWED_WIDTHS)[number];

export const ALLOWED_FORMATS = ['webp', 'jpeg', 'png', 'avif'] as const;
export type OutputFormat = (typeof ALLOWED_FORMATS)[number];

const FORMAT_CONTENT_TYPES: Record<OutputFormat, string> = {
  webp: 'image/webp',
  jpeg: 'image/jpeg',
  png: 'image/png',
  avif: 'image/avif',
};

const MAX_INPUT_PIXELS = 40_000_000; // 40MP cap to block decompression bombs
const MAX_UPLOAD_EDGE = 2048;
const MAX_CACHE_FILES = 600;

const cacheDir = path.resolve(process.cwd(), process.env.IMAGE_CACHE_DIR || './data/image-cache');
fs.mkdirSync(cacheDir, { recursive: true });

const inFlight = new Map<string, Promise<Buffer>>();
let writesSincePrune = 0;

export function snapToAllowedWidth(rawWidth: unknown): AllowedWidth {
  const num = Number(rawWidth);
  if (!Number.isFinite(num) || num <= 0) return 800;
  for (const w of ALLOWED_WIDTHS) {
    if (num <= w) return w;
  }
  return ALLOWED_WIDTHS[ALLOWED_WIDTHS.length - 1];
}

export function normalizeQuality(rawQuality: unknown, width: AllowedWidth): number {
  if (width === 24) return 35;
  const num = Number(rawQuality);
  if (!Number.isFinite(num)) return 90;
  return Math.min(96, Math.max(50, Math.round(num)));
}

export function normalizeFormat(rawFormat: unknown, acceptHeader = ''): OutputFormat {
  const fmt = String(rawFormat || '').trim().toLowerCase();
  if (fmt === 'jpg') return 'jpeg';
  if ((ALLOWED_FORMATS as readonly string[]).includes(fmt)) {
    return fmt as OutputFormat;
  }
  if (acceptHeader.includes('image/webp')) return 'webp';
  return 'jpeg';
}

/**
 * Resolves a local Hoa Nelly image URL to an absolute filesystem path
 * with strict directory confinement (no traversal, no external URLs).
 */
export function resolveLocalImageSource(
  rawSrc: string,
  uploadDir: string
): { filePath: string; canonicalSrc: string } | null {
  const src = String(rawSrc || '').trim();
  if (!src || src.length > 512 || src.includes('\0') || src.includes('\\')) {
    return null;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(src) || src.startsWith('//')) {
    return null;
  }

  // Strip query/hash fragments if any
  const cleanSrc = src.split('?')[0].split('#')[0];

  if (cleanSrc.startsWith('/api/uploads/')) {
    const filename = cleanSrc.slice('/api/uploads/'.length);
    if (!/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i.test(filename)) {
      return null;
    }
    const baseDir = path.resolve(uploadDir);
    const resolved = path.resolve(baseDir, filename);
    if (!resolved.startsWith(baseDir + path.sep)) return null;
    if (!fs.existsSync(resolved)) return null;
    return { filePath: resolved, canonicalSrc: `/api/uploads/${filename}` };
  }

  if (cleanSrc.startsWith('/assets/aistudio/')) {
    const relName = cleanSrc.slice('/assets/aistudio/'.length);
    // Strict flat filename check inside assets/aistudio
    if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(relName) || relName.includes('..')) {
      return null;
    }
    const candidateDirs = [
      path.resolve(process.cwd(), 'public', 'assets', 'aistudio'),
      path.resolve(process.cwd(), 'dist', 'assets', 'aistudio'),
    ];
    for (const dir of candidateDirs) {
      const resolved = path.resolve(dir, relName);
      if (resolved.startsWith(dir + path.sep) && fs.existsSync(resolved)) {
        return { filePath: resolved, canonicalSrc: `/assets/aistudio/${relName}` };
      }
    }
    return null;
  }

  return null;
}

function pruneCacheIfNeeded(): void {
  writesSincePrune += 1;
  if (writesSincePrune < 40) return;
  writesSincePrune = 0;

  try {
    const entries = fs
      .readdirSync(cacheDir)
      .map((name) => {
        const full = path.join(cacheDir, name);
        try {
          const stat = fs.statSync(full);
          return { full, atimeMs: stat.atimeMs || stat.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter((x): x is { full: string; atimeMs: number } => Boolean(x));

    if (entries.length <= MAX_CACHE_FILES) return;
    entries.sort((a, b) => a.atimeMs - b.atimeMs);
    const toRemove = entries.slice(0, entries.length - Math.floor(MAX_CACHE_FILES * 0.8));
    for (const entry of toRemove) {
      try {
        fs.unlinkSync(entry.full);
      } catch {
        // Ignore race conditions during eviction
      }
    }
  } catch {
    // Cache pruning is best-effort
  }
}

export interface OptimizedImageResult {
  buffer: Buffer;
  contentType: string;
  etag: string;
  cacheHit: boolean;
}

/**
 * Detects pure-white studio cutouts or white-pillarboxed screenshots and:
 * 1. Trims pure-white side bars when a regular photo has white letterbox margins.
 * 2. Removes pure-white studio backgrounds (perimeter flood-fill + enclosed flat-white
 *    gaps such as ribbon bow loops) with smooth anti-aliased edge feathering and white
 *    de-fringing, preserving all balloon specular highlights and leaving real photos untouched.
 */
async function cleanStudioWhiteBackground(
  pipeline: ReturnType<typeof sharp>
): Promise<{ sharpInstance: ReturnType<typeof sharp>; hasAlphaCutout: boolean }> {
  const { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  if (width < 16 || height < 16 || channels < 4) {
    return {
      sharpInstance: sharp(data, { raw: { width, height, channels } }),
      hasAlphaCutout: false,
    };
  }

  const isNearWhite = (idx: number, minRgb: number, maxSat: number): boolean => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    if (a < 20) return true;
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    return minC >= minRgb && maxC - minC <= maxSat;
  };

  // Sample 4 corners & perimeter to distinguish pure-white studio cutouts vs real photos
  const corners = [
    (2 * width + 2) * channels,
    (2 * width + (width - 3)) * channels,
    ((height - 3) * width + 2) * channels,
    ((height - 3) * width + (width - 3)) * channels,
  ];
  const allCornersWhite = corners.every((idx) => isNearWhite(idx, 240, 14));

  let perimeterTotal = 0;
  let perimeterWhite = 0;
  const stepX = Math.max(1, Math.floor(width / 48));
  const stepY = Math.max(1, Math.floor(height / 48));

  for (let x = 0; x < width; x += stepX) {
    perimeterTotal += 2;
    if (isNearWhite((1 * width + x) * channels, 242, 14)) perimeterWhite += 1;
    if (isNearWhite(((height - 2) * width + x) * channels, 242, 14)) perimeterWhite += 1;
  }
  for (let y = 0; y < height; y += stepY) {
    perimeterTotal += 2;
    if (isNearWhite((y * width + 1) * channels, 242, 14)) perimeterWhite += 1;
    if (isNearWhite((y * width + (width - 2)) * channels, 242, 14)) perimeterWhite += 1;
  }

  const perimeterWhiteRatio = perimeterTotal > 0 ? perimeterWhite / perimeterTotal : 0;

  // Case A: Photo with pure-white vertical letterbox side margins (top/bottom center is NOT white)
  if (allCornersWhite && perimeterWhiteRatio >= 0.35 && perimeterWhiteRatio < 0.8) {
    const colIsPureWhite = (x: number): boolean => {
      let whiteCount = 0;
      let total = 0;
      for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 64))) {
        total += 1;
        if (isNearWhite((y * width + x) * channels, 244, 12)) whiteCount += 1;
      }
      return total > 0 && whiteCount / total >= 0.96;
    };

    let left = 0;
    while (left < Math.floor(width * 0.25) && colIsPureWhite(left)) left += 1;
    let right = width - 1;
    while (right > Math.floor(width * 0.75) && colIsPureWhite(right)) right -= 1;

    if (left >= 4 || width - 1 - right >= 4) {
      const cropLeft = Math.min(left + 1, width - 8);
      const cropRight = Math.max(right - 1, cropLeft + 8);
      const cropWidth = cropRight - cropLeft + 1;
      return {
        sharpInstance: sharp(data, { raw: { width, height, channels } }).extract({
          left: cropLeft,
          top: 0,
          width: cropWidth,
          height,
        }),
        hasAlphaCutout: false,
      };
    }

    return {
      sharpInstance: sharp(data, { raw: { width, height, channels } }),
      hasAlphaCutout: false,
    };
  }

  // Case B: Not a pure-white studio cutout -> leave completely untouched
  if (!allCornersWhite || perimeterWhiteRatio < 0.8) {
    return {
      sharpInstance: sharp(data, { raw: { width, height, channels } }),
      hasAlphaCutout: false,
    };
  }

  // Pure-white studio cutout detected -> BFS flood-fill from perimeter
  const totalPixels = width * height;
  const bgMask = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const enqueueIfWhite = (p: number) => {
    if (bgMask[p]) return;
    if (isNearWhite(p * channels, 232, 20)) {
      bgMask[p] = 1;
      queue[tail++] = p;
    }
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfWhite(x);
    enqueueIfWhite((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfWhite(y * width);
    enqueueIfWhite(y * width + (width - 1));
  }

  while (head < tail) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;

    if (x > 0) enqueueIfWhite(p - 1);
    if (x < width - 1) enqueueIfWhite(p + 1);
    if (y > 0) enqueueIfWhite(p - width);
    if (y < height - 1) enqueueIfWhite(p + width);
  }

  // Also detect enclosed flat pure-white background holes (e.g., inside balloon ribbon bows)
  // Minimum area threshold protects tiny glossy balloon highlights while clearing large #FFFFFF gaps.
  const minHoleArea = Math.max(20, Math.floor(totalPixels * 0.00022));
  const visitedHole = new Uint8Array(totalPixels);
  const holeQueue = new Int32Array(totalPixels);

  for (let p = 0; p < totalPixels; p += 1) {
    if (bgMask[p] || visitedHole[p]) continue;
    if (!isNearWhite(p * channels, 246, 7)) continue;

    let hHead = 0;
    let hTail = 0;
    visitedHole[p] = 1;
    holeQueue[hTail++] = p;

    while (hHead < hTail) {
      const cur = holeQueue[hHead++];
      const cx = cur % width;
      const cy = (cur - cx) / width;
      const neighbors = [
        cx > 0 ? cur - 1 : -1,
        cx < width - 1 ? cur + 1 : -1,
        cy > 0 ? cur - width : -1,
        cy < height - 1 ? cur + width : -1,
      ];
      for (const nb of neighbors) {
        if (nb < 0 || bgMask[nb] || visitedHole[nb]) continue;
        if (isNearWhite(nb * channels, 240, 14)) {
          visitedHole[nb] = 1;
          holeQueue[hTail++] = nb;
        }
      }
    }

    if (hTail >= minHoleArea) {
      for (let i = 0; i < hTail; i += 1) {
        bgMask[holeQueue[i]] = 1;
      }
    }
  }

  // Build output RGBA with smooth anti-aliased edge feathering + white halo decontamination
  const out = Buffer.from(data);

  for (let p = 0; p < totalPixels; p += 1) {
    if (bgMask[p]) {
      out[p * channels + 3] = 0;
    }
  }

  // 2-ring smooth fringe pass around transparent background pixels
  const ring1 = new Uint8Array(totalPixels);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      if (bgMask[p]) continue;
      if (
        bgMask[p - 1] ||
        bgMask[p + 1] ||
        bgMask[p - width] ||
        bgMask[p + width] ||
        bgMask[p - width - 1] ||
        bgMask[p - width + 1] ||
        bgMask[p + width - 1] ||
        bgMask[p + width + 1]
      ) {
        ring1[p] = 1;
      }
    }
  }

  for (let p = 0; p < totalPixels; p += 1) {
    if (!ring1[p]) continue;
    const idx = p * channels;
    const r = out[idx];
    const g = out[idx + 1];
    const b = out[idx + 2];
    const minC = Math.min(r, g, b);
    const maxC = Math.max(r, g, b);
    const sat = maxC - minC;
    const whiteness = (255 - minC) + sat * 1.15;

    if (whiteness < 68) {
      const alphaFloat = Math.max(0, Math.min(1, (whiteness - 10) / 58));
      out[idx + 3] = Math.round(alphaFloat * 255);
      // Un-premultiply white halo for clean edges against warm ivory cards
      if (alphaFloat > 0.08 && alphaFloat < 0.98) {
        out[idx] = Math.max(0, Math.min(255, Math.round((r - 255 * (1 - alphaFloat)) / alphaFloat)));
        out[idx + 1] = Math.max(
          0,
          Math.min(255, Math.round((g - 255 * (1 - alphaFloat)) / alphaFloat))
        );
        out[idx + 2] = Math.max(
          0,
          Math.min(255, Math.round((b - 255 * (1 - alphaFloat)) / alphaFloat))
        );
      }
    }
  }

  return {
    sharpInstance: sharp(out, { raw: { width, height, channels: 4 } }),
    hasAlphaCutout: true,
  };
}

/**
 * Resizes and encodes a validated local image with persistent disk caching
 * and concurrent-request deduplication.
 */
export async function getOptimizedImage(options: {
  filePath: string;
  canonicalSrc: string;
  width: AllowedWidth;
  quality: number;
  format: OutputFormat;
}): Promise<OptimizedImageResult> {
  const { filePath, canonicalSrc, width, quality, format } = options;
  const stat = fs.statSync(filePath);
  const keyMaterial = `v3-bgclean|${canonicalSrc}|${stat.mtimeMs}|${stat.size}|w=${width}|q=${quality}|fm=${format}`;
  const hash = crypto.createHash('sha256').update(keyMaterial).digest('hex').slice(0, 32);
  const cacheFile = path.resolve(cacheDir, `${hash}.${format}`);

  if (!cacheFile.startsWith(cacheDir + path.sep)) {
    throw new Error('Invalid cache path');
  }

  const etag = `"img-${hash}"`;
  const contentType = FORMAT_CONTENT_TYPES[format];

  if (fs.existsSync(cacheFile)) {
    const cached = await fs.promises.readFile(cacheFile);
    return { buffer: cached, contentType, etag, cacheHit: true };
  }

  let pending = inFlight.get(hash);
  if (!pending) {
    pending = (async () => {
      const resized = sharp(filePath, {
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: 'error',
      })
        .rotate() // Auto-orient based on EXIF and strip EXIF metadata by default
        .resize({
          width,
          withoutEnlargement: true,
          fit: 'inside',
          kernel: sharp.kernel.lanczos3,
        });

      const { sharpInstance, hasAlphaCutout } = await cleanStudioWhiteBackground(resized);
      let pipeline = sharpInstance;

      if (width === 24) {
        pipeline = pipeline.blur(1.2);
      } else {
        // Gentle output sharpening keeps balloon highlights & floral edges crisp across DPR displays
        pipeline = pipeline.sharpen({ sigma: 0.5, m1: 0.5, m2: 1.4 });
      }

      if (format === 'webp') {
        pipeline = pipeline.webp({ quality, alphaQuality: 95, effort: 5, smartSubsample: true });
      } else if (format === 'avif') {
        pipeline = pipeline.avif({ quality: Math.max(50, quality - 8), effort: 3 });
      } else if (format === 'png') {
        pipeline = pipeline.png({ compressionLevel: 8 });
      } else {
        if (hasAlphaCutout) {
          pipeline = pipeline.flatten({ background: { r: 248, g: 245, b: 238 } });
        }
        pipeline = pipeline.jpeg({
          quality,
          mozjpeg: true,
          progressive: true,
          chromaSubsampling: '4:4:4',
        });
      }

      const output = await pipeline.toBuffer();

      // Atomic write via temp file to avoid partial reads
      const tmpFile = `${cacheFile}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      try {
        await fs.promises.writeFile(tmpFile, output);
        await fs.promises.rename(tmpFile, cacheFile);
        pruneCacheIfNeeded();
      } catch {
        try {
          if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        } catch {
          // ignore cleanup failure
        }
      }

      return output;
    })();

    inFlight.set(hash, pending);
    pending.finally(() => inFlight.delete(hash));
  }

  const buffer = await pending;
  return { buffer, contentType, etag, cacheHit: false };
}

export interface OptimizedUploadResult {
  buffer: Buffer;
  ext: '.webp' | '.jpg' | '.png';
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

/**
 * Optimizes newly uploaded images (admin products, gallery, custom references):
 * - Auto-orients using EXIF and strips private camera/GPS metadata
 * - Caps maximum dimensions to 2048px while preserving aspect ratio
 * - Encodes cleanly to WebP (high visual fidelity, much smaller footprint)
 */
export async function optimizeUploadedImage(
  inputBuffer: Buffer
): Promise<OptimizedUploadResult> {
  const originalBytes = inputBuffer.length;

  const processed = await sharp(inputBuffer, {
    limitInputPixels: MAX_INPUT_PIXELS,
    failOn: 'error',
  })
    .rotate()
    .resize({
      width: MAX_UPLOAD_EDGE,
      height: MAX_UPLOAD_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 92, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: processed.data,
    ext: '.webp',
    originalBytes,
    optimizedBytes: processed.data.length,
    width: processed.info.width,
    height: processed.info.height,
  };
}
