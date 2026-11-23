import { useEffect } from 'react';
import { parseJsonResponse } from './api.ts';
import type {
  AvailabilityStatus,
  InquiryStatus,
  OrderStatus,
  PaymentStatus,
  Product,
} from '../../shared/types.ts';

export function getLocalDateIso(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatVnd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'Liên hệ báo giá';
  }
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`;
}

export function formatProductPrice(product: Pick<Product, 'pricing_type' | 'base_price'>): string {
  if (product.pricing_type === 'quote' || product.base_price === null) {
    return 'Liên hệ báo giá';
  }
  if (product.pricing_type === 'from') {
    return `Từ ${formatVnd(product.base_price)}`;
  }
  return formatVnd(product.base_price);
}

export function formatDateVi(isoOrSqlite: string | null | undefined): string {
  if (!isoOrSqlite) return '';
  const normalized = isoOrSqlite.includes('T')
    ? isoOrSqlite
    : isoOrSqlite.replace(' ', 'T') + (isoOrSqlite.length <= 10 ? '' : 'Z');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return isoOrSqlite;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTimeVi(isoOrSqlite: string | null | undefined): string {
  if (!isoOrSqlite) return '';
  const normalized = isoOrSqlite.includes('T')
    ? isoOrSqlite
    : isoOrSqlite.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return isoOrSqlite;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  in_stock: 'Nhận làm trong ngày',
  made_to_order: 'Nhận đặt làm thủ công',
  paused: 'Tạm ngừng nhận đặt',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_confirmation: 'Chờ cửa hàng xác nhận',
  confirmed: 'Đã xác nhận đơn',
  in_production: 'Đang tạo hình sản phẩm',
  delivering: 'Đang giao hàng',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Chưa thanh toán',
  pending_verification: 'Chờ đối soát thanh toán',
  deposit_paid: 'Đã nhận đặt cọc',
  paid: 'Đã thanh toán',
};

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'Mới tiếp nhận',
  consulting: 'Đang tư vấn',
  quoted: 'Đã gửi báo giá',
  confirmed: 'Đã chốt phương án',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export const GALLERY_TYPE_LABELS: Record<string, string> = {
  sample_product: 'Sản phẩm tiêu biểu',
  reference_idea: 'Ảnh ý tưởng tham khảo',
  completed_project: 'Dự án đã thực hiện',
};

export const CONTACT_STATUS_LABELS: Record<'new' | 'replied' | 'closed', string> = {
  new: 'Mới tiếp nhận',
  replied: 'Đã phản hồi',
  closed: 'Đã đóng',
};

export const VENUE_SETTING_LABELS: Record<'indoor' | 'outdoor' | 'both', string> = {
  indoor: 'Trong nhà',
  outdoor: 'Ngoài trời',
  both: 'Kết hợp trong nhà & ngoài trời',
};

const PAYMENT_METHOD_MAP: Record<string, string> = {
  confirm_then_transfer: 'Đặt hàng trước – Chuyển khoản sau khi cửa hàng xác nhận',
  cod_upon_confirm: 'Thanh toán khi nhận hàng (sau khi cửa hàng xác nhận)',
  bank_transfer: 'Chuyển khoản ngân hàng',
  cod: 'Thanh toán khi nhận hàng (COD)',
  store_pickup: 'Thanh toán khi nhận tại cửa hàng',
  momo: 'Ví điện tử MoMo',
  zalopay: 'Ví điện tử ZaloPay',
  deposit_transfer: 'Chuyển khoản đặt cọc',
};

export function getPaymentMethodLabel(method: string | null | undefined): string {
  if (!method) return 'Chưa chọn';
  return PAYMENT_METHOD_MAP[method] || method;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getVnPeriodKey(
  isoOrSqlite: string | null | undefined,
  granularity: 'week' | 'month'
): string {
  if (!isoOrSqlite) return '';
  const s = isoOrSqlite.trim();
  const normalized = s.includes('T') ? s : s.replace(' ', 'T');
  const withZone = /([Zz]|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const parsed = new Date(withZone);
  if (Number.isNaN(parsed.getTime())) return '';

  const vn = new Date(parsed.getTime() + VN_OFFSET_MS);
  if (granularity === 'month') {
    return `${vn.getUTCFullYear()}-${String(vn.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  const monday = new Date(d.getTime());
  monday.setUTCDate(d.getUTCDate() - (dayNum - 1));
  const thursday = new Date(monday.getTime());
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const isoYear = thursday.getUTCFullYear();
  const jan1 = new Date(Date.UTC(isoYear, 0, 1));
  const weekNum = Math.ceil(((thursday.getTime() - jan1.getTime()) / 86400000 + 1) / 7);
  return `${isoYear}-W${String(weekNum).padStart(2, '0')}`;
}

export interface UploadImageStat {
  url: string;
  originalBytes: number;
  optimizedBytes: number;
  width: number;
  height: number;
}

export async function uploadImagesWithStats(
  files: FileList | File[]
): Promise<{ urls: string[]; stats: UploadImageStat[] }> {
  const arr = Array.from(files);
  if (arr.length === 0) return { urls: [], stats: [] };
  if (arr.length > 4) {
    throw new Error('Bạn chỉ có thể tải lên tối đa 4 ảnh.');
  }
  for (const f of arr) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      throw new Error(`Ảnh "${f.name}" không đúng định dạng JPG, PNG hoặc WebP.`);
    }
    if (f.size > 5 * 1024 * 1024) {
      throw new Error(`Ảnh "${f.name}" vượt quá dung lượng tối đa 5MB.`);
    }
  }
  const fd = new FormData();
  for (const f of arr) fd.append('files', f);

  const res = await fetch('/api/uploads', { method: 'POST', body: fd });
  const data = await parseJsonResponse<{
    urls?: string[];
    stats?: UploadImageStat[];
  }>(res, 'Không thể tải ảnh lên.');
  return { urls: data.urls || [], stats: data.stats || [] };
}

export async function uploadImages(files: FileList | File[]): Promise<string[]> {
  const result = await uploadImagesWithStats(files);
  return result.urls;
}

export function usePageMeta(
  title: string,
  description?: string,
  jsonLd?: Record<string, unknown> | null
): void {
  useEffect(() => {
    document.title = title;
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', description);
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', title);
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', description);
    }

    const scriptId = 'hoanelly-page-jsonld';
    const existing = document.getElementById(scriptId);
    if (existing) existing.remove();

    if (jsonLd) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [title, description, jsonLd]);
}
