export type PricingType = 'fixed' | 'from' | 'quote';
export type AvailabilityStatus = 'in_stock' | 'made_to_order' | 'paused';
export type OrderStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'in_production'
  | 'delivering'
  | 'completed'
  | 'cancelled';
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'deposit_paid' | 'paid';
export type InquiryStatus = 'new' | 'consulting' | 'quoted' | 'confirmed' | 'completed' | 'cancelled';
export type AdminRole = 'owner' | 'manager' | 'staff';

export interface Category {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_url: string;
  sort_order: number;
}

export interface ProductVariant {
  id: string;
  group: 'size' | 'color' | 'style' | 'theme';
  label: string;
  color_hex?: string;
  price_delta: number;
  image_url?: string;
  in_stock: boolean;
}

export interface ProductAddon {
  id: string;
  label: string;
  price: number;
  description?: string;
}

export interface ProductPersonalizationConfig {
  allow_card_message: boolean;
  allow_custom_text: boolean;
  custom_text_surcharge: number;
  allow_reference_image: boolean;
  allow_note: boolean;
  allow_theme_input: boolean;
}

export interface ProductSpecs {
  components: string;
  dimensions: string;
  materials: string;
  included_accessories: string;
  customizable_parts: string;
  care_guide: string;
  prep_time: string;
  delivery_notes: string;
  store_notes: string;
}

export interface Product {
  id: number;
  sku: string;
  slug: string;
  name: string;
  category_slug: string;
  category_name?: string;
  occasions: string[];
  colors: string[];
  pricing_type: PricingType;
  base_price: number | null;
  original_price: number | null;
  availability_status: AvailabilityStatus;
  prep_hours: number;
  short_description: string;
  images: string[];
  video_url?: string | null;
  variants: ProductVariant[];
  addons: ProductAddon[];
  personalization: ProductPersonalizationConfig;
  specs: ProductSpecs;
  is_featured: boolean;
  is_active: boolean;
  is_demo_sample: boolean;
  rating_avg: number;
  review_count: number;
  created_at: string;
}

export interface CartItem {
  cart_key: string;
  product_id: number;
  product_slug: string;
  product_name: string;
  product_sku: string;
  product_image: string;
  pricing_type: PricingType;
  base_price: number;
  quantity: number;
  selected_variants: Record<string, { id: string; label: string; price_delta: number }>;
  selected_addons: { id: string; label: string; price: number }[];
  personalization: {
    card_message?: string;
    custom_text?: string;
    theme_input?: string;
    note?: string;
    reference_image_url?: string;
    requires_custom_quote?: boolean;
  };
  unit_price: number;
  surcharge_total: number;
  line_total: number;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  product_slug: string;
  product_name: string;
  product_sku: string;
  product_image: string;
  quantity: number;
  unit_price: number;
  surcharge_total: number;
  line_total: number;
  selected_variants: Record<string, { id: string; label: string; price_delta: number }>;
  selected_addons: { id: string; label: string; price: number }[];
  personalization: Record<string, unknown>;
  review_token?: string;
  has_review?: boolean;
}

export interface Order {
  id: number;
  order_code: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_method: 'delivery' | 'pickup';
  delivery_address: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  desired_date: string;
  desired_time_slot: string;
  schedule_confirmed: boolean;
  hide_price_for_recipient: boolean;
  customer_note: string | null;
  subtotal: number;
  surcharge_total: number;
  shipping_fee: number | null;
  shipping_fee_status: 'confirmed' | 'pending_confirmation';
  discount_code: string | null;
  discount_amount: number;
  total_amount: number;
  deposit_required: number | null;
  deposit_paid_amount: number;
  has_custom_quote_items: boolean;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface ReviewReply {
  id: number;
  review_id: number;
  staff_name: string;
  content: string;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
}

export interface ProductReview {
  id: number;
  product_id: number;
  product_name?: string;
  product_slug?: string;
  order_item_id: number;
  display_name: string;
  rating: number;
  comment: string;
  images: string[];
  variant_summary: string;
  verified_purchase: boolean;
  status: 'published' | 'flagged' | 'hidden_policy';
  moderation_reason?: string | null;
  created_at: string;
  updated_at: string;
  is_edited: boolean;
  reply?: ReviewReply | null;
}

export interface ProductQuestion {
  id: number;
  product_id: number;
  product_name?: string;
  product_slug?: string;
  asker_name: string;
  question: string;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
  status: 'published' | 'hidden';
  created_at: string;
}

export interface CustomRequest {
  id: number;
  reference_code: string;
  product_type: string;
  occasion: string;
  colors: string;
  theme_character: string;
  desired_size: string;
  personalization_text: string;
  budget: string;
  needed_date: string;
  reference_images: string[];
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_note: string;
  status: InquiryStatus;
  quoted_price: number | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventQuote {
  id: number;
  reference_code: string;
  event_type: string;
  event_date: string;
  event_time: string;
  location: string;
  venue_setting: 'indoor' | 'outdoor' | 'both';
  scale_area: string;
  style_colors: string;
  desired_items: string[];
  budget: string;
  reference_images: string[];
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_note: string;
  status: InquiryStatus;
  quoted_price: number | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContactMessage {
  id: number;
  reference_code: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  subject: string;
  message: string;
  status: 'new' | 'replied' | 'closed';
  admin_note: string | null;
  created_at: string;
}

export interface GalleryItem {
  id: number;
  title: string;
  category: string;
  image_type: 'sample_product' | 'reference_idea' | 'completed_project';
  image_url: string;
  caption: string;
  sort_order: number;
  is_active: boolean;
}

export interface PaymentMethodConfig {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  requires_confirmation: boolean;
}

export interface PromoCode {
  id: number;
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_value: number;
  min_order_amount: number;
  is_active: boolean;
  expires_at: string | null;
}

export interface StoreSettings {
  brand_name: string;
  brand_tagline: string;
  hero_title: string;
  hero_subtitle: string;
  hero_image_url: string;
  hero_secondary_image_url: string;
  hero_bg_video_url?: string;
  announcement_enabled: boolean;
  announcement_text: string;
  phone: string;
  zalo_url: string;
  email: string;
  address: string;
  business_hours: string;
  delivery_area: string;
  map_embed_url: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  business_entity_info: string;
  shipping_fee_mode: 'pending_confirmation' | 'flat_rate';
  flat_shipping_fee: number | null;
  free_shipping_threshold: number | null;
  deposit_policy_enabled: boolean;
  deposit_percent: number;
  deposit_note: string;
  daily_order_capacity: number;
  default_prep_hours: number;
  supports_pickup: boolean;
  supports_hide_price_gift: boolean;
  payment_methods: PaymentMethodConfig[];
  policies: Record<string, { title: string; confirmed: boolean; content: string }>;
  faqs: { id: string; question: string; answer: string; confirmed: boolean }[];
}

export interface AdminUser {
  id: number;
  email: string;
  full_name: string;
  role: AdminRole;
  permissions: string[];
  is_active: boolean;
  created_at: string;
}

export interface AdminPeriodBucket {
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
  reviews_avg_rating: number;
}

export interface AdminDashboardSummary {
  total_orders: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  paid_revenue: number;
  completed_revenue: number;
  gross_revenue: number;
  custom_requests_total: number;
  open_custom_requests: number;
  event_quotes_total: number;
  open_event_quotes: number;
  quoted_confirmed_value: number;
  contact_messages_total: number;
  open_contact_messages: number;
  published_reviews: number;
  average_rating: number;
  questions_total: number;
  unanswered_questions: number;
  products_total: number;
  products_active: number;
  products_demo: number;
}

export interface AdminDashboardAnalytics extends AdminDashboardSummary {
  granularity: 'week' | 'month';
  selected_period: string;
  summary: AdminDashboardSummary;
  buckets: AdminPeriodBucket[];
}

