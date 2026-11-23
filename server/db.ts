import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import type {
  Category,
  GalleryItem,
  Order,
  OrderItem,
  Product,
  ProductQuestion,
  ProductReview,
  StoreSettings,
} from '../shared/types.ts';
import {
  DEFAULT_STORE_SETTINGS,
  SEED_CATEGORIES,
  SEED_GALLERY,
  SEED_PRODUCTS,
} from './seedData.ts';
import { seedDemoActivity } from './seedDemoActivity.ts';

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './data/hoanelly.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category_slug TEXT NOT NULL,
      occasions_json TEXT NOT NULL DEFAULT '[]',
      colors_json TEXT NOT NULL DEFAULT '[]',
      pricing_type TEXT NOT NULL DEFAULT 'fixed',
      base_price INTEGER,
      original_price INTEGER,
      availability_status TEXT NOT NULL DEFAULT 'made_to_order',
      prep_hours INTEGER NOT NULL DEFAULT 12,
      short_description TEXT NOT NULL DEFAULT '',
      images_json TEXT NOT NULL DEFAULT '[]',
      video_url TEXT,
      variants_json TEXT NOT NULL DEFAULT '[]',
      addons_json TEXT NOT NULL DEFAULT '[]',
      personalization_json TEXT NOT NULL DEFAULT '{}',
      specs_json TEXT NOT NULL DEFAULT '{}',
      is_featured INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      is_demo_sample INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE,
      order_code TEXT NOT NULL UNIQUE,
      lookup_token TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_confirmation',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      delivery_method TEXT NOT NULL DEFAULT 'delivery',
      delivery_address TEXT,
      recipient_name TEXT,
      recipient_phone TEXT,
      desired_date TEXT NOT NULL,
      desired_time_slot TEXT NOT NULL,
      schedule_confirmed INTEGER NOT NULL DEFAULT 0,
      hide_price_for_recipient INTEGER NOT NULL DEFAULT 0,
      customer_note TEXT,
      subtotal INTEGER NOT NULL DEFAULT 0,
      surcharge_total INTEGER NOT NULL DEFAULT 0,
      shipping_fee INTEGER,
      shipping_fee_status TEXT NOT NULL DEFAULT 'pending_confirmation',
      discount_code TEXT,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      deposit_required INTEGER,
      deposit_paid_amount INTEGER NOT NULL DEFAULT 0,
      has_custom_quote_items INTEGER NOT NULL DEFAULT 0,
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_slug TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      product_image TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price INTEGER NOT NULL DEFAULT 0,
      surcharge_total INTEGER NOT NULL DEFAULT 0,
      line_total INTEGER NOT NULL DEFAULT 0,
      selected_variants_json TEXT NOT NULL DEFAULT '{}',
      selected_addons_json TEXT NOT NULL DEFAULT '[]',
      personalization_json TEXT NOT NULL DEFAULT '{}',
      review_token TEXT NOT NULL UNIQUE,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      order_item_id INTEGER NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      images_json TEXT NOT NULL DEFAULT '[]',
      variant_summary TEXT NOT NULL DEFAULT '',
      verified_purchase INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'published',
      moderation_reason TEXT,
      is_edited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS review_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id INTEGER NOT NULL UNIQUE,
      staff_name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_edited INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS product_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      asker_name TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT,
      answered_by TEXT,
      answered_at TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS custom_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE,
      reference_code TEXT NOT NULL UNIQUE,
      product_type TEXT NOT NULL,
      occasion TEXT NOT NULL,
      colors TEXT NOT NULL DEFAULT '',
      theme_character TEXT NOT NULL DEFAULT '',
      desired_size TEXT NOT NULL DEFAULT '',
      personalization_text TEXT NOT NULL DEFAULT '',
      budget TEXT NOT NULL DEFAULT '',
      needed_date TEXT NOT NULL DEFAULT '',
      reference_images_json TEXT NOT NULL DEFAULT '[]',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      customer_note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      quoted_price INTEGER,
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS event_quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT UNIQUE,
      reference_code TEXT NOT NULL UNIQUE,
      event_type TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL,
      venue_setting TEXT NOT NULL DEFAULT 'indoor',
      scale_area TEXT NOT NULL DEFAULT '',
      style_colors TEXT NOT NULL DEFAULT '',
      desired_items_json TEXT NOT NULL DEFAULT '[]',
      budget TEXT NOT NULL DEFAULT '',
      reference_images_json TEXT NOT NULL DEFAULT '[]',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      customer_note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'new',
      quoted_price INTEGER,
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_code TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL DEFAULT '',
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      admin_note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      image_type TEXT NOT NULL DEFAULT 'sample_product',
      image_url TEXT NOT NULL,
      caption TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS promo_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      discount_type TEXT NOT NULL DEFAULT 'fixed',
      discount_value INTEGER NOT NULL DEFAULT 0,
      min_order_amount INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS store_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      permissions_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_user_id) REFERENCES admin_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_reviews_product_status ON reviews(product_id, status);
    CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
    CREATE INDEX IF NOT EXISTS idx_questions_product_status ON product_questions(product_id, status);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const catCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  if (catCount === 0) {
    const insertCat = db.prepare(
      'INSERT INTO categories (slug, name, description, image_url, sort_order) VALUES (?, ?, ?, ?, ?)'
    );
    for (const c of SEED_CATEGORIES) {
      insertCat.run(c.slug, c.name, c.description, c.image_url, c.sort_order);
    }
  }

  const findProdBySku = db.prepare('SELECT id, is_demo_sample, images_json FROM products WHERE sku = ?');
  const insertProd = db.prepare(`
    INSERT INTO products (
      sku, slug, name, category_slug, occasions_json, colors_json,
      pricing_type, base_price, original_price, availability_status, prep_hours,
      short_description, images_json, video_url, variants_json, addons_json,
      personalization_json, specs_json, is_featured, is_active, is_demo_sample
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateDemoProdImages = db.prepare('UPDATE products SET images_json = ? WHERE id = ?');

  for (const p of SEED_PRODUCTS) {
    const existing = findProdBySku.get(p.sku) as
      | { id: number; is_demo_sample: number; images_json: string }
      | undefined;
    const nextImagesJson = JSON.stringify(p.images);
    if (!existing) {
      insertProd.run(
        p.sku,
        p.slug,
        p.name,
        p.category_slug,
        JSON.stringify(p.occasions),
        JSON.stringify(p.colors),
        p.pricing_type,
        p.base_price,
        p.original_price,
        p.availability_status,
        p.prep_hours,
        p.short_description,
        nextImagesJson,
        p.video_url || null,
        JSON.stringify(p.variants),
        JSON.stringify(p.addons),
        JSON.stringify(p.personalization),
        JSON.stringify(p.specs),
        p.is_featured ? 1 : 0,
        p.is_active ? 1 : 0,
        p.is_demo_sample ? 1 : 0
      );
    } else if (existing.is_demo_sample === 1 && existing.images_json !== nextImagesJson) {
      updateDemoProdImages.run(nextImagesJson, existing.id);
    }
  }

  const findGalByUrl = db.prepare('SELECT id FROM gallery_items WHERE image_url = ?');
  const insertGal = db.prepare(
    'INSERT INTO gallery_items (title, category, image_type, image_url, caption, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  for (const g of SEED_GALLERY) {
    const existingGal = findGalByUrl.get(g.image_url);
    if (!existingGal) {
      insertGal.run(g.title, g.category, g.image_type, g.image_url, g.caption, g.sort_order, g.is_active ? 1 : 0);
    }
  }

  const settingsRow = db.prepare('SELECT id FROM store_settings WHERE id = 1').get();
  if (!settingsRow) {
    db.prepare('INSERT INTO store_settings (id, data_json) VALUES (1, ?)').run(
      JSON.stringify(DEFAULT_STORE_SETTINGS)
    );
  }

  // Ensure any previously seeded em-dashes are normalized to standard hyphens
  db.prepare("UPDATE gallery_items SET caption = REPLACE(caption, '—', '-') WHERE caption LIKE '%—%'").run();
  db.prepare("UPDATE store_settings SET data_json = REPLACE(data_json, '—', '-') WHERE data_json LIKE '%—%'").run();

  // Normalize any legacy preview/demo labels in existing database rows to production copy
  db.prepare('UPDATE products SET is_demo_sample = 0 WHERE is_demo_sample != 0').run();
  const updateProdSpecs = db.prepare('UPDATE products SET specs_json = ? WHERE sku = ?');
  for (const p of SEED_PRODUCTS) {
    const cur = db.prepare('SELECT specs_json FROM products WHERE sku = ?').get(p.sku) as
      | { specs_json: string }
      | undefined;
    if (cur && /mẫu minh họa|bản xem trước|Ảnh minh họa ý tưởng/i.test(cur.specs_json)) {
      updateProdSpecs.run(JSON.stringify(p.specs), p.sku);
    }
  }
  const updateGalCaption = db.prepare('UPDATE gallery_items SET caption = ? WHERE image_url = ?');
  for (const g of SEED_GALLERY) {
    const cur = db.prepare('SELECT caption FROM gallery_items WHERE image_url = ?').get(g.image_url) as
      | { caption: string }
      | undefined;
    if (cur && /mẫu minh họa|ý tưởng minh họa|xem trước/i.test(cur.caption)) {
      updateGalCaption.run(g.caption, g.image_url);
    }
  }
  const savedSettingsRow = db.prepare('SELECT data_json FROM store_settings WHERE id = 1').get() as
    | { data_json: string }
    | undefined;
  if (
    savedSettingsRow &&
    /cần chủ cửa hàng xác nhận|Mẫu minh họa xem trước|đang chờ cửa hàng cập nhật/i.test(savedSettingsRow.data_json)
  ) {
    const parsedSettings = safeParseJson<Partial<StoreSettings>>(savedSettingsRow.data_json, {});
    const cleanedSettings: StoreSettings = {
      ...DEFAULT_STORE_SETTINGS,
      ...parsedSettings,
      policies: DEFAULT_STORE_SETTINGS.policies,
      faqs: DEFAULT_STORE_SETTINGS.faqs,
    };
    db.prepare('UPDATE store_settings SET data_json = ? WHERE id = 1').run(JSON.stringify(cleanedSettings));
  }
  db.prepare(
    "UPDATE event_quotes SET admin_note = REPLACE(admin_note, 'phương án demo', 'phương án phối màu') WHERE admin_note LIKE '%phương án demo%'"
  ).run();
  db.prepare(
    "UPDATE products SET variants_json = REPLACE(variants_json, '(như ảnh minh họa)', '(như ảnh)') WHERE variants_json LIKE '%như ảnh minh họa%'"
  ).run();

  // Seed realistic 12-month sales history, verified reviews, 100% answered Q&As, and consultations
  seedDemoActivity(db);
}

function safeParseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getStoreSettings(): StoreSettings {
  const row = db.prepare('SELECT data_json FROM store_settings WHERE id = 1').get() as
    | { data_json: string }
    | undefined;
  const saved = safeParseJson<Partial<StoreSettings>>(row?.data_json, {});
  return {
    ...DEFAULT_STORE_SETTINGS,
    ...saved,
    policies: {
      ...DEFAULT_STORE_SETTINGS.policies,
      ...(saved.policies || {}),
    },
  };
}

export function saveStoreSettings(settings: StoreSettings): StoreSettings {
  db.prepare('UPDATE store_settings SET data_json = ? WHERE id = 1').run(JSON.stringify(settings));
  return getStoreSettings();
}

export function getCategories(): Category[] {
  return db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, id ASC').all() as Category[];
}

export function hydrateProduct(row: Record<string, unknown>): Product {
  const stats = db
    .prepare(
      `SELECT COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg_rating
       FROM reviews WHERE product_id = ? AND status = 'published'`
    )
    .get(row.id) as { cnt: number; avg_rating: number };

  const cat = db
    .prepare('SELECT name FROM categories WHERE slug = ?')
    .get(row.category_slug) as { name: string } | undefined;

  return {
    id: Number(row.id),
    sku: String(row.sku),
    slug: String(row.slug),
    name: String(row.name),
    category_slug: String(row.category_slug),
    category_name: cat?.name || String(row.category_slug),
    occasions: safeParseJson<string[]>(row.occasions_json as string, []),
    colors: safeParseJson<string[]>(row.colors_json as string, []),
    pricing_type: row.pricing_type as Product['pricing_type'],
    base_price: row.base_price === null ? null : Number(row.base_price),
    original_price: row.original_price === null ? null : Number(row.original_price),
    availability_status: row.availability_status as Product['availability_status'],
    prep_hours: Number(row.prep_hours || 12),
    short_description: String(row.short_description || ''),
    images: safeParseJson<string[]>(row.images_json as string, []),
    video_url: (row.video_url as string) || null,
    variants: safeParseJson(row.variants_json as string, []),
    addons: safeParseJson(row.addons_json as string, []),
    personalization: safeParseJson(row.personalization_json as string, {
      allow_card_message: true,
      allow_custom_text: false,
      custom_text_surcharge: 0,
      allow_reference_image: false,
      allow_note: true,
      allow_theme_input: false,
    }),
    specs: safeParseJson(row.specs_json as string, {
      components: '',
      dimensions: '',
      materials: '',
      included_accessories: '',
      customizable_parts: '',
      care_guide: '',
      prep_time: '',
      delivery_notes: '',
      store_notes: '',
    }),
    is_featured: Boolean(row.is_featured),
    is_active: Boolean(row.is_active),
    is_demo_sample: Boolean(row.is_demo_sample),
    rating_avg: stats.cnt > 0 ? Math.round(stats.avg_rating * 10) / 10 : 0,
    review_count: stats.cnt,
    created_at: String(row.created_at),
  };
}

export function hydrateOrder(row: Record<string, unknown>, includeReviewTokens = false): Order {
  const itemRows = db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC')
    .all(row.id) as Record<string, unknown>[];

  const items: OrderItem[] = itemRows.map((it) => {
    const rev = db.prepare('SELECT id FROM reviews WHERE order_item_id = ?').get(it.id);
    const baseItem: OrderItem = {
      id: Number(it.id),
      order_id: Number(it.order_id),
      product_id: Number(it.product_id),
      product_slug: String(it.product_slug),
      product_name: String(it.product_name),
      product_sku: String(it.product_sku),
      product_image: String(it.product_image || ''),
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      surcharge_total: Number(it.surcharge_total),
      line_total: Number(it.line_total),
      selected_variants: safeParseJson(it.selected_variants_json as string, {}),
      selected_addons: safeParseJson(it.selected_addons_json as string, []),
      personalization: safeParseJson(it.personalization_json as string, {}),
      has_review: Boolean(rev),
    };
    if (includeReviewTokens) {
      baseItem.review_token = String(it.review_token);
    }
    return baseItem;
  });

  return {
    id: Number(row.id),
    order_code: String(row.order_code),
    status: row.status as Order['status'],
    payment_status: row.payment_status as Order['payment_status'],
    payment_method: String(row.payment_method),
    customer_name: String(row.customer_name),
    customer_phone: String(row.customer_phone),
    customer_email: (row.customer_email as string) || null,
    delivery_method: row.delivery_method as Order['delivery_method'],
    delivery_address: (row.delivery_address as string) || null,
    recipient_name: (row.recipient_name as string) || null,
    recipient_phone: (row.recipient_phone as string) || null,
    desired_date: String(row.desired_date),
    desired_time_slot: String(row.desired_time_slot),
    schedule_confirmed: Boolean(row.schedule_confirmed),
    hide_price_for_recipient: Boolean(row.hide_price_for_recipient),
    customer_note: (row.customer_note as string) || null,
    subtotal: Number(row.subtotal),
    surcharge_total: Number(row.surcharge_total),
    shipping_fee: row.shipping_fee === null ? null : Number(row.shipping_fee),
    shipping_fee_status: row.shipping_fee_status as Order['shipping_fee_status'],
    discount_code: (row.discount_code as string) || null,
    discount_amount: Number(row.discount_amount || 0),
    total_amount: Number(row.total_amount),
    deposit_required: row.deposit_required === null ? null : Number(row.deposit_required),
    deposit_paid_amount: Number(row.deposit_paid_amount || 0),
    has_custom_quote_items: Boolean(row.has_custom_quote_items),
    admin_note: (row.admin_note as string) || null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    items,
  };
}

export function hydrateReview(row: Record<string, unknown>): ProductReview {
  const replyRow = db
    .prepare('SELECT * FROM review_replies WHERE review_id = ?')
    .get(row.id) as Record<string, unknown> | undefined;

  return {
    id: Number(row.id),
    product_id: Number(row.product_id),
    product_name: row.product_name ? String(row.product_name) : undefined,
    product_slug: row.product_slug ? String(row.product_slug) : undefined,
    order_item_id: Number(row.order_item_id),
    display_name: String(row.display_name),
    rating: Number(row.rating),
    comment: String(row.comment),
    images: safeParseJson<string[]>(row.images_json as string, []),
    variant_summary: String(row.variant_summary || ''),
    verified_purchase: Boolean(row.verified_purchase),
    status: row.status as ProductReview['status'],
    moderation_reason: (row.moderation_reason as string) || null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    is_edited: Boolean(row.is_edited),
    reply: replyRow
      ? {
          id: Number(replyRow.id),
          review_id: Number(replyRow.review_id),
          staff_name: String(replyRow.staff_name),
          content: String(replyRow.content),
          created_at: String(replyRow.created_at),
          updated_at: String(replyRow.updated_at),
          is_edited: Boolean(replyRow.is_edited),
        }
      : null,
  };
}

export function hydrateQuestion(row: Record<string, unknown>): ProductQuestion {
  return {
    id: Number(row.id),
    product_id: Number(row.product_id),
    product_name: row.product_name ? String(row.product_name) : undefined,
    product_slug: row.product_slug ? String(row.product_slug) : undefined,
    asker_name: String(row.asker_name),
    question: String(row.question),
    answer: (row.answer as string) || null,
    answered_by: (row.answered_by as string) || null,
    answered_at: (row.answered_at as string) || null,
    status: row.status as ProductQuestion['status'],
    created_at: String(row.created_at),
  };
}

export function hydrateProductsBatch(rows: Record<string, unknown>[]): Product[] {
  if (rows.length === 0) return [];
  const catRows = db.prepare('SELECT slug, name FROM categories').all() as { slug: string; name: string }[];
  const catMap = new Map(catRows.map((c) => [c.slug, c.name]));
  const statRows = db
    .prepare(
      `SELECT product_id, COUNT(*) as cnt, COALESCE(AVG(rating), 0) as avg_rating
       FROM reviews WHERE status = 'published' GROUP BY product_id`
    )
    .all() as { product_id: number; cnt: number; avg_rating: number }[];
  const statMap = new Map(statRows.map((s) => [Number(s.product_id), s]));

  return rows.map((row) => {
    const id = Number(row.id);
    const stats = statMap.get(id);
    const cnt = stats ? Number(stats.cnt) : 0;
    const avg = stats && cnt > 0 ? Math.round(Number(stats.avg_rating) * 10) / 10 : 0;
    return {
      id,
      sku: String(row.sku),
      slug: String(row.slug),
      name: String(row.name),
      category_slug: String(row.category_slug),
      category_name: catMap.get(String(row.category_slug)) || String(row.category_slug),
      occasions: safeParseJson<string[]>(row.occasions_json as string, []),
      colors: safeParseJson<string[]>(row.colors_json as string, []),
      pricing_type: row.pricing_type as Product['pricing_type'],
      base_price: row.base_price === null ? null : Number(row.base_price),
      original_price: row.original_price === null ? null : Number(row.original_price),
      availability_status: row.availability_status as Product['availability_status'],
      prep_hours: Number(row.prep_hours || 12),
      short_description: String(row.short_description || ''),
      images: safeParseJson<string[]>(row.images_json as string, []),
      video_url: (row.video_url as string) || null,
      variants: safeParseJson(row.variants_json as string, []),
      addons: safeParseJson(row.addons_json as string, []),
      personalization: safeParseJson(row.personalization_json as string, {
        allow_card_message: true,
        allow_custom_text: false,
        custom_text_surcharge: 0,
        allow_reference_image: false,
        allow_note: true,
        allow_theme_input: false,
      }),
      specs: safeParseJson(row.specs_json as string, {
        components: '',
        dimensions: '',
        materials: '',
        included_accessories: '',
        customizable_parts: '',
        care_guide: '',
        prep_time: '',
        delivery_notes: '',
        store_notes: '',
      }),
      is_featured: Boolean(row.is_featured),
      is_active: Boolean(row.is_active),
      is_demo_sample: Boolean(row.is_demo_sample),
      rating_avg: avg,
      review_count: cnt,
      created_at: String(row.created_at),
    };
  });
}

export function hydrateOrdersBatch(rows: Record<string, unknown>[], includeReviewTokens = false): Order[] {
  if (rows.length === 0) return [];
  const allItems = db.prepare('SELECT * FROM order_items ORDER BY id ASC').all() as Record<string, unknown>[];
  const reviewedItemRows = db.prepare('SELECT order_item_id FROM reviews').all() as { order_item_id: number }[];
  const reviewedSet = new Set(reviewedItemRows.map((r) => Number(r.order_item_id)));

  const itemsByOrder = new Map<number, OrderItem[]>();
  for (const it of allItems) {
    const oid = Number(it.order_id);
    const baseItem: OrderItem = {
      id: Number(it.id),
      order_id: oid,
      product_id: Number(it.product_id),
      product_slug: String(it.product_slug),
      product_name: String(it.product_name),
      product_sku: String(it.product_sku),
      product_image: String(it.product_image || ''),
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      surcharge_total: Number(it.surcharge_total),
      line_total: Number(it.line_total),
      selected_variants: safeParseJson(it.selected_variants_json as string, {}),
      selected_addons: safeParseJson(it.selected_addons_json as string, []),
      personalization: safeParseJson(it.personalization_json as string, {}),
      has_review: reviewedSet.has(Number(it.id)),
    };
    if (includeReviewTokens) {
      baseItem.review_token = String(it.review_token);
    }
    const list = itemsByOrder.get(oid);
    if (list) list.push(baseItem);
    else itemsByOrder.set(oid, [baseItem]);
  }

  return rows.map((row) => ({
    id: Number(row.id),
    order_code: String(row.order_code),
    status: row.status as Order['status'],
    payment_status: row.payment_status as Order['payment_status'],
    payment_method: String(row.payment_method),
    customer_name: String(row.customer_name),
    customer_phone: String(row.customer_phone),
    customer_email: (row.customer_email as string) || null,
    delivery_method: row.delivery_method as Order['delivery_method'],
    delivery_address: (row.delivery_address as string) || null,
    recipient_name: (row.recipient_name as string) || null,
    recipient_phone: (row.recipient_phone as string) || null,
    desired_date: String(row.desired_date),
    desired_time_slot: String(row.desired_time_slot),
    schedule_confirmed: Boolean(row.schedule_confirmed),
    hide_price_for_recipient: Boolean(row.hide_price_for_recipient),
    customer_note: (row.customer_note as string) || null,
    subtotal: Number(row.subtotal),
    surcharge_total: Number(row.surcharge_total),
    shipping_fee: row.shipping_fee === null ? null : Number(row.shipping_fee),
    shipping_fee_status: row.shipping_fee_status as Order['shipping_fee_status'],
    discount_code: (row.discount_code as string) || null,
    discount_amount: Number(row.discount_amount || 0),
    total_amount: Number(row.total_amount),
    deposit_required: row.deposit_required === null ? null : Number(row.deposit_required),
    deposit_paid_amount: Number(row.deposit_paid_amount || 0),
    has_custom_quote_items: Boolean(row.has_custom_quote_items),
    admin_note: (row.admin_note as string) || null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    items: itemsByOrder.get(Number(row.id)) || [],
  }));
}

export function hydrateReviewsBatch(rows: Record<string, unknown>[]): ProductReview[] {
  if (rows.length === 0) return [];
  const replyRows = db.prepare('SELECT * FROM review_replies').all() as Record<string, unknown>[];
  const replyByReviewId = new Map<number, Record<string, unknown>>(
    replyRows.map((r) => [Number(r.review_id), r])
  );

  return rows.map((row) => {
    const id = Number(row.id);
    const replyRow = replyByReviewId.get(id);
    return {
      id,
      product_id: Number(row.product_id),
      product_name: row.product_name ? String(row.product_name) : undefined,
      product_slug: row.product_slug ? String(row.product_slug) : undefined,
      order_item_id: Number(row.order_item_id),
      display_name: String(row.display_name),
      rating: Number(row.rating),
      comment: String(row.comment),
      images: safeParseJson<string[]>(row.images_json as string, []),
      variant_summary: String(row.variant_summary || ''),
      verified_purchase: Boolean(row.verified_purchase),
      status: row.status as ProductReview['status'],
      moderation_reason: (row.moderation_reason as string) || null,
      created_at: String(row.created_at),
      updated_at: String(row.updated_at),
      is_edited: Boolean(row.is_edited),
      reply: replyRow
        ? {
            id: Number(replyRow.id),
            review_id: Number(replyRow.review_id),
            staff_name: String(replyRow.staff_name),
            content: String(replyRow.content),
            created_at: String(replyRow.created_at),
            updated_at: String(replyRow.updated_at),
            is_edited: Boolean(replyRow.is_edited),
          }
        : null,
    };
  });
}

export function hydrateGallery(row: Record<string, unknown>): GalleryItem {
  return {
    id: Number(row.id),
    title: String(row.title),
    category: String(row.category),
    image_type: row.image_type as GalleryItem['image_type'],
    image_url: String(row.image_url),
    caption: String(row.caption || ''),
    sort_order: Number(row.sort_order || 0),
    is_active: Boolean(row.is_active),
  };
}
