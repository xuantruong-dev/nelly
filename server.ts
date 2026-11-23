import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import type { AdminRole, Product, StoreSettings } from './shared/types.ts';
import {
  db,
  getCategories,
  getStoreSettings,
  hydrateGallery,
  hydrateOrder,
  hydrateOrdersBatch,
  hydrateProduct,
  hydrateProductsBatch,
  hydrateQuestion,
  hydrateReview,
  hydrateReviewsBatch,
  initDatabase,
  saveStoreSettings,
} from './server/db.ts';
import {
  ROLE_DEFAULT_PERMISSIONS,
  constantTimeStringCompare,
  createAdminSession,
  ensureEnvOwnerExists,
  getAdminAuthStatus,
  hashPassword,
  mapAdminRow,
  rateLimit,
  requireAdmin,
  verifyPassword,
} from './server/auth.ts';
import type { AuthedAdminRequest } from './server/auth.ts';
import { OCCASIONS } from './server/seedData.ts';
import {
  getOptimizedImage,
  normalizeFormat,
  normalizeQuality,
  optimizeUploadedImage,
  resolveLocalImageSource,
  snapToAllowedWidth,
} from './server/imageOptimizer.ts';

initDatabase();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './data/uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 4,
  },
});

function detectImageType(buffer: Buffer): { ext: string; mime: string } | null {
  if (buffer.length < 12) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { ext: '.png', mime: 'image/png' };
  }
  // WEBP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }
  return null;
}

function normalizePhone(raw: string): string {
  return String(raw || '').replace(/[^\d+]/g, '').trim();
}

function isValidVietnamesePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
}

function normalizeSearchText(raw: string): string {
  return String(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

function generateCode(prefix: string): string {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate()
  ).padStart(2, '0')}`;
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${ymd}-${rand}`;
}

function checkHoneypot(body: Record<string, unknown>): boolean {
  const trap = String(body.website_url || body._hp || '').trim();
  return trap.length === 0;
}

function sanitizeImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  return urls
    .map((u) => String(u || '').trim())
    .filter((u) => u.startsWith('/api/uploads/') || u.startsWith('/assets/aistudio/'))
    .slice(0, 4);
}

// ============================================================================
// SAFE UPLOADS & ON-DEMAND RESPONSIVE IMAGE OPTIMIZATION
// ============================================================================

app.post(
  '/api/uploads',
  rateLimit('uploads', 25, 10 * 60 * 1000),
  (req: Request, res: Response) => {
    upload.array('files', 4)(req, res, async (err: unknown) => {
      if (err) {
        const message =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'Mỗi ảnh không được vượt quá 5MB.'
            : err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT'
              ? 'Chỉ được tải lên tối đa 4 ảnh mỗi lần.'
              : 'Không thể tải ảnh lên. Vui lòng kiểm tra định dạng JPG, PNG hoặc WebP.';
        res.status(400).json({ error: message });
        return;
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 tệp ảnh.' });
        return;
      }

      const savedUrls: string[] = [];
      const stats: {
        url: string;
        originalBytes: number;
        optimizedBytes: number;
        width: number;
        height: number;
      }[] = [];

      for (const f of files) {
        const detected = detectImageType(f.buffer);
        if (!detected) {
          res.status(400).json({
            error: `Tệp "${f.originalname}" không đúng định dạng ảnh hợp lệ (chỉ hỗ trợ JPG, PNG, WebP).`,
          });
          return;
        }
        try {
          const optimized = await optimizeUploadedImage(f.buffer);
          const safeName = `${crypto.randomUUID()}${optimized.ext}`;
          const target = path.resolve(uploadDir, safeName);
          if (!target.startsWith(uploadDir + path.sep)) {
            res.status(400).json({ error: 'Đường dẫn tệp không hợp lệ.' });
            return;
          }
          await fs.promises.writeFile(target, optimized.buffer);
          const url = `/api/uploads/${safeName}`;
          savedUrls.push(url);
          stats.push({
            url,
            originalBytes: optimized.originalBytes,
            optimizedBytes: optimized.optimizedBytes,
            width: optimized.width,
            height: optimized.height,
          });
        } catch {
          res.status(400).json({
            error: `Tệp "${f.originalname}" bị lỗi dữ liệu ảnh hoặc vượt giới hạn độ phân giải cho phép.`,
          });
          return;
        }
      }

      res.json({ urls: savedUrls, stats });
    });
  }
);

app.get('/api/uploads/:filename', (req: Request, res: Response) => {
  const filename = String(req.params.filename || '');
  if (!/^[0-9a-f-]{36}\.(jpg|jpeg|png|webp|mp4|webm)$/i.test(filename)) {
    res.status(404).json({ error: 'Không tìm thấy tệp.' });
    return;
  }
  const target = path.resolve(uploadDir, filename);
  if (!target.startsWith(uploadDir + path.sep) || !fs.existsSync(target)) {
    res.status(404).json({ error: 'Không tìm thấy tệp.' });
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(target);
});

app.get('/api/img', async (req: Request, res: Response) => {
  const rawSrc = String(req.query.src || '');
  const source = resolveLocalImageSource(rawSrc, uploadDir);
  if (!source) {
    res.status(400).json({ error: 'Nguồn ảnh không hợp lệ hoặc không tồn tại.' });
    return;
  }

  const width = snapToAllowedWidth(req.query.w);
  const quality = normalizeQuality(req.query.q, width);
  const format = normalizeFormat(req.query.fm, String(req.headers.accept || ''));

  try {
    const result = await getOptimizedImage({
      filePath: source.filePath,
      canonicalSrc: source.canonicalSrc,
      width,
      quality,
      format,
    });

    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Vary', 'Accept');
    res.setHeader('ETag', result.etag);
    res.setHeader('X-Image-Cache', result.cacheHit ? 'HIT' : 'MISS');

    if (req.headers['if-none-match'] === result.etag) {
      res.status(304).end();
      return;
    }

    res.send(result.buffer);
  } catch {
    res.status(500).json({ error: 'Không thể tối ưu hóa hình ảnh lúc này.' });
  }
});

// ============================================================================
// PUBLIC STOREFRONT APIS
// ============================================================================

app.get('/api/bootstrap', (_req: Request, res: Response) => {
  const settings = getStoreSettings();
  const categories = getCategories();
  const featuredRows = db
    .prepare('SELECT * FROM products WHERE is_active = 1 AND is_featured = 1 ORDER BY id ASC LIMIT 8')
    .all() as Record<string, unknown>[];
  const featured_products = hydrateProductsBatch(featuredRows);

  const reviewRows = db
    .prepare(
      `SELECT r.*, p.name as product_name, p.slug as product_slug
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       WHERE r.status = 'published'
       ORDER BY r.created_at DESC
       LIMIT 6`
    )
    .all() as Record<string, unknown>[];
  const recent_reviews = hydrateReviewsBatch(reviewRows);

  const galleryRows = db
    .prepare('SELECT * FROM gallery_items WHERE is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 6')
    .all() as Record<string, unknown>[];

  res.json({
    settings,
    categories,
    occasions: OCCASIONS,
    featured_products,
    recent_reviews,
    gallery_preview: galleryRows.map(hydrateGallery),
  });
});

app.get('/api/products', (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();
  const occasion = String(req.query.occasion || '').trim();
  const color = String(req.query.color || '').trim();
  const availability = String(req.query.availability || '').trim();
  const pricingType = String(req.query.pricingType || '').trim();
  const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
  const sort = String(req.query.sort || 'newest');
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(48, Math.max(1, Number(req.query.limit || 12)));

  const rows = db
    .prepare('SELECT * FROM products WHERE is_active = 1 ORDER BY id DESC')
    .all() as Record<string, unknown>[];

  const allActive = hydrateProductsBatch(rows);
  let items = allActive;

  if (q) {
    const qNorm = normalizeSearchText(q);
    const matchesQuery = (text: string) => {
      const lower = text.toLowerCase();
      return lower.includes(q) || (qNorm.length > 0 && normalizeSearchText(lower).includes(qNorm));
    };
    items = items.filter(
      (p) =>
        matchesQuery(p.name) ||
        matchesQuery(p.sku) ||
        matchesQuery(p.short_description) ||
        p.colors.some((c) => matchesQuery(c)) ||
        matchesQuery(p.category_name || '')
    );
  }
  if (category) {
    items = items.filter((p) => p.category_slug === category);
  }
  if (occasion) {
    items = items.filter((p) => p.occasions.includes(occasion));
  }
  if (color) {
    items = items.filter((p) => p.colors.includes(color));
  }
  if (availability) {
    items = items.filter((p) => p.availability_status === availability);
  }
  if (pricingType) {
    items = items.filter((p) => p.pricing_type === pricingType);
  }
  if (minPrice !== null && !Number.isNaN(minPrice)) {
    items = items.filter((p) => p.base_price !== null && p.base_price >= minPrice);
  }
  if (maxPrice !== null && !Number.isNaN(maxPrice)) {
    items = items.filter((p) => p.base_price !== null && p.base_price <= maxPrice);
  }

  items = [...items];
  switch (sort) {
    case 'price_asc':
      items.sort((a, b) => (a.base_price ?? Number.MAX_SAFE_INTEGER) - (b.base_price ?? Number.MAX_SAFE_INTEGER));
      break;
    case 'price_desc':
      items.sort((a, b) => (b.base_price ?? -1) - (a.base_price ?? -1));
      break;
    case 'rating':
      items.sort((a, b) => b.rating_avg - a.rating_avg || b.review_count - a.review_count);
      break;
    case 'newest':
    default:
      items.sort((a, b) => b.id - a.id);
      break;
  }

  // Available facets across all active products
  const allColors = Array.from(new Set(allActive.flatMap((p) => p.colors))).sort();

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const paged = items.slice(offset, offset + limit);

  res.json({
    items: paged,
    total,
    page,
    limit,
    totalPages,
    facets: {
      colors: allColors,
    },
  });
});

app.get('/api/products/:slug', (req: Request, res: Response) => {
  const slug = String(req.params.slug || '');
  const row = db
    .prepare('SELECT * FROM products WHERE slug = ? AND is_active = 1')
    .get(slug) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
    return;
  }

  const product = hydrateProduct(row);

  const reviewRows = db
    .prepare(
      `SELECT * FROM reviews WHERE product_id = ? AND status = 'published' ORDER BY created_at DESC`
    )
    .all(product.id) as Record<string, unknown>[];
  const reviews = hydrateReviewsBatch(reviewRows);

  const distribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1;
  }

  const questionRows = db
    .prepare(
      `SELECT * FROM product_questions WHERE product_id = ? AND status = 'published' ORDER BY created_at DESC`
    )
    .all(product.id) as Record<string, unknown>[];
  const questions = questionRows.map(hydrateQuestion);

  const relatedRows = db
    .prepare(
      `SELECT * FROM products
       WHERE is_active = 1 AND id != ?
       ORDER BY (CASE WHEN category_slug = ? THEN 0 ELSE 1 END), is_featured DESC, id ASC
       LIMIT 4`
    )
    .all(product.id, product.category_slug) as Record<string, unknown>[];

  const accessoryRows = db
    .prepare(
      `SELECT * FROM products
       WHERE is_active = 1 AND id != ? AND category_slug IN ('phu-kien-sinh-nhat', 'qua-tang')
       ORDER BY id ASC LIMIT 3`
    )
    .all(product.id) as Record<string, unknown>[];

  res.json({
    product,
    reviews,
    review_distribution: distribution,
    questions,
    related_products: hydrateProductsBatch(relatedRows),
    suggested_accessories: hydrateProductsBatch(accessoryRows),
  });
});

app.get('/api/gallery', (req: Request, res: Response) => {
  const category = String(req.query.category || '').trim();
  const imageType = String(req.query.imageType || '').trim();

  let rows = db
    .prepare('SELECT * FROM gallery_items WHERE is_active = 1 ORDER BY sort_order ASC, id DESC')
    .all() as Record<string, unknown>[];
  let items = rows.map(hydrateGallery);

  if (category) items = items.filter((i) => i.category === category);
  if (imageType) items = items.filter((i) => i.image_type === imageType);

  res.json({ items });
});

app.get('/api/schedule-check', (req: Request, res: Response) => {
  const dateStr = String(req.query.date || '').trim();
  const prepHours = Math.max(0, Number(req.query.prepHours || 12));
  const settings = getStoreSettings();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    res.json({ canConfirmDirectly: false, reason: 'Vui lòng chọn ngày nhận hợp lệ.' });
    return;
  }

  const targetDate = new Date(`${dateStr}T12:00:00`);
  const minReadyDate = new Date(Date.now() + prepHours * 60 * 60 * 1000);

  const countForDay = (
    db
      .prepare(
        `SELECT COUNT(*) as c FROM orders WHERE desired_date = ? AND status != 'cancelled'`
      )
      .get(dateStr) as { c: number }
  ).c;

  if (targetDate.getTime() < minReadyDate.getTime()) {
    res.json({
      canConfirmDirectly: false,
      dailyOrders: countForDay,
      dailyCapacity: settings.daily_order_capacity,
      reason: `Thời gian nhận gần hơn mốc chuẩn bị gợi ý (${prepHours} giờ). Lịch giao sẽ ở trạng thái "Chờ cửa hàng xác nhận".`,
    });
    return;
  }

  if (countForDay >= settings.daily_order_capacity) {
    res.json({
      canConfirmDirectly: false,
      dailyOrders: countForDay,
      dailyCapacity: settings.daily_order_capacity,
      reason: 'Ngày này đã gần kín lịch nhận đơn tiêu chuẩn. Lịch giao sẽ ở trạng thái "Chờ cửa hàng xác nhận".',
    });
    return;
  }

  res.json({
    canConfirmDirectly: true,
    dailyOrders: countForDay,
    dailyCapacity: settings.daily_order_capacity,
    reason: 'Khung ngày phù hợp thời gian chuẩn bị gợi ý; Hoa Nelly sẽ xác nhận lại khung giờ giao chính xác.',
  });
});

app.post('/api/promo/validate', rateLimit('promo', 20, 5 * 60 * 1000), (req: Request, res: Response) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const subtotal = Math.max(0, Number(req.body.subtotal || 0));
  if (!code) {
    res.status(400).json({ error: 'Vui lòng nhập mã ưu đãi.' });
    return;
  }
  const promo = db
    .prepare('SELECT * FROM promo_codes WHERE UPPER(code) = ? AND is_active = 1')
    .get(code) as Record<string, unknown> | undefined;

  if (!promo) {
    res.status(404).json({ error: 'Mã ưu đãi không tồn tại hoặc đã ngừng áp dụng.' });
    return;
  }
  if (promo.expires_at && new Date(String(promo.expires_at)).getTime() < Date.now()) {
    res.status(400).json({ error: 'Mã ưu đãi này đã hết hạn.' });
    return;
  }
  const minOrder = Number(promo.min_order_amount || 0);
  if (subtotal < minOrder) {
    res.status(400).json({
      error: `Mã ưu đãi áp dụng cho đơn từ ${minOrder.toLocaleString('vi-VN')}₫.`,
    });
    return;
  }
  const discountAmount =
    promo.discount_type === 'percent'
      ? Math.min(subtotal, Math.round((subtotal * Number(promo.discount_value)) / 100))
      : Math.min(subtotal, Number(promo.discount_value));

  res.json({
    code: String(promo.code),
    discount_amount: discountAmount,
    message: `Áp dụng mã ${promo.code} giảm ${discountAmount.toLocaleString('vi-VN')}₫.`,
  });
});

// ============================================================================
// SERVER-VERIFIED CHECKOUT & PROTECTED ORDER LOOKUP
// ============================================================================

app.post('/api/orders', rateLimit('orders', 12, 10 * 60 * 1000), (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  if (!checkHoneypot(body)) {
    res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
    return;
  }

  const idempotencyKey = String(body.idempotency_key || '').trim();
  if (idempotencyKey) {
    const existing = db
      .prepare('SELECT * FROM orders WHERE idempotency_key = ?')
      .get(idempotencyKey) as Record<string, unknown> | undefined;
    if (existing) {
      res.json({
        order: hydrateOrder(existing, false),
        lookup_token: String(existing.lookup_token),
        deduplicated: true,
      });
      return;
    }
  }

  const customerName = String(body.customer_name || '').trim();
  const customerPhone = normalizePhone(String(body.customer_phone || ''));
  const customerEmail = String(body.customer_email || '').trim();
  const deliveryMethod = body.delivery_method === 'pickup' ? 'pickup' : 'delivery';
  const deliveryAddress = String(body.delivery_address || '').trim();
  const recipientName = String(body.recipient_name || '').trim();
  const recipientPhone = normalizePhone(String(body.recipient_phone || ''));
  const desiredDate = String(body.desired_date || '').trim();
  const desiredTimeSlot = String(body.desired_time_slot || '').trim();
  const hidePrice = Boolean(body.hide_price_for_recipient);
  const customerNote = String(body.customer_note || '').trim();
  const paymentMethod = String(body.payment_method || '').trim();
  const discountCode = String(body.discount_code || '').trim().toUpperCase();
  const rawItems = Array.isArray(body.items) ? body.items : [];

  if (customerName.length < 2) {
    res.status(400).json({ error: 'Vui lòng nhập họ tên người đặt (ít nhất 2 ký tự).' });
    return;
  }
  if (!isValidVietnamesePhone(customerPhone)) {
    res.status(400).json({ error: 'Vui lòng nhập số điện thoại hợp lệ (9–12 chữ số).' });
    return;
  }
  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    res.status(400).json({ error: 'Địa chỉ email không đúng định dạng.' });
    return;
  }
  if (deliveryMethod === 'delivery' && deliveryAddress.length < 6) {
    res.status(400).json({ error: 'Vui lòng nhập địa chỉ nhận hàng chi tiết.' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desiredDate) || !desiredTimeSlot) {
    res.status(400).json({ error: 'Vui lòng chọn ngày và khung giờ nhận mong muốn.' });
    return;
  }
  if (rawItems.length === 0) {
    res.status(400).json({ error: 'Giỏ hàng đang trống. Vui lòng chọn sản phẩm trước khi đặt.' });
    return;
  }

  const settings = getStoreSettings();
  const enabledPayment = settings.payment_methods.find((m) => m.id === paymentMethod && m.enabled);
  if (!enabledPayment) {
    res.status(400).json({ error: 'Phương thức thanh toán đã chọn chưa được cấu hình.' });
    return;
  }

  // Server-side recalculation for every item
  let subtotal = 0;
  let surchargeTotal = 0;
  let maxPrepHours = settings.default_prep_hours;
  let hasCustomQuoteItems = false;

  const verifiedItems: {
    product: Product;
    quantity: number;
    unitPrice: number;
    itemSurcharge: number;
    lineTotal: number;
    selectedVariants: Record<string, { id: string; label: string; price_delta: number }>;
    selectedAddons: { id: string; label: string; price: number }[];
    personalization: Record<string, unknown>;
  }[] = [];

  for (const rawItem of rawItems as Record<string, unknown>[]) {
    const productId = Number(rawItem.product_id);
    const quantity = Math.min(50, Math.max(1, Math.floor(Number(rawItem.quantity || 1))));
    const prodRow = db
      .prepare('SELECT * FROM products WHERE id = ? AND is_active = 1')
      .get(productId) as Record<string, unknown> | undefined;

    if (!prodRow) {
      res.status(400).json({ error: 'Một sản phẩm trong giỏ hàng không còn khả dụng.' });
      return;
    }
    const product = hydrateProduct(prodRow);
    if (product.availability_status === 'paused') {
      res.status(400).json({ error: `Sản phẩm "${product.name}" hiện đang tạm ngừng nhận đặt.` });
      return;
    }
    if (product.pricing_type === 'quote' || product.base_price === null) {
      res.status(400).json({
        error: `Sản phẩm "${product.name}" cần liên hệ báo giá trước khi đặt mua trực tiếp.`,
      });
      return;
    }

    maxPrepHours = Math.max(maxPrepHours, product.prep_hours);

    const requestedVariantIds: string[] = [];
    if (rawItem.selected_variants && typeof rawItem.selected_variants === 'object') {
      for (const val of Object.values(rawItem.selected_variants as Record<string, { id?: string }>)) {
        if (val?.id) requestedVariantIds.push(String(val.id));
      }
    }

    const verifiedVariants: Record<string, { id: string; label: string; price_delta: number }> = {};
    let variantDelta = 0;
    for (const vid of requestedVariantIds) {
      const found = product.variants.find((v) => v.id === vid);
      if (found) {
        if (!found.in_stock) {
          res.status(400).json({ error: `Tùy chọn "${found.label}" của "${product.name}" tạm hết.` });
          return;
        }
        verifiedVariants[found.group] = {
          id: found.id,
          label: found.label,
          price_delta: found.price_delta,
        };
        variantDelta += found.price_delta;
      }
    }

    const requestedAddonIds = Array.isArray(rawItem.selected_addons)
      ? (rawItem.selected_addons as { id?: string }[]).map((a) => String(a?.id || ''))
      : [];
    const verifiedAddons: { id: string; label: string; price: number }[] = [];
    let addonSum = 0;
    for (const aid of requestedAddonIds) {
      const found = product.addons.find((a) => a.id === aid);
      if (found) {
        verifiedAddons.push({ id: found.id, label: found.label, price: found.price });
        addonSum += found.price;
      }
    }

    const rawPers = (rawItem.personalization || {}) as Record<string, unknown>;
    const customText = String(rawPers.custom_text || '').trim().slice(0, 120);
    const cardMessage = String(rawPers.card_message || '').trim().slice(0, 300);
    const themeInput = String(rawPers.theme_input || '').trim().slice(0, 160);
    const note = String(rawPers.note || '').trim().slice(0, 400);
    const refUrl = sanitizeImageUrls(
      rawPers.reference_image_url ? [rawPers.reference_image_url] : []
    )[0];
    const requiresCustomQuote = Boolean(rawPers.requires_custom_quote);
    if (requiresCustomQuote) hasCustomQuoteItems = true;

    const customTextSurcharge =
      customText && product.personalization.allow_custom_text
        ? Number(product.personalization.custom_text_surcharge || 0)
        : 0;

    const unitBase = product.base_price;
    const perUnitSurcharge = variantDelta + addonSum + customTextSurcharge;
    const lineSubtotal = unitBase * quantity;
    const lineSurcharge = perUnitSurcharge * quantity;
    const lineTotal = lineSubtotal + lineSurcharge;

    subtotal += lineSubtotal;
    surchargeTotal += lineSurcharge;

    verifiedItems.push({
      product,
      quantity,
      unitPrice: unitBase,
      itemSurcharge: lineSurcharge,
      lineTotal,
      selectedVariants: verifiedVariants,
      selectedAddons: verifiedAddons,
      personalization: {
        card_message: cardMessage || undefined,
        custom_text: customText || undefined,
        theme_input: themeInput || undefined,
        note: note || undefined,
        reference_image_url: refUrl || undefined,
        requires_custom_quote: requiresCustomQuote,
      },
    });
  }

  const merchandiseTotal = subtotal + surchargeTotal;

  // Promo calculation on server
  let discountAmount = 0;
  let appliedPromoCode: string | null = null;
  if (discountCode) {
    const promo = db
      .prepare('SELECT * FROM promo_codes WHERE UPPER(code) = ? AND is_active = 1')
      .get(discountCode) as Record<string, unknown> | undefined;
    if (
      promo &&
      (!promo.expires_at || new Date(String(promo.expires_at)).getTime() >= Date.now()) &&
      merchandiseTotal >= Number(promo.min_order_amount || 0)
    ) {
      appliedPromoCode = String(promo.code);
      discountAmount =
        promo.discount_type === 'percent'
          ? Math.min(merchandiseTotal, Math.round((merchandiseTotal * Number(promo.discount_value)) / 100))
          : Math.min(merchandiseTotal, Number(promo.discount_value));
    }
  }

  // Shipping fee
  let shippingFee: number | null = null;
  let shippingFeeStatus: 'confirmed' | 'pending_confirmation' = 'pending_confirmation';
  if (deliveryMethod === 'pickup') {
    shippingFee = 0;
    shippingFeeStatus = 'confirmed';
  } else if (settings.shipping_fee_mode === 'flat_rate' && settings.flat_shipping_fee !== null) {
    if (
      settings.free_shipping_threshold !== null &&
      merchandiseTotal >= settings.free_shipping_threshold
    ) {
      shippingFee = 0;
    } else {
      shippingFee = settings.flat_shipping_fee;
    }
    shippingFeeStatus = 'confirmed';
  }

  // Schedule check
  const targetDate = new Date(`${desiredDate}T12:00:00`);
  const minReadyDate = new Date(Date.now() + maxPrepHours * 60 * 60 * 1000);
  const dayCount = (
    db
      .prepare(`SELECT COUNT(*) as c FROM orders WHERE desired_date = ? AND status != 'cancelled'`)
      .get(desiredDate) as { c: number }
  ).c;
  const scheduleConfirmed =
    targetDate.getTime() >= minReadyDate.getTime() && dayCount < settings.daily_order_capacity;

  const totalAmount = Math.max(0, merchandiseTotal - discountAmount + (shippingFee ?? 0));
  const depositRequired =
    settings.deposit_policy_enabled && settings.deposit_percent > 0
      ? Math.round((totalAmount * settings.deposit_percent) / 100)
      : null;

  const orderCode = generateCode('HN');
  const lookupToken = crypto.randomBytes(20).toString('hex');

  const insertTransaction = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO orders (
          idempotency_key, order_code, lookup_token, status, payment_status, payment_method,
          customer_name, customer_phone, customer_email, delivery_method, delivery_address,
          recipient_name, recipient_phone, desired_date, desired_time_slot, schedule_confirmed,
          hide_price_for_recipient, customer_note, subtotal, surcharge_total,
          shipping_fee, shipping_fee_status, discount_code, discount_amount,
          total_amount, deposit_required, has_custom_quote_items
        ) VALUES (?, ?, ?, 'pending_confirmation', 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        idempotencyKey || null,
        orderCode,
        lookupToken,
        enabledPayment.label,
        customerName,
        customerPhone,
        customerEmail || null,
        deliveryMethod,
        deliveryMethod === 'delivery' ? deliveryAddress : null,
        recipientName || null,
        recipientPhone || null,
        desiredDate,
        desiredTimeSlot,
        scheduleConfirmed ? 1 : 0,
        hidePrice ? 1 : 0,
        customerNote || null,
        subtotal,
        surchargeTotal,
        shippingFee,
        shippingFeeStatus,
        appliedPromoCode,
        discountAmount,
        totalAmount,
        depositRequired,
        hasCustomQuoteItems ? 1 : 0
      );

    const orderId = Number(info.lastInsertRowid);
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_slug, product_name, product_sku, product_image,
        quantity, unit_price, surcharge_total, line_total,
        selected_variants_json, selected_addons_json, personalization_json, review_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of verifiedItems) {
      const reviewToken = crypto.randomBytes(24).toString('hex');
      insertItem.run(
        orderId,
        item.product.id,
        item.product.slug,
        item.product.name,
        item.product.sku,
        item.product.images[0] || '',
        item.quantity,
        item.unitPrice,
        item.itemSurcharge,
        item.lineTotal,
        JSON.stringify(item.selectedVariants),
        JSON.stringify(item.selectedAddons),
        JSON.stringify(item.personalization),
        reviewToken
      );
    }

    return orderId;
  });

  const orderId = insertTransaction();
  const createdRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as Record<
    string,
    unknown
  >;

  res.status(201).json({
    order: hydrateOrder(createdRow, false),
    lookup_token: lookupToken,
  });
});

app.post(
  '/api/orders/lookup',
  rateLimit('order_lookup', 20, 10 * 60 * 1000),
  (req: Request, res: Response) => {
    const orderCode = String(req.body.order_code || '').trim().toUpperCase();
    const phone = normalizePhone(String(req.body.phone || ''));
    const lookupToken = String(req.body.lookup_token || '').trim();

    if (!orderCode) {
      res.status(400).json({ error: 'Vui lòng nhập mã đơn hàng.' });
      return;
    }

    const row = db
      .prepare('SELECT * FROM orders WHERE UPPER(order_code) = ?')
      .get(orderCode) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: 'Không tìm thấy đơn hàng hoặc thông tin xác thực chưa khớp.' });
      return;
    }

    const tokenMatched =
      lookupToken.length > 0 && constantTimeStringCompare(lookupToken, String(row.lookup_token));
    const phoneMatched =
      phone.length >= 9 &&
      (normalizePhone(String(row.customer_phone)) === phone ||
        (row.recipient_phone && normalizePhone(String(row.recipient_phone)) === phone));

    if (!tokenMatched && !phoneMatched) {
      res.status(403).json({
        error:
          'Không thể xác thực quyền xem đơn hàng. Vui lòng nhập đúng mã đơn kèm số điện thoại đặt hàng.',
      });
      return;
    }

    // Only expose verified review tokens once order is completed
    const isCompleted = row.status === 'completed';
    res.json({
      order: hydrateOrder(row, isCompleted),
    });
  }
);

// ============================================================================
// VERIFIED REVIEWS & PRODUCT Q&A
// ============================================================================

app.get('/api/reviews/verify', (req: Request, res: Response) => {
  const token = String(req.query.token || '').trim();
  if (!token || token.length < 16) {
    res.status(400).json({ error: 'Mã xác thực đánh giá không hợp lệ.' });
    return;
  }

  const itemRow = db
    .prepare(
      `SELECT oi.*, o.order_code, o.status as order_status, o.customer_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.review_token = ?`
    )
    .get(token) as Record<string, unknown> | undefined;

  if (!itemRow) {
    res.status(404).json({ error: 'Liên kết đánh giá không tồn tại hoặc đã hết hiệu lực.' });
    return;
  }

  if (itemRow.order_status !== 'completed') {
    res.status(403).json({
      error: 'Bạn chỉ có thể gửi đánh giá sau khi đơn hàng đã chuyển sang trạng thái Hoàn tất.',
    });
    return;
  }

  const existingReviewRow = db
    .prepare('SELECT * FROM reviews WHERE order_item_id = ?')
    .get(itemRow.id) as Record<string, unknown> | undefined;

  let canEdit = true;
  if (existingReviewRow) {
    const createdMs = new Date(String(existingReviewRow.created_at) + 'Z').getTime();
    canEdit = Date.now() - createdMs <= 7 * 24 * 60 * 60 * 1000;
  }

  let variantsSummary = '';
  try {
    const vObj = JSON.parse(String(itemRow.selected_variants_json || '{}')) as Record<
      string,
      { label: string }
    >;
    variantsSummary = Object.values(vObj)
      .map((v) => v.label)
      .join(' · ');
  } catch {
    variantsSummary = '';
  }

  res.json({
    valid: true,
    order_code: String(itemRow.order_code),
    product_id: Number(itemRow.product_id),
    product_name: String(itemRow.product_name),
    product_slug: String(itemRow.product_slug),
    product_image: String(itemRow.product_image || ''),
    default_display_name: String(itemRow.customer_name),
    variant_summary: variantsSummary,
    existing_review: existingReviewRow ? hydrateReview(existingReviewRow) : null,
    can_edit: canEdit,
  });
});

app.post('/api/reviews', rateLimit('reviews', 10, 10 * 60 * 1000), (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  if (!checkHoneypot(body)) {
    res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
    return;
  }

  const token = String(body.review_token || '').trim();
  const displayName = String(body.display_name || '').trim().slice(0, 80);
  const rating = Number(body.rating);
  const comment = String(body.comment || '').trim().slice(0, 1500);
  const images = sanitizeImageUrls(body.images);

  if (!token || token.length < 16) {
    res.status(400).json({ error: 'Thiếu mã xác thực đơn hàng hợp lệ để đánh giá.' });
    return;
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Vui lòng chọn số sao từ 1 đến 5.' });
    return;
  }
  if (comment.length < 5) {
    res.status(400).json({ error: 'Vui lòng viết nhận xét tối thiểu 5 ký tự.' });
    return;
  }

  const itemRow = db
    .prepare(
      `SELECT oi.*, o.status as order_status, o.customer_name
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE oi.review_token = ?`
    )
    .get(token) as Record<string, unknown> | undefined;

  if (!itemRow) {
    res.status(404).json({ error: 'Mã xác thực đánh giá không tồn tại.' });
    return;
  }
  if (itemRow.order_status !== 'completed') {
    res.status(403).json({
      error: 'Đơn hàng cần ở trạng thái Hoàn tất mới có thể gửi đánh giá sản phẩm.',
    });
    return;
  }

  let variantSummary = '';
  try {
    const vObj = JSON.parse(String(itemRow.selected_variants_json || '{}')) as Record<
      string,
      { label: string }
    >;
    variantSummary = Object.values(vObj)
      .map((v) => v.label)
      .join(' · ');
  } catch {
    variantSummary = '';
  }

  const finalDisplayName = displayName || String(itemRow.customer_name);

  const existing = db
    .prepare('SELECT * FROM reviews WHERE order_item_id = ?')
    .get(itemRow.id) as Record<string, unknown> | undefined;

  if (existing) {
    const createdMs = new Date(String(existing.created_at) + 'Z').getTime();
    if (Date.now() - createdMs > 7 * 24 * 60 * 60 * 1000) {
      res.status(400).json({
        error: 'Đã quá thời hạn 7 ngày cho phép chỉnh sửa đánh giá đối với lượt mua này.',
      });
      return;
    }
    db.prepare(
      `UPDATE reviews
       SET display_name = ?, rating = ?, comment = ?, images_json = ?, is_edited = 1, updated_at = datetime('now')
       WHERE id = ?`
    ).run(finalDisplayName, rating, comment, JSON.stringify(images), existing.id);

    const updated = db.prepare('SELECT * FROM reviews WHERE id = ?').get(existing.id) as Record<
      string,
      unknown
    >;
    res.json({ review: hydrateReview(updated), updated: true });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO reviews (
        product_id, order_item_id, display_name, rating, comment, images_json, variant_summary, verified_purchase, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'published')`
    )
    .run(
      itemRow.product_id,
      itemRow.id,
      finalDisplayName,
      rating,
      comment,
      JSON.stringify(images),
      variantSummary
    );

  const created = db
    .prepare('SELECT * FROM reviews WHERE id = ?')
    .get(info.lastInsertRowid) as Record<string, unknown>;
  res.status(201).json({ review: hydrateReview(created), updated: false });
});

app.post(
  '/api/products/:id/questions',
  rateLimit('questions', 10, 10 * 60 * 1000),
  (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (!checkHoneypot(body)) {
      res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
      return;
    }

    const productId = Number(req.params.id);
    const askerName = String(body.asker_name || '').trim().slice(0, 80);
    const question = String(body.question || '').trim().slice(0, 800);

    if (askerName.length < 2) {
      res.status(400).json({ error: 'Vui lòng nhập tên của bạn.' });
      return;
    }
    if (question.length < 6) {
      res.status(400).json({ error: 'Vui lòng nhập câu hỏi cụ thể (tối thiểu 6 ký tự).' });
      return;
    }

    const prod = db.prepare('SELECT id FROM products WHERE id = ? AND is_active = 1').get(productId);
    if (!prod) {
      res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
      return;
    }

    const info = db
      .prepare(
        `INSERT INTO product_questions (product_id, asker_name, question, status) VALUES (?, ?, ?, 'published')`
      )
      .run(productId, askerName, question);

    const row = db
      .prepare('SELECT * FROM product_questions WHERE id = ?')
      .get(info.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json({ question: hydrateQuestion(row) });
  }
);

// ============================================================================
// CUSTOM DESIGN, EVENT DECORATION & CONTACT INQUIRIES
// ============================================================================

app.post(
  '/api/custom-requests',
  rateLimit('custom_requests', 10, 10 * 60 * 1000),
  (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (!checkHoneypot(body)) {
      res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
      return;
    }

    const idempotencyKey = String(body.idempotency_key || '').trim();
    if (idempotencyKey) {
      const existing = db
        .prepare('SELECT * FROM custom_requests WHERE idempotency_key = ?')
        .get(idempotencyKey) as Record<string, unknown> | undefined;
      if (existing) {
        res.json({ reference_code: existing.reference_code, status: existing.status, deduplicated: true });
        return;
      }
    }

    const productType = String(body.product_type || '').trim();
    const occasion = String(body.occasion || '').trim();
    const customerName = String(body.customer_name || '').trim();
    const customerPhone = normalizePhone(String(body.customer_phone || ''));
    const neededDate = String(body.needed_date || '').trim();

    if (!productType || !occasion) {
      res.status(400).json({ error: 'Vui lòng chọn loại sản phẩm và dịp sử dụng.' });
      return;
    }
    if (customerName.length < 2 || !isValidVietnamesePhone(customerPhone)) {
      res.status(400).json({ error: 'Vui lòng nhập họ tên và số điện thoại hợp lệ.' });
      return;
    }
    if (!neededDate) {
      res.status(400).json({ error: 'Vui lòng chọn ngày cần nhận sản phẩm.' });
      return;
    }

    const referenceCode = generateCode('HN-TK');
    const images = sanitizeImageUrls(body.reference_images);

    db.prepare(
      `INSERT INTO custom_requests (
        idempotency_key, reference_code, product_type, occasion, colors, theme_character,
        desired_size, personalization_text, budget, needed_date, reference_images_json,
        customer_name, customer_phone, customer_email, customer_note, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
    ).run(
      idempotencyKey || null,
      referenceCode,
      productType.slice(0, 120),
      occasion.slice(0, 120),
      String(body.colors || '').trim().slice(0, 160),
      String(body.theme_character || '').trim().slice(0, 200),
      String(body.desired_size || '').trim().slice(0, 120),
      String(body.personalization_text || '').trim().slice(0, 300),
      String(body.budget || '').trim().slice(0, 120),
      neededDate.slice(0, 30),
      JSON.stringify(images),
      customerName.slice(0, 100),
      customerPhone,
      String(body.customer_email || '').trim().slice(0, 120),
      String(body.customer_note || '').trim().slice(0, 1000)
    );

    res.status(201).json({
      reference_code: referenceCode,
      status: 'new',
    });
  }
);

app.post(
  '/api/event-quotes',
  rateLimit('event_quotes', 10, 10 * 60 * 1000),
  (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (!checkHoneypot(body)) {
      res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
      return;
    }

    const idempotencyKey = String(body.idempotency_key || '').trim();
    if (idempotencyKey) {
      const existing = db
        .prepare('SELECT * FROM event_quotes WHERE idempotency_key = ?')
        .get(idempotencyKey) as Record<string, unknown> | undefined;
      if (existing) {
        res.json({ reference_code: existing.reference_code, status: existing.status, deduplicated: true });
        return;
      }
    }

    const eventType = String(body.event_type || '').trim();
    const eventDate = String(body.event_date || '').trim();
    const location = String(body.location || '').trim();
    const customerName = String(body.customer_name || '').trim();
    const customerPhone = normalizePhone(String(body.customer_phone || ''));

    if (!eventType || !eventDate || location.length < 4) {
      res.status(400).json({ error: 'Vui lòng điền loại sự kiện, ngày tổ chức và địa điểm.' });
      return;
    }
    if (customerName.length < 2 || !isValidVietnamesePhone(customerPhone)) {
      res.status(400).json({ error: 'Vui lòng nhập họ tên và số điện thoại liên hệ hợp lệ.' });
      return;
    }

    const referenceCode = generateCode('HN-SK');
    const desiredItems = Array.isArray(body.desired_items)
      ? body.desired_items.map((x) => String(x).trim().slice(0, 100)).filter(Boolean)
      : [];
    const images = sanitizeImageUrls(body.reference_images);
    const venueSetting = ['indoor', 'outdoor', 'both'].includes(String(body.venue_setting))
      ? String(body.venue_setting)
      : 'indoor';

    db.prepare(
      `INSERT INTO event_quotes (
        idempotency_key, reference_code, event_type, event_date, event_time, location,
        venue_setting, scale_area, style_colors, desired_items_json, budget,
        reference_images_json, customer_name, customer_phone, customer_email, customer_note, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`
    ).run(
      idempotencyKey || null,
      referenceCode,
      eventType.slice(0, 120),
      eventDate.slice(0, 30),
      String(body.event_time || '').trim().slice(0, 40),
      location.slice(0, 240),
      venueSetting,
      String(body.scale_area || '').trim().slice(0, 160),
      String(body.style_colors || '').trim().slice(0, 200),
      JSON.stringify(desiredItems),
      String(body.budget || '').trim().slice(0, 120),
      JSON.stringify(images),
      customerName.slice(0, 100),
      customerPhone,
      String(body.customer_email || '').trim().slice(0, 120),
      String(body.customer_note || '').trim().slice(0, 1200)
    );

    res.status(201).json({
      reference_code: referenceCode,
      status: 'new',
    });
  }
);

app.post('/api/contact', rateLimit('contact', 10, 10 * 60 * 1000), (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  if (!checkHoneypot(body)) {
    res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
    return;
  }

  const customerName = String(body.customer_name || '').trim();
  const customerPhone = normalizePhone(String(body.customer_phone || ''));
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  if (customerName.length < 2 || !isValidVietnamesePhone(customerPhone)) {
    res.status(400).json({ error: 'Vui lòng nhập họ tên và số điện thoại hợp lệ.' });
    return;
  }
  if (message.length < 8) {
    res.status(400).json({ error: 'Vui lòng nhập nội dung cần hỗ trợ (tối thiểu 8 ký tự).' });
    return;
  }

  const referenceCode = generateCode('HN-LH');
  db.prepare(
    `INSERT INTO contact_messages (reference_code, customer_name, customer_phone, customer_email, subject, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    referenceCode,
    customerName.slice(0, 100),
    customerPhone,
    String(body.customer_email || '').trim().slice(0, 120),
    (subject || 'Tư vấn chung').slice(0, 160),
    message.slice(0, 1500)
  );

  res.status(201).json({ reference_code: referenceCode });
});

// ============================================================================
// ADMIN AUTHENTICATION & FIRST-RUN CLAIM
// ============================================================================

app.get('/api/admin/auth/status', (_req: Request, res: Response) => {
  res.json(getAdminAuthStatus());
});

app.post(
  '/api/admin/auth/setup',
  rateLimit('admin_setup', 10, 15 * 60 * 1000),
  (req: Request, res: Response) => {
    const status = getAdminAuthStatus();
    if (!status.needsSetup) {
      res.status(403).json({
        error: 'Hệ thống quản trị đã được thiết lập. Vui lòng đăng nhập bằng tài khoản đã tạo.',
      });
      return;
    }

    const email = String(req.body.email || status.defaultAdminEmail).trim().toLowerCase();
    const fullName = String(req.body.full_name || 'Chủ cửa hàng Hoa Nelly').trim();
    const password = String(req.body.password || '');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Email quản trị không hợp lệ.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Mật khẩu quản trị cần tối thiểu 8 ký tự.' });
      return;
    }

    const passwordHash = hashPassword(password);
    try {
      const info = db
        .prepare(
          `INSERT INTO admin_users (email, full_name, password_hash, role, permissions_json, is_active)
           VALUES (?, ?, ?, 'owner', ?, 1)`
        )
        .run(email, fullName.slice(0, 100), passwordHash, JSON.stringify(ROLE_DEFAULT_PERMISSIONS.owner));

      const userRow = db
        .prepare('SELECT * FROM admin_users WHERE id = ?')
        .get(info.lastInsertRowid) as Record<string, unknown>;
      const user = mapAdminRow(userRow);
      const session = createAdminSession(user.id);
      res.status(201).json({ token: session.token, user });
    } catch {
      res.status(409).json({ error: 'Tài khoản quản trị đã tồn tại.' });
    }
  }
);

app.post(
  '/api/admin/auth/login',
  rateLimit('admin_login', 15, 15 * 60 * 1000),
  (req: Request, res: Response) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!password) {
      res.status(400).json({ error: 'Vui lòng nhập mật khẩu.' });
      return;
    }

    const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
    const defaultEmail = (process.env.ADMIN_EMAIL || 'admin@hoanelly.vn').trim().toLowerCase();

    // Configured env passcode always overrides for owner login
    if (
      envPasscode.length > 0 &&
      (!email || email === defaultEmail) &&
      constantTimeStringCompare(password, envPasscode)
    ) {
      const owner = ensureEnvOwnerExists();
      const session = createAdminSession(owner.id);
      res.json({ token: session.token, user: owner });
      return;
    }

    if (!email) {
      res.status(400).json({ error: 'Vui lòng nhập email quản trị.' });
      return;
    }

    const userRow = db
      .prepare('SELECT * FROM admin_users WHERE LOWER(email) = ?')
      .get(email) as Record<string, unknown> | undefined;

    if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
      res.status(401).json({ error: 'Email hoặc mật khẩu quản trị chưa chính xác.' });
      return;
    }
    if (!userRow.is_active) {
      res.status(403).json({ error: 'Tài khoản này đang bị tạm khóa.' });
      return;
    }

    const user = mapAdminRow(userRow);
    const session = createAdminSession(user.id);
    res.json({ token: session.token, user });
  }
);

app.get('/api/admin/auth/me', requireAdmin(), (req: AuthedAdminRequest, res: Response) => {
  res.json({ user: req.adminUser });
});

app.post('/api/admin/auth/logout', requireAdmin(), (req: AuthedAdminRequest, res: Response) => {
  if (req.sessionTokenHash) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(req.sessionTokenHash);
  }
  res.json({ ok: true });
});

// ============================================================================
// ADMIN PROTECTED ROUTES
// ============================================================================

// Helpers for Vietnam timezone (UTC+7) week/month bucketing
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseSqliteUtcDate(raw: unknown): Date {
  const s = String(raw || '').trim();
  if (!s) return new Date(0);
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const withZone = /([Zz]|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? new Date(0) : d;
}

function toVnShiftedDate(utcDate: Date): Date {
  return new Date(utcDate.getTime() + VN_OFFSET_MS);
}

function formatYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDmUtc(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${m}`;
}

function getIsoWeekInfo(vnDate: Date): { key: string; weekNum: number; year: number; monday: Date; sunday: Date } {
  const d = new Date(Date.UTC(vnDate.getUTCFullYear(), vnDate.getUTCMonth(), vnDate.getUTCDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1..Sun=7
  const monday = new Date(d.getTime());
  monday.setUTCDate(d.getUTCDate() - (dayNum - 1));
  const sunday = new Date(monday.getTime());
  sunday.setUTCDate(monday.getUTCDate() + 6);

  // ISO week number via Thursday
  const thursday = new Date(monday.getTime());
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const weekNum = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  const key = `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
  return { key, weekNum, year: isoYear, monday, sunday };
}

function getMonthInfo(vnDate: Date): { key: string; monthNum: number; year: number; firstDay: Date; lastDay: Date } {
  const year = vnDate.getUTCFullYear();
  const monthIdx = vnDate.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, monthIdx, 1));
  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0));
  const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  return { key, monthNum: monthIdx + 1, year, firstDay, lastDay };
}

function getBucketKeyForTimestamp(raw: unknown, granularity: 'week' | 'month'): string {
  const vn = toVnShiftedDate(parseSqliteUtcDate(raw));
  return granularity === 'week' ? getIsoWeekInfo(vn).key : getMonthInfo(vn).key;
}

app.get('/api/admin/dashboard', requireAdmin(), (req: AuthedAdminRequest, res: Response) => {
  const granularity: 'week' | 'month' = req.query.granularity === 'week' ? 'week' : 'month';
  const rawPeriod = String(req.query.period || 'all').trim();

  // Build ordered trailing buckets (last 8 weeks or last 12 months in Vietnam time)
  const nowVn = toVnShiftedDate(new Date());
  interface MutableBucket {
    key: string;
    label: string;
    short_label: string;
    start_date: string;
    end_date: string;
    orders_total: number;
    orders_pending: number;
    orders_completed: number;
    orders_cancelled: number;
    paid_revenue: number;
    completed_revenue: number;
    gross_revenue: number;
    custom_requests_total: number;
    custom_requests_open: number;
    event_quotes_total: number;
    event_quotes_open: number;
    quoted_confirmed_value: number;
    contact_messages_total: number;
    contact_messages_open: number;
    questions_total: number;
    unanswered_questions: number;
    reviews_count: number;
    reviews_rating_sum: number;
  }

  const makeEmptyBucket = (
    key: string,
    label: string,
    shortLabel: string,
    startDate: string,
    endDate: string
  ): MutableBucket => ({
    key,
    label,
    short_label: shortLabel,
    start_date: startDate,
    end_date: endDate,
    orders_total: 0,
    orders_pending: 0,
    orders_completed: 0,
    orders_cancelled: 0,
    paid_revenue: 0,
    completed_revenue: 0,
    gross_revenue: 0,
    custom_requests_total: 0,
    custom_requests_open: 0,
    event_quotes_total: 0,
    event_quotes_open: 0,
    quoted_confirmed_value: 0,
    contact_messages_total: 0,
    contact_messages_open: 0,
    questions_total: 0,
    unanswered_questions: 0,
    reviews_count: 0,
    reviews_rating_sum: 0,
  });

  const bucketMap = new Map<string, MutableBucket>();
  const orderedKeys: string[] = [];

  if (granularity === 'week') {
    const currentWeek = getIsoWeekInfo(nowVn);
    for (let i = 7; i >= 0; i--) {
      const ref = new Date(currentWeek.monday.getTime() - i * 7 * 86400000);
      const info = getIsoWeekInfo(ref);
      const label = `Tuần ${info.weekNum} (${formatDmUtc(info.monday)}–${formatDmUtc(info.sunday)})`;
      const shortLabel = `T${info.weekNum} (${formatDmUtc(info.monday)})`;
      bucketMap.set(
        info.key,
        makeEmptyBucket(info.key, label, shortLabel, formatYmdUtc(info.monday), formatYmdUtc(info.sunday))
      );
      orderedKeys.push(info.key);
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const ref = new Date(Date.UTC(nowVn.getUTCFullYear(), nowVn.getUTCMonth() - i, 1));
      const info = getMonthInfo(ref);
      const label = `Tháng ${String(info.monthNum).padStart(2, '0')}/${info.year}`;
      const shortLabel = `T${info.monthNum}/${String(info.year).slice(-2)}`;
      bucketMap.set(
        info.key,
        makeEmptyBucket(info.key, label, shortLabel, formatYmdUtc(info.firstDay), formatYmdUtc(info.lastDay))
      );
      orderedKeys.push(info.key);
    }
  }

  const selectedPeriod =
    rawPeriod === 'all' || bucketMap.has(rawPeriod) ? rawPeriod : 'all';

  const matchesSelected = (createdAt: unknown): boolean =>
    selectedPeriod === 'all' || getBucketKeyForTimestamp(createdAt, granularity) === selectedPeriod;

  const orderRows = db
    .prepare('SELECT status, payment_status, total_amount, created_at FROM orders')
    .all() as { status: string; payment_status: string; total_amount: number; created_at: string }[];

  const customRows = db
    .prepare('SELECT status, quoted_price, created_at FROM custom_requests')
    .all() as { status: string; quoted_price: number | null; created_at: string }[];

  const eventRows = db
    .prepare('SELECT status, quoted_price, created_at FROM event_quotes')
    .all() as { status: string; quoted_price: number | null; created_at: string }[];

  const contactRows = db
    .prepare('SELECT status, created_at FROM contact_messages')
    .all() as { status: string; created_at: string }[];

  const reviewRows = db
    .prepare(`SELECT rating, created_at FROM reviews WHERE status = 'published'`)
    .all() as { rating: number; created_at: string }[];

  const questionRows = db
    .prepare(`SELECT answer, created_at FROM product_questions WHERE status = 'published'`)
    .all() as { answer: string | null; created_at: string }[];

  const productCounts = db
    .prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN is_demo_sample = 1 THEN 1 ELSE 0 END) as demo FROM products`
    )
    .get() as { total: number; active: number; demo: number };

  const summary = {
    total_orders: 0,
    pending_orders: 0,
    completed_orders: 0,
    cancelled_orders: 0,
    paid_revenue: 0,
    completed_revenue: 0,
    gross_revenue: 0,
    custom_requests_total: 0,
    open_custom_requests: 0,
    event_quotes_total: 0,
    open_event_quotes: 0,
    quoted_confirmed_value: 0,
    contact_messages_total: 0,
    open_contact_messages: 0,
    published_reviews: 0,
    average_rating: 0,
    questions_total: 0,
    unanswered_questions: 0,
    products_total: productCounts.total,
    products_active: productCounts.active || 0,
    products_demo: productCounts.demo || 0,
  };
  let summaryRatingSum = 0;

  for (const r of orderRows) {
    const key = getBucketKeyForTimestamp(r.created_at, granularity);
    const b = bucketMap.get(key);
    const amount = Number(r.total_amount || 0);
    const isPending = ['pending_confirmation', 'confirmed', 'in_production', 'delivering'].includes(r.status);
    const isCompleted = r.status === 'completed';
    const isCancelled = r.status === 'cancelled';
    const isPaid = r.payment_status === 'paid' && !isCancelled;

    if (b) {
      b.orders_total += 1;
      if (isPending) b.orders_pending += 1;
      if (isCompleted) b.orders_completed += 1;
      if (isCancelled) b.orders_cancelled += 1;
      if (isPaid) b.paid_revenue += amount;
      if (isCompleted) b.completed_revenue += amount;
      if (!isCancelled) b.gross_revenue += amount;
    }

    if (matchesSelected(r.created_at)) {
      summary.total_orders += 1;
      if (isPending) summary.pending_orders += 1;
      if (isCompleted) summary.completed_orders += 1;
      if (isCancelled) summary.cancelled_orders += 1;
      if (isPaid) summary.paid_revenue += amount;
      if (isCompleted) summary.completed_revenue += amount;
      if (!isCancelled) summary.gross_revenue += amount;
    }
  }

  for (const r of customRows) {
    const key = getBucketKeyForTimestamp(r.created_at, granularity);
    const b = bucketMap.get(key);
    const isOpen = ['new', 'consulting', 'quoted'].includes(r.status);
    const confirmedQuote =
      ['confirmed', 'completed'].includes(r.status) && r.quoted_price ? Number(r.quoted_price) : 0;

    if (b) {
      b.custom_requests_total += 1;
      if (isOpen) b.custom_requests_open += 1;
      b.quoted_confirmed_value += confirmedQuote;
    }
    if (matchesSelected(r.created_at)) {
      summary.custom_requests_total += 1;
      if (isOpen) summary.open_custom_requests += 1;
      summary.quoted_confirmed_value += confirmedQuote;
    }
  }

  for (const r of eventRows) {
    const key = getBucketKeyForTimestamp(r.created_at, granularity);
    const b = bucketMap.get(key);
    const isOpen = ['new', 'consulting', 'quoted'].includes(r.status);
    const confirmedQuote =
      ['confirmed', 'completed'].includes(r.status) && r.quoted_price ? Number(r.quoted_price) : 0;

    if (b) {
      b.event_quotes_total += 1;
      if (isOpen) b.event_quotes_open += 1;
      b.quoted_confirmed_value += confirmedQuote;
    }
    if (matchesSelected(r.created_at)) {
      summary.event_quotes_total += 1;
      if (isOpen) summary.open_event_quotes += 1;
      summary.quoted_confirmed_value += confirmedQuote;
    }
  }

  for (const r of contactRows) {
    const key = getBucketKeyForTimestamp(r.created_at, granularity);
    const b = bucketMap.get(key);
    const isOpen = r.status === 'new';

    if (b) {
      b.contact_messages_total += 1;
      if (isOpen) b.contact_messages_open += 1;
    }
    if (matchesSelected(r.created_at)) {
      summary.contact_messages_total += 1;
      if (isOpen) summary.open_contact_messages += 1;
    }
  }

  for (const r of reviewRows) {
    const key = getBucketKeyForTimestamp(r.created_at, granularity);
    const b = bucketMap.get(key);
    const rating = Number(r.rating || 0);

    if (b) {
      b.reviews_count += 1;
      b.reviews_rating_sum += rating;
    }
    if (matchesSelected(r.created_at)) {
      summary.published_reviews += 1;
      summaryRatingSum += rating;
    }
  }

  for (const r of questionRows) {
    const key = getBucketKeyForTimestamp(r.created_at, granularity);
    const b = bucketMap.get(key);
    const isUnanswered = !r.answer;

    if (b) {
      b.questions_total += 1;
      if (isUnanswered) b.unanswered_questions += 1;
    }
    if (matchesSelected(r.created_at)) {
      summary.questions_total += 1;
      if (isUnanswered) summary.unanswered_questions += 1;
    }
  }

  summary.average_rating =
    summary.published_reviews > 0
      ? Math.round((summaryRatingSum / summary.published_reviews) * 10) / 10
      : 0;

  const buckets = orderedKeys.map((k) => {
    const b = bucketMap.get(k)!;
    return {
      key: b.key,
      label: b.label,
      short_label: b.short_label,
      start_date: b.start_date,
      end_date: b.end_date,
      orders_total: b.orders_total,
      orders_pending: b.orders_pending,
      orders_completed: b.orders_completed,
      orders_cancelled: b.orders_cancelled,
      paid_revenue: b.paid_revenue,
      completed_revenue: b.completed_revenue,
      gross_revenue: b.gross_revenue,
      custom_requests_total: b.custom_requests_total,
      custom_requests_open: b.custom_requests_open,
      event_quotes_total: b.event_quotes_total,
      event_quotes_open: b.event_quotes_open,
      quoted_confirmed_value: b.quoted_confirmed_value,
      contact_messages_total: b.contact_messages_total,
      contact_messages_open: b.contact_messages_open,
      questions_total: b.questions_total,
      unanswered_questions: b.unanswered_questions,
      reviews_count: b.reviews_count,
      reviews_avg_rating:
        b.reviews_count > 0 ? Math.round((b.reviews_rating_sum / b.reviews_count) * 10) / 10 : 0,
    };
  });

  res.json({
    ...summary,
    granularity,
    selected_period: selectedPeriod,
    summary,
    buckets,
  });
});

// Admin Products
app.get('/api/admin/products', requireAdmin('products'), (_req: AuthedAdminRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all() as Record<string, unknown>[];
  res.json({ items: hydrateProductsBatch(rows), categories: getCategories() });
});

app.post('/api/admin/products', requireAdmin('products'), (req: AuthedAdminRequest, res: Response) => {
  const b = req.body as Partial<Product>;
  const name = String(b.name || '').trim();
  const sku = String(b.sku || '').trim().toUpperCase();
  const slug =
    String(b.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-') || `san-pham-${Date.now()}`;
  const categorySlug = String(b.category_slug || 'hoa-bong-bay-nghe-thuat');

  if (!name || !sku) {
    res.status(400).json({ error: 'Vui lòng nhập tên và mã SKU sản phẩm.' });
    return;
  }

  try {
    const info = db
      .prepare(
        `INSERT INTO products (
          sku, slug, name, category_slug, occasions_json, colors_json,
          pricing_type, base_price, original_price, availability_status, prep_hours,
          short_description, images_json, video_url, variants_json, addons_json,
          personalization_json, specs_json, is_featured, is_active, is_demo_sample
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        sku,
        slug,
        name,
        categorySlug,
        JSON.stringify(b.occasions || []),
        JSON.stringify(b.colors || []),
        b.pricing_type || 'fixed',
        b.pricing_type === 'quote' ? null : Number(b.base_price || 0),
        b.original_price ? Number(b.original_price) : null,
        b.availability_status || 'made_to_order',
        Number(b.prep_hours || 12),
        String(b.short_description || ''),
        JSON.stringify(
          Array.isArray(b.images)
            ? b.images.map((u) => sanitizeLocalOrHttpImage(u)).filter(Boolean)
            : []
        ),
        sanitizeLocalOrHttpVideo(b.video_url) || null,
        JSON.stringify(b.variants || []),
        JSON.stringify(b.addons || []),
        JSON.stringify(
          b.personalization || {
            allow_card_message: true,
            allow_custom_text: false,
            custom_text_surcharge: 0,
            allow_reference_image: true,
            allow_note: true,
            allow_theme_input: false,
          }
        ),
        JSON.stringify(b.specs || {}),
        b.is_featured ? 1 : 0,
        b.is_active !== false ? 1 : 0,
        b.is_demo_sample ? 1 : 0
      );

    const row = db
      .prepare('SELECT * FROM products WHERE id = ?')
      .get(info.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json({ product: hydrateProduct(row) });
  } catch {
    res.status(409).json({ error: 'Mã SKU hoặc đường dẫn slug đã tồn tại.' });
  }
});

app.put('/api/admin/products/:id', requireAdmin('products'), (req: AuthedAdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
    return;
  }
  const b = req.body as Partial<Product>;
  try {
    db.prepare(
      `UPDATE products SET
        sku = ?, slug = ?, name = ?, category_slug = ?, occasions_json = ?, colors_json = ?,
        pricing_type = ?, base_price = ?, original_price = ?, availability_status = ?, prep_hours = ?,
        short_description = ?, images_json = ?, video_url = ?, variants_json = ?, addons_json = ?,
        personalization_json = ?, specs_json = ?, is_featured = ?, is_active = ?, is_demo_sample = ?
      WHERE id = ?`
    ).run(
      String(b.sku || '').trim().toUpperCase(),
      String(b.slug || '').trim().toLowerCase(),
      String(b.name || '').trim(),
      String(b.category_slug || 'hoa-bong-bay-nghe-thuat'),
      JSON.stringify(b.occasions || []),
      JSON.stringify(b.colors || []),
      b.pricing_type || 'fixed',
      b.pricing_type === 'quote' ? null : Number(b.base_price || 0),
      b.original_price ? Number(b.original_price) : null,
      b.availability_status || 'made_to_order',
      Number(b.prep_hours || 12),
      String(b.short_description || ''),
      JSON.stringify(
        Array.isArray(b.images)
          ? b.images.map((u) => sanitizeLocalOrHttpImage(u)).filter(Boolean)
          : []
      ),
      sanitizeLocalOrHttpVideo(b.video_url) || null,
      JSON.stringify(b.variants || []),
      JSON.stringify(b.addons || []),
      JSON.stringify(b.personalization || {}),
      JSON.stringify(b.specs || {}),
      b.is_featured ? 1 : 0,
      b.is_active !== false ? 1 : 0,
      b.is_demo_sample ? 1 : 0,
      id
    );

    const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Record<string, unknown>;
    res.json({ product: hydrateProduct(row) });
  } catch {
    res.status(409).json({ error: 'Không thể cập nhật: mã SKU hoặc slug bị trùng.' });
  }
});

app.patch('/api/admin/products/:id/toggle', requireAdmin('products'), (req: AuthedAdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT is_active FROM products WHERE id = ?').get(id) as
    | { is_active: number }
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Không tìm thấy sản phẩm.' });
    return;
  }
  const nextActive = row.is_active ? 0 : 1;
  db.prepare('UPDATE products SET is_active = ? WHERE id = ?').run(nextActive, id);
  res.json({ is_active: Boolean(nextActive) });
});

// Admin Orders
app.get('/api/admin/orders', requireAdmin('orders'), (_req: AuthedAdminRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all() as Record<string, unknown>[];
  res.json({ items: hydrateOrdersBatch(rows, true) });
});

app.patch('/api/admin/orders/:id', requireAdmin('orders'), (req: AuthedAdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy đơn hàng.' });
    return;
  }

  const b = req.body as Record<string, unknown>;
  const validOrderStatuses = [
    'pending_confirmation',
    'confirmed',
    'in_production',
    'delivering',
    'completed',
    'cancelled',
  ];
  const validPaymentStatuses = ['unpaid', 'pending_verification', 'deposit_paid', 'paid'];
  const status =
    b.status !== undefined && validOrderStatuses.includes(String(b.status))
      ? String(b.status)
      : String(existing.status);
  const paymentStatus =
    b.payment_status !== undefined && validPaymentStatuses.includes(String(b.payment_status))
      ? String(b.payment_status)
      : String(existing.payment_status);
  const shippingFee =
    b.shipping_fee === undefined
      ? (existing.shipping_fee as number | null)
      : b.shipping_fee === null || b.shipping_fee === ''
        ? null
        : Number.isFinite(Number(b.shipping_fee))
          ? Math.max(0, Math.round(Number(b.shipping_fee)))
          : (existing.shipping_fee as number | null);
  const shippingFeeStatus = shippingFee !== null ? 'confirmed' : 'pending_confirmation';
  const scheduleConfirmed =
    b.schedule_confirmed === undefined ? Boolean(existing.schedule_confirmed) : Boolean(b.schedule_confirmed);
  const depositPaid =
    b.deposit_paid_amount === undefined
      ? Number(existing.deposit_paid_amount || 0)
      : Number.isFinite(Number(b.deposit_paid_amount))
        ? Math.max(0, Math.round(Number(b.deposit_paid_amount)))
        : Number(existing.deposit_paid_amount || 0);
  const adminNote =
    b.admin_note === undefined ? (existing.admin_note as string | null) : String(b.admin_note).slice(0, 1000);

  const newTotal = Math.max(
    0,
    Number(existing.subtotal) +
      Number(existing.surcharge_total) -
      Number(existing.discount_amount || 0) +
      (shippingFee ?? 0)
  );

  db.prepare(
    `UPDATE orders SET
      status = ?, payment_status = ?, shipping_fee = ?, shipping_fee_status = ?,
      total_amount = ?, schedule_confirmed = ?, deposit_paid_amount = ?, admin_note = ?,
      updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    status,
    paymentStatus,
    shippingFee,
    shippingFeeStatus,
    newTotal,
    scheduleConfirmed ? 1 : 0,
    depositPaid,
    adminNote,
    id
  );

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, unknown>;
  res.json({ order: hydrateOrder(updated, true) });
});

// Admin Custom Requests
app.get(
  '/api/admin/custom-requests',
  requireAdmin('consultations'),
  (_req: AuthedAdminRequest, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM custom_requests ORDER BY id DESC')
      .all() as Record<string, unknown>[];
    res.json({
      items: rows.map(({ idempotency_key: _ik, ...r }) => ({
        ...r,
        reference_images: JSON.parse(String(r.reference_images_json || '[]')),
      })),
    });
  }
);

app.patch(
  '/api/admin/custom-requests/:id',
  requireAdmin('consultations'),
  (req: AuthedAdminRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM custom_requests WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy yêu cầu thiết kế.' });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const validInquiryStatuses = ['new', 'consulting', 'quoted', 'confirmed', 'completed', 'cancelled'];
    const nextStatus =
      b.status !== undefined && validInquiryStatuses.includes(String(b.status))
        ? String(b.status)
        : String(existing.status);
    const nextQuotedPrice =
      b.quoted_price === undefined
        ? (existing.quoted_price as number | null)
        : b.quoted_price === '' || b.quoted_price === null
          ? null
          : Number.isFinite(Number(b.quoted_price))
            ? Math.max(0, Math.round(Number(b.quoted_price)))
            : (existing.quoted_price as number | null);
    const nextAdminNote =
      b.admin_note === undefined
        ? String(existing.admin_note ?? '')
        : String(b.admin_note ?? '').slice(0, 1000);

    db.prepare(
      `UPDATE custom_requests SET status = ?, quoted_price = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(nextStatus, nextQuotedPrice, nextAdminNote, id);
    const updated = db.prepare('SELECT * FROM custom_requests WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    const { idempotency_key: _ik, ...safeUpdated } = updated;
    res.json({
      item: {
        ...safeUpdated,
        reference_images: JSON.parse(String(safeUpdated.reference_images_json || '[]')),
      },
    });
  }
);

// Admin Event Quotes
app.get(
  '/api/admin/event-quotes',
  requireAdmin('consultations'),
  (_req: AuthedAdminRequest, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM event_quotes ORDER BY id DESC')
      .all() as Record<string, unknown>[];
    res.json({
      items: rows.map(({ idempotency_key: _ik, ...r }) => ({
        ...r,
        desired_items: JSON.parse(String(r.desired_items_json || '[]')),
        reference_images: JSON.parse(String(r.reference_images_json || '[]')),
      })),
    });
  }
);

app.patch(
  '/api/admin/event-quotes/:id',
  requireAdmin('consultations'),
  (req: AuthedAdminRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM event_quotes WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy yêu cầu sự kiện.' });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const validInquiryStatuses = ['new', 'consulting', 'quoted', 'confirmed', 'completed', 'cancelled'];
    const nextStatus =
      b.status !== undefined && validInquiryStatuses.includes(String(b.status))
        ? String(b.status)
        : String(existing.status);
    const nextQuotedPrice =
      b.quoted_price === undefined
        ? (existing.quoted_price as number | null)
        : b.quoted_price === '' || b.quoted_price === null
          ? null
          : Number.isFinite(Number(b.quoted_price))
            ? Math.max(0, Math.round(Number(b.quoted_price)))
            : (existing.quoted_price as number | null);
    const nextAdminNote =
      b.admin_note === undefined
        ? String(existing.admin_note ?? '')
        : String(b.admin_note ?? '').slice(0, 1000);

    db.prepare(
      `UPDATE event_quotes SET status = ?, quoted_price = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(nextStatus, nextQuotedPrice, nextAdminNote, id);
    const updated = db.prepare('SELECT * FROM event_quotes WHERE id = ?').get(id) as Record<
      string,
      unknown
    >;
    const { idempotency_key: _ik, ...safeUpdated } = updated;
    res.json({
      item: {
        ...safeUpdated,
        desired_items: JSON.parse(String(safeUpdated.desired_items_json || '[]')),
        reference_images: JSON.parse(String(safeUpdated.reference_images_json || '[]')),
      },
    });
  }
);

// Admin Contact Messages
app.get(
  '/api/admin/contact-messages',
  requireAdmin('consultations'),
  (_req: AuthedAdminRequest, res: Response) => {
    const rows = db
      .prepare('SELECT * FROM contact_messages ORDER BY id DESC')
      .all() as Record<string, unknown>[];
    res.json({ items: rows });
  }
);

app.patch(
  '/api/admin/contact-messages/:id',
  requireAdmin('consultations'),
  (req: AuthedAdminRequest, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy tin nhắn liên hệ.' });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const validContactStatuses = ['new', 'replied', 'closed'];
    const nextStatus =
      b.status !== undefined && validContactStatuses.includes(String(b.status))
        ? String(b.status)
        : String(existing.status || 'new');
    const nextNote =
      b.admin_note === undefined
        ? String(existing.admin_note ?? '')
        : String(b.admin_note ?? '').slice(0, 1000);
    db.prepare('UPDATE contact_messages SET status = ?, admin_note = ? WHERE id = ?').run(
      nextStatus,
      nextNote,
      id
    );
    const updated = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(id);
    res.json({ ok: true, item: updated });
  }
);

// Admin Reviews & Replies & Moderation
app.get('/api/admin/reviews', requireAdmin('reviews'), (_req: AuthedAdminRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT r.*, p.name as product_name, p.slug as product_slug
       FROM reviews r
       JOIN products p ON p.id = r.product_id
       ORDER BY r.created_at DESC`
    )
    .all() as Record<string, unknown>[];
  res.json({ items: hydrateReviewsBatch(rows) });
});

app.post(
  '/api/admin/reviews/:id/reply',
  requireAdmin('reviews'),
  (req: AuthedAdminRequest, res: Response) => {
    const reviewId = Number(req.params.id);
    const content = String(req.body.content || '').trim().slice(0, 1200);
    if (content.length < 3) {
      res.status(400).json({ error: 'Vui lòng nhập nội dung phản hồi của Hoa Nelly.' });
      return;
    }
    const rev = db.prepare('SELECT id FROM reviews WHERE id = ?').get(reviewId);
    if (!rev) {
      res.status(404).json({ error: 'Không tìm thấy đánh giá.' });
      return;
    }

    const staffName = req.adminUser?.full_name || 'Hoa Nelly';
    const existingReply = db
      .prepare('SELECT id FROM review_replies WHERE review_id = ?')
      .get(reviewId) as { id: number } | undefined;

    if (existingReply) {
      db.prepare(
        `UPDATE review_replies SET content = ?, staff_name = ?, is_edited = 1, updated_at = datetime('now') WHERE review_id = ?`
      ).run(content, staffName, reviewId);
    } else {
      db.prepare(
        `INSERT INTO review_replies (review_id, staff_name, content, is_edited) VALUES (?, ?, ?, 0)`
      ).run(reviewId, staffName, content);
    }

    const updated = db
      .prepare(
        `SELECT r.*, p.name as product_name, p.slug as product_slug
         FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.id = ?`
      )
      .get(reviewId) as Record<string, unknown>;
    res.json({ review: hydrateReview(updated) });
  }
);

app.patch(
  '/api/admin/reviews/:id/moderate',
  requireAdmin('reviews'),
  (req: AuthedAdminRequest, res: Response) => {
    const reviewId = Number(req.params.id);
    const status = String(req.body.status || 'published');
    const reason = String(req.body.moderation_reason || '').trim();

    if (!['published', 'flagged', 'hidden_policy'].includes(status)) {
      res.status(400).json({ error: 'Trạng thái kiểm duyệt không hợp lệ.' });
      return;
    }
    if (status === 'hidden_policy' && reason.length < 5) {
      res.status(400).json({
        error:
          'Vui lòng ghi rõ lý do vi phạm chính sách (spam, xúc phạm hoặc lộ thông tin cá nhân). Không ẩn đánh giá chỉ vì điểm sao thấp.',
      });
      return;
    }

    // Notice: NEVER alters rating or customer comment text!
    db.prepare('UPDATE reviews SET status = ?, moderation_reason = ? WHERE id = ?').run(
      status,
      status === 'published' ? null : reason,
      reviewId
    );

    const updated = db
      .prepare(
        `SELECT r.*, p.name as product_name, p.slug as product_slug
         FROM reviews r JOIN products p ON p.id = r.product_id WHERE r.id = ?`
      )
      .get(reviewId) as Record<string, unknown>;
    res.json({ review: hydrateReview(updated) });
  }
);

// Admin Questions
app.get('/api/admin/questions', requireAdmin('reviews'), (_req: AuthedAdminRequest, res: Response) => {
  const rows = db
    .prepare(
      `SELECT q.*, p.name as product_name, p.slug as product_slug
       FROM product_questions q
       JOIN products p ON p.id = q.product_id
       ORDER BY q.created_at DESC`
    )
    .all() as Record<string, unknown>[];
  res.json({ items: rows.map(hydrateQuestion) });
});

app.post(
  '/api/admin/questions/:id/answer',
  requireAdmin('reviews'),
  (req: AuthedAdminRequest, res: Response) => {
    const id = Number(req.params.id);
    const answer = String(req.body.answer || '').trim().slice(0, 1200);
    if (answer.length < 3) {
      res.status(400).json({ error: 'Vui lòng nhập nội dung trả lời.' });
      return;
    }
    db.prepare(
      `UPDATE product_questions SET answer = ?, answered_by = ?, answered_at = datetime('now') WHERE id = ?`
    ).run(answer, req.adminUser?.full_name || 'Hoa Nelly', id);

    const row = db
      .prepare(
        `SELECT q.*, p.name as product_name, p.slug as product_slug
         FROM product_questions q JOIN products p ON p.id = q.product_id WHERE q.id = ?`
      )
      .get(id) as Record<string, unknown>;
    res.json({ question: hydrateQuestion(row) });
  }
);

app.patch(
  '/api/admin/questions/:id/status',
  requireAdmin('reviews'),
  (req: AuthedAdminRequest, res: Response) => {
    const id = Number(req.params.id);
    const status = req.body.status === 'hidden' ? 'hidden' : 'published';
    db.prepare('UPDATE product_questions SET status = ? WHERE id = ?').run(status, id);
    res.json({ ok: true });
  }
);

// Admin Gallery
app.get('/api/admin/gallery', requireAdmin('settings'), (_req: AuthedAdminRequest, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM gallery_items ORDER BY sort_order ASC, id DESC')
    .all() as Record<string, unknown>[];
  res.json({ items: rows.map(hydrateGallery) });
});

function sanitizeHttpUrl(raw: unknown): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  try {
    const parsed = new URL(s);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function sanitizeLocalOrHttpImage(raw: unknown): string {
  const s = String(raw || '').trim();
  if ((s.startsWith('/api/uploads/') || s.startsWith('/assets/aistudio/')) && !s.includes('..') && !s.includes('\\')) {
    return s;
  }
  return sanitizeHttpUrl(s);
}

function sanitizeLocalOrHttpVideo(raw: unknown): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  if ((s.startsWith('/api/uploads/') || s.startsWith('/assets/')) && !s.includes('..') && !s.includes('\\')) {
    return s;
  }
  return sanitizeHttpUrl(s);
}

app.post('/api/admin/gallery', requireAdmin('settings'), (req: AuthedAdminRequest, res: Response) => {
  const b = req.body as Record<string, unknown>;
  const title = String(b.title || '').trim();
  const imageUrl = sanitizeLocalOrHttpImage(b.image_url);
  if (!title || !imageUrl) {
    res.status(400).json({ error: 'Vui lòng nhập tiêu đề và chọn ảnh hợp lệ.' });
    return;
  }
  const imageType = ['sample_product', 'reference_idea', 'completed_project'].includes(
    String(b.image_type)
  )
    ? String(b.image_type)
    : 'sample_product';

  const info = db
    .prepare(
      `INSERT INTO gallery_items (title, category, image_type, image_url, caption, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`
    )
    .run(
      title,
      String(b.category || 'Hoa bóng bay nghệ thuật'),
      imageType,
      imageUrl,
      String(b.caption || ''),
      Number(b.sort_order || 10)
    );
  const row = db
    .prepare('SELECT * FROM gallery_items WHERE id = ?')
    .get(info.lastInsertRowid) as Record<string, unknown>;
  res.status(201).json({ item: hydrateGallery(row) });
});

app.delete(
  '/api/admin/gallery/:id',
  requireAdmin('settings'),
  (req: AuthedAdminRequest, res: Response) => {
    db.prepare('DELETE FROM gallery_items WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  }
);

// Admin Promo Codes
app.get('/api/admin/promos', requireAdmin('settings'), (_req: AuthedAdminRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM promo_codes ORDER BY id DESC').all();
  res.json({ items: rows });
});

app.post('/api/admin/promos', requireAdmin('settings'), (req: AuthedAdminRequest, res: Response) => {
  const b = req.body as Record<string, unknown>;
  const code = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (code.length < 3) {
    res.status(400).json({ error: 'Mã ưu đãi cần tối thiểu 3 ký tự chữ/số.' });
    return;
  }
  try {
    const info = db
      .prepare(
        `INSERT INTO promo_codes (code, discount_type, discount_value, min_order_amount, is_active, expires_at)
         VALUES (?, ?, ?, ?, 1, ?)`
      )
      .run(
        code,
        b.discount_type === 'percent' ? 'percent' : 'fixed',
        Math.max(1, Number(b.discount_value || 0)),
        Math.max(0, Number(b.min_order_amount || 0)),
        b.expires_at ? String(b.expires_at) : null
      );
    const row = db.prepare('SELECT * FROM promo_codes WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ promo: row });
  } catch {
    res.status(409).json({ error: 'Mã ưu đãi này đã tồn tại.' });
  }
});

app.delete(
  '/api/admin/promos/:id',
  requireAdmin('settings'),
  (req: AuthedAdminRequest, res: Response) => {
    db.prepare('DELETE FROM promo_codes WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  }
);

// Admin Settings
app.get('/api/admin/settings', requireAdmin('settings'), (_req: AuthedAdminRequest, res: Response) => {
  res.json({ settings: getStoreSettings() });
});

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 1 },
});

app.post(
  '/api/admin/upload-video',
  requireAdmin('settings'),
  (req: AuthedAdminRequest, res: Response) => {
    videoUpload.single('file')(req, res, async (err: unknown) => {
      if (err) {
        const message =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'Video vượt quá dung lượng tối đa 40MB.'
            : 'Không thể tải video lên.';
        res.status(400).json({ error: message });
        return;
      }
      const f = req.file;
      if (!f || !f.buffer || f.buffer.length < 16) {
        res.status(400).json({ error: 'Vui lòng chọn tệp video MP4 hoặc WebM.' });
        return;
      }
      const isMp4 = f.buffer.length >= 8 && f.buffer.subarray(4, 8).toString('ascii') === 'ftyp';
      const isWebm =
        f.buffer[0] === 0x1a && f.buffer[1] === 0x45 && f.buffer[2] === 0xdf && f.buffer[3] === 0xa3;
      if (!isMp4 && !isWebm) {
        res.status(400).json({ error: 'Chỉ hỗ trợ định dạng video MP4 hoặc WebM hợp lệ.' });
        return;
      }
      const ext = isWebm ? 'webm' : 'mp4';
      const safeName = `${crypto.randomUUID()}.${ext}`;
      const target = path.resolve(uploadDir, safeName);
      if (!target.startsWith(uploadDir + path.sep)) {
        res.status(400).json({ error: 'Đường dẫn tệp không hợp lệ.' });
        return;
      }
      await fs.promises.writeFile(target, f.buffer);
      res.json({ url: `/api/uploads/${safeName}` });
    });
  }
);

app.put('/api/admin/settings', requireAdmin('settings'), (req: AuthedAdminRequest, res: Response) => {
  const current = getStoreSettings();
  const incoming = req.body as Partial<StoreSettings>;
  const next: StoreSettings = {
    ...current,
    ...incoming,
    hero_bg_video_url:
      incoming.hero_bg_video_url !== undefined
        ? sanitizeLocalOrHttpVideo(incoming.hero_bg_video_url)
        : current.hero_bg_video_url || '',
    zalo_url: incoming.zalo_url !== undefined ? sanitizeHttpUrl(incoming.zalo_url) : current.zalo_url,
    facebook_url:
      incoming.facebook_url !== undefined
        ? sanitizeHttpUrl(incoming.facebook_url)
        : current.facebook_url,
    instagram_url:
      incoming.instagram_url !== undefined
        ? sanitizeHttpUrl(incoming.instagram_url)
        : current.instagram_url,
    tiktok_url:
      incoming.tiktok_url !== undefined ? sanitizeHttpUrl(incoming.tiktok_url) : current.tiktok_url,
    map_embed_url:
      incoming.map_embed_url !== undefined
        ? sanitizeHttpUrl(incoming.map_embed_url)
        : current.map_embed_url,
  };
  const saved = saveStoreSettings(next);
  res.json({ settings: saved });
});

// Admin Staff Management (Owner only)
app.get('/api/admin/staff', requireAdmin('staff'), (_req: AuthedAdminRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM admin_users ORDER BY id ASC').all() as Record<
    string,
    unknown
  >[];
  res.json({ items: rows.map(mapAdminRow) });
});

app.post('/api/admin/staff', requireAdmin('staff'), (req: AuthedAdminRequest, res: Response) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const fullName = String(req.body.full_name || '').trim();
  const password = String(req.body.password || '');
  const role: AdminRole = ['manager', 'staff'].includes(String(req.body.role))
    ? (req.body.role as AdminRole)
    : 'staff';
  const permissions = Array.isArray(req.body.permissions)
    ? req.body.permissions.map(String)
    : ROLE_DEFAULT_PERMISSIONS[role];

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || password.length < 8) {
    res.status(400).json({ error: 'Vui lòng nhập email hợp lệ, họ tên và mật khẩu tối thiểu 8 ký tự.' });
    return;
  }

  try {
    const info = db
      .prepare(
        `INSERT INTO admin_users (email, full_name, password_hash, role, permissions_json, is_active)
         VALUES (?, ?, ?, ?, ?, 1)`
      )
      .run(email, fullName, hashPassword(password), role, JSON.stringify(permissions));
    const row = db
      .prepare('SELECT * FROM admin_users WHERE id = ?')
      .get(info.lastInsertRowid) as Record<string, unknown>;
    res.status(201).json({ user: mapAdminRow(row) });
  } catch {
    res.status(409).json({ error: 'Email nhân viên này đã tồn tại.' });
  }
});

app.patch('/api/admin/staff/:id', requireAdmin('staff'), (req: AuthedAdminRequest, res: Response) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    return;
  }
  if (existing.role === 'owner' && req.body.is_active === false) {
    res.status(400).json({ error: 'Không thể tự khóa tài khoản Chủ cửa hàng.' });
    return;
  }
  const isActive = req.body.is_active === undefined ? Boolean(existing.is_active) : Boolean(req.body.is_active);
  const permissions = Array.isArray(req.body.permissions)
    ? JSON.stringify(req.body.permissions.map(String))
    : String(existing.permissions_json);
  db.prepare('UPDATE admin_users SET is_active = ?, permissions_json = ? WHERE id = ?').run(
    isActive ? 1 : 0,
    permissions,
    id
  );
  const updated = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(id) as Record<
    string,
    unknown
  >;
  res.json({ user: mapAdminRow(updated) });
});

// ============================================================================
// SEO SITEMAP.XML
// ============================================================================

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

app.get('/sitemap.xml', (req: Request, res: Response) => {
  const rawHost = String(req.get('host') || 'localhost:3000').replace(/[^A-Za-z0-9.:-]/g, '');
  const fallbackBase = `${req.protocol === 'https' ? 'https' : 'http'}://${rawHost}`;
  const baseUrl = (sanitizeHttpUrl(process.env.APP_URL) || fallbackBase).replace(/\/$/, '');
  const staticPaths = [
    '/',
    '/san-pham',
    '/bo-suu-tap',
    '/dat-thiet-ke-rieng',
    '/trang-tri-su-kien',
    '/thu-vien',
    '/gioi-thieu',
    '/huong-dan-va-hoi-dap',
    '/lien-he',
    '/tra-cuu-don-hang',
    '/chinh-sach',
  ];
  const categories = getCategories();
  const productSlugs = db
    .prepare('SELECT slug FROM products WHERE is_active = 1')
    .all() as { slug: string }[];
  const settings = getStoreSettings();

  const urls = [
    ...staticPaths,
    ...categories.map((c) => `/danh-muc/${encodeURIComponent(c.slug)}`),
    ...OCCASIONS.map((o) => `/bo-suu-tap/${encodeURIComponent(o.slug)}`),
    ...productSlugs.map((p) => `/san-pham/${encodeURIComponent(p.slug)}`),
    ...Object.keys(settings.policies).map((k) => `/chinh-sach/${encodeURIComponent(k)}`),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(`${baseUrl}${u}`)}</loc></url>`).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

// Return JSON 404 for any unmatched /api/* route instead of falling through to SPA HTML
app.all('/api/*', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Không tìm thấy tài nguyên yêu cầu.' });
});

// JSON error handler for /api/* (prevents Express from returning HTML error pages on bad JSON or runtime errors)
app.use('/api', (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  const typedErr = err as { type?: string; status?: number };
  if (typedErr?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    res.status(400).json({ error: 'Dữ liệu gửi lên không đúng định dạng JSON hợp lệ.' });
    return;
  }
  if (typedErr?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Dung lượng dữ liệu gửi lên vượt quá giới hạn cho phép.' });
    return;
  }
  console.error('Unhandled API error:', err);
  res.status(500).json({ error: 'Máy chủ gặp lỗi xử lý. Vui lòng thử lại sau.' });
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC HOSTING
// ============================================================================

async function startServer(): Promise<void> {
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  // Serve media assets with strong browser cache & byte-range support in both dev and production
  const publicMediaDir = path.resolve(process.cwd(), 'public/assets/aistudio');
  if (fs.existsSync(publicMediaDir)) {
    app.use(
      '/assets/aistudio',
      express.static(publicMediaDir, {
        maxAge: '7d',
        etag: true,
        lastModified: true,
      })
    );
  }

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const distHashedAssets = path.join(distDir, 'assets');
    if (fs.existsSync(distHashedAssets)) {
      app.use(
        '/assets',
        express.static(distHashedAssets, {
          maxAge: '1y',
          immutable: true,
        })
      );
    }
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        setHeaders(res, filePath) {
          if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      })
    );
    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Hoa Nelly server running at http://0.0.0.0:${port}`);
  });

  const shutdown = () => {
    server.close(() => {
      try {
        db.close();
      } catch {
        // Ignore if already closed
      }
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
