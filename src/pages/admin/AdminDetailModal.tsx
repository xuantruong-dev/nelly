import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Check,
  Copy,
  CreditCard,
  Gift,
  Image as ImageIcon,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Palette,
  Phone,
  Save,
  ShoppingBag,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import type {
  ContactMessage,
  CustomRequest,
  EventQuote,
  InquiryStatus,
  Order,
  OrderStatus,
  PaymentStatus,
} from '../../../shared/types.ts';
import {
  CONTACT_STATUS_LABELS,
  INQUIRY_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  VENUE_SETTING_LABELS,
  formatDateTimeVi,
  formatVnd,
  getPaymentMethodLabel,
} from '../../lib/format.ts';
import { SafeImage } from '../../components/SafeImage.tsx';
import { useOverlayLock } from '../../hooks/useOverlayLock.ts';

export type AdminDetailRecord =
  | { type: 'order'; data: Order }
  | { type: 'custom_request'; data: CustomRequest }
  | { type: 'event_quote'; data: EventQuote }
  | { type: 'contact'; data: ContactMessage };

interface AdminDetailModalProps {
  record: AdminDetailRecord | null;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
  onUpdateOrder: (
    orderId: number,
    patch: {
      status?: OrderStatus;
      payment_status?: PaymentStatus;
      shipping_fee?: number | null;
      schedule_confirmed?: boolean;
      admin_note?: string;
    }
  ) => Promise<void>;
  onUpdateCustomReq: (
    id: number,
    patch: { status?: InquiryStatus; quoted_price?: number | null; admin_note?: string }
  ) => Promise<void>;
  onUpdateEventQuote: (
    id: number,
    patch: { status?: InquiryStatus; quoted_price?: number | null; admin_note?: string }
  ) => Promise<void>;
  onUpdateContact: (
    id: number,
    patch: { status?: 'new' | 'replied' | 'closed'; admin_note?: string }
  ) => Promise<void>;
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 py-1.5 border-b border-[#EFECE4]/60 last:border-b-0 text-xs">
      <span className="text-[#5C6F80] shrink-0">{label}</span>
      <span
        className={`text-[#14222E] font-medium sm:text-right break-words ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value || '-'}
      </span>
    </div>
  );
}

export function AdminDetailModal({
  record,
  onClose,
  onCopy,
  onUpdateOrder,
  onUpdateCustomReq,
  onUpdateEventQuote,
  onUpdateContact,
}: AdminDetailModalProps) {
  const [saving, setSaving] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const modalPanelRef = useRef<HTMLDivElement>(null);
  const modalCloseBtnRef = useRef<HTMLButtonElement>(null);
  const lightboxCloseBtnRef = useRef<HTMLButtonElement>(null);
  const lastLightboxTriggerRef = useRef<HTMLElement | null>(null);
  const prevLightboxOpenRef = useRef(false);

  useOverlayLock(Boolean(record));
  useOverlayLock(Boolean(lightboxImage));

  // Order editable fields
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('pending_confirmation');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('unpaid');
  const [shippingFeeStr, setShippingFeeStr] = useState('');
  const [scheduleConfirmed, setScheduleConfirmed] = useState(false);
  const [orderAdminNote, setOrderAdminNote] = useState('');

  // Custom / Event editable fields
  const [inquiryStatus, setInquiryStatus] = useState<InquiryStatus>('new');
  const [quotedPriceStr, setQuotedPriceStr] = useState('');
  const [inquiryAdminNote, setInquiryAdminNote] = useState('');

  // Contact editable fields
  const [contactStatus, setContactStatus] = useState<'new' | 'replied' | 'closed'>('new');
  const [contactAdminNote, setContactAdminNote] = useState('');

  // Sync draft state whenever active record changes
  useEffect(() => {
    if (!record) return;
    setLightboxImage(null);
    if (record.type === 'order') {
      setOrderStatus(record.data.status);
      setPaymentStatus(record.data.payment_status);
      setShippingFeeStr(
        record.data.shipping_fee !== null && record.data.shipping_fee !== undefined
          ? String(record.data.shipping_fee)
          : ''
      );
      setScheduleConfirmed(Boolean(record.data.schedule_confirmed));
      setOrderAdminNote(record.data.admin_note || '');
    } else if (record.type === 'custom_request' || record.type === 'event_quote') {
      setInquiryStatus(record.data.status);
      setQuotedPriceStr(
        record.data.quoted_price !== null && record.data.quoted_price !== undefined
          ? String(record.data.quoted_price)
          : ''
      );
      setInquiryAdminNote(record.data.admin_note || '');
    } else if (record.type === 'contact') {
      setContactStatus(record.data.status);
      setContactAdminNote(record.data.admin_note || '');
    }
  }, [record]);

  // Focus management for modal and inner lightbox
  useEffect(() => {
    if (!record) return;
    if (lightboxImage) {
      prevLightboxOpenRef.current = true;
      const id = window.requestAnimationFrame(() => lightboxCloseBtnRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
    if (prevLightboxOpenRef.current) {
      prevLightboxOpenRef.current = false;
      const trigger = lastLightboxTriggerRef.current;
      lastLightboxTriggerRef.current = null;
      const id = window.requestAnimationFrame(() => {
        if (trigger && trigger.isConnected) {
          trigger.focus();
        } else {
          modalCloseBtnRef.current?.focus();
        }
      });
      return () => window.cancelAnimationFrame(id);
    }
    const id = window.requestAnimationFrame(() => modalCloseBtnRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [record, lightboxImage]);

  // Escape key closes lightbox first, then modal; Tab traps focus inside active dialog
  useEffect(() => {
    if (!record) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (lightboxImage) {
          setLightboxImage(null);
        } else {
          onClose();
        }
        return;
      }
      if (e.key === 'Tab') {
        if (lightboxImage) {
          e.preventDefault();
          lightboxCloseBtnRef.current?.focus();
          return;
        }
        const container = modalPanelRef.current;
        if (!container) return;
        const focusables = container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
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
  }, [record, lightboxImage, onClose]);

  if (!record) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (record.type === 'order') {
        const trimmedFee = shippingFeeStr.trim();
        const nextFee = trimmedFee === '' ? null : Math.max(0, Number(trimmedFee));
        await onUpdateOrder(record.data.id, {
          status: orderStatus,
          payment_status: paymentStatus,
          shipping_fee: nextFee !== null && Number.isNaN(nextFee) ? record.data.shipping_fee : nextFee,
          schedule_confirmed: scheduleConfirmed,
          admin_note: orderAdminNote,
        });
      } else if (record.type === 'custom_request') {
        const trimmedQuote = quotedPriceStr.trim();
        const nextQuote = trimmedQuote === '' ? null : Math.max(0, Number(trimmedQuote));
        await onUpdateCustomReq(record.data.id, {
          status: inquiryStatus,
          quoted_price:
            nextQuote !== null && Number.isNaN(nextQuote) ? record.data.quoted_price : nextQuote,
          admin_note: inquiryAdminNote,
        });
      } else if (record.type === 'event_quote') {
        const trimmedQuote = quotedPriceStr.trim();
        const nextQuote = trimmedQuote === '' ? null : Math.max(0, Number(trimmedQuote));
        await onUpdateEventQuote(record.data.id, {
          status: inquiryStatus,
          quoted_price:
            nextQuote !== null && Number.isNaN(nextQuote) ? record.data.quoted_price : nextQuote,
          admin_note: inquiryAdminNote,
        });
      } else if (record.type === 'contact') {
        await onUpdateContact(record.data.id, {
          status: contactStatus,
          admin_note: contactAdminNote,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const headerMeta = (() => {
    if (record.type === 'order') {
      return {
        badge: 'Đơn đặt hàng',
        code: record.data.order_code,
        createdAt: record.data.created_at,
        updatedAt: record.data.updated_at,
        icon: <ShoppingBag className="w-4 h-4 text-[#006A9E]" />,
      };
    }
    if (record.type === 'custom_request') {
      return {
        badge: 'Đặt thiết kế theo yêu cầu',
        code: record.data.reference_code,
        createdAt: record.data.created_at,
        updatedAt: record.data.updated_at,
        icon: <Palette className="w-4 h-4 text-[#D83995]" />,
      };
    }
    if (record.type === 'event_quote') {
      return {
        badge: 'Yêu cầu tư vấn & báo giá sự kiện',
        code: record.data.reference_code,
        createdAt: record.data.created_at,
        updatedAt: record.data.updated_at,
        icon: <Calendar className="w-4 h-4 text-[#006A9E]" />,
      };
    }
    return {
      badge: 'Liên hệ & Cần hỗ trợ',
      code: record.data.reference_code,
      createdAt: record.data.created_at,
      updatedAt: null,
      icon: <MessageSquare className="w-4 h-4 text-[#D83995]" />,
    };
  })();

  const renderCustomerCard = (
    name: string,
    phone: string,
    email: string | null | undefined
  ) => (
    <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-2">
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#EFECE4]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] inline-flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-[#006A9E]" />
          Thông tin khách hàng
        </h3>
        <div className="flex items-center gap-1.5">
          {phone && (
            <>
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs sm:text-[11px] font-semibold"
              >
                <Phone className="w-3.5 h-3.5" /> Gọi ngay
              </a>
              <button
                type="button"
                onClick={() => onCopy(phone, 'số điện thoại')}
                className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[#FDFBF7] border border-[#EFECE4] hover:bg-[#F9E1E8] text-xs sm:text-[11px] font-medium text-[#14222E]"
              >
                <Copy className="w-3.5 h-3.5" /> Copy SĐT
              </button>
            </>
          )}
        </div>
      </div>
      <div className="space-y-0.5">
        <DetailRow label="Họ và tên" value={name} />
        <DetailRow label="Số điện thoại / Zalo" value={phone} mono />
        <DetailRow
          label="Email"
          value={
            email ? (
              <a href={`mailto:${email}`} className="text-[#006A9E] hover:underline inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {email}
              </a>
            ) : (
              'Không cung cấp'
            )
          }
        />
      </div>
    </section>
  );

  const renderReferenceImages = (images: string[], title = 'Ảnh tham khảo khách tải lên') => {
    if (!images || images.length === 0) return null;
    return (
      <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] inline-flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-[#D83995]" />
          {title} ({images.length})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((url, idx) => (
            <button
              key={`${url}-${idx}`}
              type="button"
              onClick={(e) => {
                lastLightboxTriggerRef.current = e.currentTarget;
                setLightboxImage(url);
              }}
              className="group relative rounded-xl overflow-hidden border border-[#EFECE4] bg-[#FDFBF7] aspect-square text-left focus:outline-none focus:ring-2 focus:ring-[#D83995]"
              title="Bấm để phóng to ảnh"
            >
              <SafeImage
                src={url}
                alt={`Ảnh tham khảo ${idx + 1}`}
                preset="card"
                wrapperClassName="w-full h-full"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
              <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#14222E]/75 text-[#FDFBF7] text-[10px] font-medium">
                <ZoomIn className="w-3 h-3" /> Phóng to
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[65] flex items-center justify-center bg-[#14222E]/60 backdrop-blur-[2px] p-3 sm:p-6"
        data-hn-overlay-layer="modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Chi tiết ${headerMeta.badge} ${headerMeta.code}`}
      >
        <div
          ref={modalPanelRef}
          className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-[#DDD4BE] bg-[#FDFBF7] shadow-2xl overflow-hidden"
        >
          {/* Modal Header */}
          <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#EFECE4] bg-[#F8F5EE]/70 shrink-0">
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FDFBF7] border border-[#EFECE4] font-semibold text-[#14222E]">
                  {headerMeta.icon}
                  {headerMeta.badge}
                </span>
                <button
                  type="button"
                  onClick={() => onCopy(headerMeta.code, 'mã tham chiếu')}
                  className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[32px] px-1.5 font-mono font-bold text-[#006A9E] hover:underline"
                  title="Sao chép mã"
                >
                  {headerMeta.code}
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-[#5C6F80] tabular-nums">
                Gửi lúc: <strong className="text-[#14222E]">{formatDateTimeVi(headerMeta.createdAt)}</strong>
                {headerMeta.updatedAt && headerMeta.updatedAt !== headerMeta.createdAt && (
                  <> · Cập nhật: {formatDateTimeVi(headerMeta.updatedAt)}</>
                )}
              </p>
            </div>
            <button
              ref={modalCloseBtnRef}
              type="button"
              onClick={onClose}
              className="w-11 h-11 inline-flex items-center justify-center rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-[#14222E] hover:bg-[#F9E1E8] shrink-0"
              aria-label="Đóng cửa sổ chi tiết"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        {/* Scrollable Modal Body */}
        <div
          data-lenis-prevent
          className="flex-1 overflow-y-auto px-5 py-5 space-y-5"
        >
          {/* ================= ORDER DETAIL ================= */}
          {record.type === 'order' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderCustomerCard(
                  record.data.customer_name,
                  record.data.customer_phone,
                  record.data.customer_email
                )}

                <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] inline-flex items-center gap-1.5 pb-1.5 border-b border-[#EFECE4] w-full">
                    <MapPin className="w-3.5 h-3.5 text-[#006A9E]" />
                    Giao hàng &amp; Lịch hẹn
                  </h3>
                  <div className="space-y-0.5">
                    <DetailRow
                      label="Hình thức nhận"
                      value={
                        record.data.delivery_method === 'pickup'
                          ? 'Khách nhận tại cửa hàng'
                          : 'Giao hàng tận nơi'
                      }
                    />
                    {record.data.delivery_method === 'delivery' && (
                      <DetailRow label="Địa chỉ giao" value={record.data.delivery_address} />
                    )}
                    <DetailRow
                      label="Ngày & khung giờ"
                      value={`${record.data.desired_date} (${record.data.desired_time_slot})`}
                      mono
                    />
                    <DetailRow
                      label="Xác nhận lịch giao"
                      value={
                        record.data.schedule_confirmed ? (
                          <span className="text-[#0B7A53] font-semibold">Đã xác nhận</span>
                        ) : (
                          <span className="text-[#9A5B13]">Chưa xác nhận</span>
                        )
                      }
                    />
                    {(record.data.recipient_name || record.data.recipient_phone) && (
                      <DetailRow
                        label="Người nhận quà"
                        value={`${record.data.recipient_name || '-'}${
                          record.data.recipient_phone ? ` · ${record.data.recipient_phone}` : ''
                        }`}
                      />
                    )}
                  </div>
                </section>
              </div>

              {/* Gift / Customer Note / Custom Quote Banner */}
              {(record.data.hide_price_for_recipient ||
                record.data.has_custom_quote_items ||
                record.data.customer_note) && (
                <section className="rounded-2xl border border-[#E093AB]/70 bg-[#F9E1E8]/55 p-4 space-y-2 text-xs">
                  <h3 className="font-semibold text-[#4A1829] inline-flex items-center gap-1.5">
                    <Gift className="w-3.5 h-3.5 text-[#D83995]" />
                    Lưu ý đặc biệt từ khách hàng
                  </h3>
                  {record.data.hide_price_for_recipient && (
                    <p className="text-[#0B7A53] font-medium">
                      • Quà tặng: Không hiển thị giá tiền trên phiếu gửi người nhận.
                    </p>
                  )}
                  {record.data.has_custom_quote_items && (
                    <p className="text-[#9A5B13] font-medium">
                      • Đơn hàng có yêu cầu chỉnh sửa/phụ phí ngoài bảng giá chuẩn - cần liên hệ xác nhận trước khi làm.
                    </p>
                  )}
                  {record.data.customer_note && (
                    <p className="text-[#14222E] whitespace-pre-wrap">
                      <strong>Ghi chú đơn hàng:</strong> {record.data.customer_note}
                    </p>
                  )}
                </section>
              )}

              {/* Order Items */}
              <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] inline-flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#006A9E]" />
                  Chi tiết sản phẩm trong đơn ({record.data.items.length})
                </h3>
                <div className="space-y-3">
                  {record.data.items.map((it) => {
                    const pers = (it.personalization || {}) as {
                      card_message?: string;
                      custom_text?: string;
                      theme_input?: string;
                      note?: string;
                      reference_image_url?: string;
                      requires_custom_quote?: boolean;
                    };
                    const variantList = Object.values(it.selected_variants || {});
                    return (
                      <div
                        key={it.id}
                        className="rounded-xl border border-[#EFECE4] bg-[#FDFBF7] p-3.5 flex flex-col sm:flex-row gap-3"
                      >
                        {it.product_image && (
                          <SafeImage
                            src={it.product_image}
                            alt={it.product_name}
                            preset="thumbnail"
                            wrapperClassName="w-16 h-16 rounded-lg border border-[#EFECE4] shrink-0"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0 space-y-1 text-xs">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-[#14222E] text-sm">
                                {it.product_name}
                              </p>
                              <p className="text-[11px] text-[#5C6F80] font-mono">
                                SKU: {it.product_sku || '-'} · SL: {it.quantity} · Đơn giá:{' '}
                                {formatVnd(it.unit_price)}
                                {it.surcharge_total > 0 && ` (+ phụ phí ${formatVnd(it.surcharge_total)})`}
                              </p>
                            </div>
                            <p className="font-semibold text-[#14222E] tabular-nums text-sm">
                              {formatVnd(it.line_total)}
                            </p>
                          </div>

                          {variantList.length > 0 && (
                            <p className="text-[#5C6F80]">
                              <strong className="text-[#14222E]">Biến thể:</strong>{' '}
                              {variantList
                                .map(
                                  (v) =>
                                    `${v.label}${v.price_delta ? ` (+${formatVnd(v.price_delta)})` : ''}`
                                )
                                .join(' · ')}
                            </p>
                          )}

                          {it.selected_addons && it.selected_addons.length > 0 && (
                            <p className="text-[#5C6F80]">
                              <strong className="text-[#14222E]">Phụ kiện kèm thêm:</strong>{' '}
                              {it.selected_addons
                                .map((a) => `${a.label} (+${formatVnd(a.price)})`)
                                .join(', ')}
                            </p>
                          )}

                          {(pers.custom_text ||
                            pers.card_message ||
                            pers.theme_input ||
                            pers.note ||
                            pers.requires_custom_quote ||
                            pers.reference_image_url) && (
                            <div className="mt-2 p-2.5 rounded-lg bg-[#F8F5EE]/65 border border-[#EFECE4] space-y-1">
                              <p className="text-[11px] font-semibold text-[#4A1829]">
                                Chi tiết cá nhân hóa:
                              </p>
                              {pers.custom_text && (
                                <p className="text-[#006A9E]">
                                  • <strong>Chữ in trên bóng/hoa:</strong> {pers.custom_text}
                                </p>
                              )}
                              {pers.card_message && (
                                <p className="text-[#14222E] whitespace-pre-wrap">
                                  • <strong>Lời chúc trên thiệp:</strong> {pers.card_message}
                                </p>
                              )}
                              {pers.theme_input && (
                                <p className="text-[#14222E]">
                                  • <strong>Chủ đề / Tông màu yêu cầu:</strong> {pers.theme_input}
                                </p>
                              )}
                              {pers.note && (
                                <p className="text-[#14222E] whitespace-pre-wrap">
                                  • <strong>Ghi chú mẫu:</strong> {pers.note}
                                </p>
                              )}
                              {pers.requires_custom_quote && (
                                <p className="text-[#9A5B13] font-medium">
                                  • Khách đánh dấu cần cửa hàng báo giá phụ phí chỉnh sửa riêng.
                                </p>
                              )}
                              {pers.reference_image_url && (
                                <div className="pt-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      lastLightboxTriggerRef.current = e.currentTarget;
                                      setLightboxImage(pers.reference_image_url!);
                                    }}
                                    className="inline-flex items-center gap-2 p-1.5 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] hover:bg-[#F9E1E8] text-[11px] font-medium text-[#14222E]"
                                  >
                                    <SafeImage
                                      src={pers.reference_image_url}
                                      alt="Ảnh tham khảo sản phẩm"
                                      preset="thumbnail"
                                      wrapperClassName="w-10 h-10 rounded"
                                      className="w-full h-full object-cover"
                                    />
                                    <span>Xem ảnh tham khảo khách đính kèm</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {record.data.status === 'completed' && it.review_token && (
                            <div className="pt-2 flex flex-wrap items-center gap-2">
                              <Link
                                to={`/san-pham/${it.product_slug}?reviewToken=${encodeURIComponent(
                                  it.review_token
                                )}#danh-gia`}
                                className="inline-flex items-center min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs sm:text-[11px] font-semibold"
                              >
                                Mở link đánh giá xác thực
                              </Link>
                              <button
                                type="button"
                                onClick={() =>
                                  onCopy(
                                    `${window.location.origin}/san-pham/${it.product_slug}?reviewToken=${it.review_token}#danh-gia`,
                                    'liên kết đánh giá'
                                  )
                                }
                                className="inline-flex items-center gap-1 min-h-[44px] sm:min-h-[34px] px-3 py-1.5 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] hover:bg-[#F9E1E8] text-xs sm:text-[11px]"
                              >
                                <Copy className="w-3.5 h-3.5" /> Copy link đánh giá
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Payment Breakdown */}
              <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] inline-flex items-center gap-1.5 pb-1.5 border-b border-[#EFECE4] w-full">
                  <CreditCard className="w-3.5 h-3.5 text-[#006A9E]" />
                  Thanh toán &amp; Tổng tiền
                </h3>
                <DetailRow
                  label="Phương thức thanh toán"
                  value={getPaymentMethodLabel(record.data.payment_method)}
                />
                <DetailRow label="Tạm tính sản phẩm" value={formatVnd(record.data.subtotal)} mono />
                {record.data.surcharge_total > 0 && (
                  <DetailRow
                    label="Phụ phí cá nhân hóa"
                    value={formatVnd(record.data.surcharge_total)}
                    mono
                  />
                )}
                <DetailRow
                  label="Phí giao hàng"
                  value={
                    record.data.shipping_fee_status === 'confirmed'
                      ? formatVnd(record.data.shipping_fee)
                      : 'Chờ cửa hàng xác nhận'
                  }
                  mono
                />
                {record.data.discount_amount > 0 && (
                  <DetailRow
                    label={`Giảm giá${record.data.discount_code ? ` (${record.data.discount_code})` : ''}`}
                    value={`-${formatVnd(record.data.discount_amount)}`}
                    mono
                  />
                )}
                {record.data.deposit_required !== null && record.data.deposit_required > 0 && (
                  <DetailRow
                    label="Yêu cầu đặt cọc"
                    value={`${formatVnd(record.data.deposit_required)} (Đã nhận: ${formatVnd(
                      record.data.deposit_paid_amount
                    )})`}
                    mono
                  />
                )}
                <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-[#DDD4BE] text-sm font-semibold">
                  <span className="text-[#14222E]">Tổng cộng đơn hàng</span>
                  <span className="text-[#006A9E] tabular-nums text-base">
                    {formatVnd(record.data.total_amount)}
                  </span>
                </div>
              </section>

              {/* Admin Update Panel for Order */}
              <section className="rounded-2xl border border-[#E093AB] bg-[#F9E1E8]/40 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#4A1829]">
                  Cập nhật xử lý đơn hàng
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-[#14222E] mb-1">Trạng thái đơn</label>
                    <select
                      value={orderStatus}
                      onChange={(e) => setOrderStatus(e.target.value as OrderStatus)}
                      className="w-full px-2.5 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                    >
                      {Object.entries(ORDER_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[#14222E] mb-1">
                      Trạng thái thanh toán
                    </label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                      className="w-full px-2.5 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                    >
                      {Object.entries(PAYMENT_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[#14222E] mb-1">
                      Phí giao hàng (VNĐ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={shippingFeeStr}
                      onChange={(e) => setShippingFeeStr(e.target.value)}
                      placeholder="Để trống nếu chờ báo"
                      className="w-full px-2.5 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl tabular-nums"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => setScheduleConfirmed((v) => !v)}
                      className={`w-full min-h-[44px] sm:min-h-[38px] py-2 px-3 rounded-xl border font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                        scheduleConfirmed
                          ? 'border-[#0B7A53]/40 bg-[#E6F4EE] text-[#0B7A53]'
                          : 'border-[#EFECE4] bg-[#FDFBF7] text-[#14222E] hover:bg-[#F9E1E8]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{scheduleConfirmed ? 'Đã xác nhận lịch' : 'Xác nhận lịch giao'}</span>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Ghi chú nội bộ quản trị
                  </label>
                  <textarea
                    rows={2}
                    value={orderAdminNote}
                    onChange={(e) => setOrderAdminNote(e.target.value)}
                    placeholder="Ghi chú giao nhận, xác nhận chuyển khoản, thợ phụ trách..."
                    className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                  />
                </div>
              </section>
            </>
          )}

          {/* ================= CUSTOM REQUEST DETAIL ================= */}
          {record.type === 'custom_request' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderCustomerCard(
                  record.data.customer_name,
                  record.data.customer_phone,
                  record.data.customer_email
                )}

                <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] inline-flex items-center gap-1.5 pb-1.5 border-b border-[#EFECE4] w-full">
                    <Palette className="w-3.5 h-3.5 text-[#D83995]" />
                    Thông số thiết kế khách gửi
                  </h3>
                  <DetailRow label="Loại sản phẩm" value={record.data.product_type} />
                  <DetailRow label="Dịp tặng / sử dụng" value={record.data.occasion} />
                  <DetailRow label="Ngày cần nhận hàng" value={record.data.needed_date} mono />
                  <DetailRow label="Ngân sách dự kiến" value={record.data.budget} />
                  <DetailRow
                    label="Báo giá hiện tại"
                    value={
                      record.data.quoted_price !== null
                        ? formatVnd(record.data.quoted_price)
                        : 'Chưa báo giá'
                    }
                    mono
                  />
                </section>
              </div>

              <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] pb-1.5 border-b border-[#EFECE4]">
                  Chi tiết phong cách &amp; cá nhân hóa
                </h3>
                <DetailRow label="Tông màu mong muốn" value={record.data.colors} />
                <DetailRow label="Chủ đề / Nhân vật" value={record.data.theme_character} />
                <DetailRow label="Kích thước mong muốn" value={record.data.desired_size} />
                <DetailRow
                  label="Chữ in / Nội dung thiệp"
                  value={record.data.personalization_text}
                />
                <div className="pt-2">
                  <p className="text-xs text-[#5C6F80] mb-1">Ghi chú thêm của khách hàng:</p>
                  <p className="text-xs text-[#14222E] bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-3 whitespace-pre-wrap">
                    {record.data.customer_note || 'Khách không ghi chú thêm.'}
                  </p>
                </div>
              </section>

              {renderReferenceImages(
                record.data.reference_images,
                'Ảnh mẫu tham khảo khách gửi'
              )}

              <section className="rounded-2xl border border-[#E093AB] bg-[#F9E1E8]/40 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#4A1829]">
                  Xử lý tư vấn &amp; báo giá thiết kế riêng
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-[#14222E] mb-1">
                      Trạng thái yêu cầu
                    </label>
                    <select
                      value={inquiryStatus}
                      onChange={(e) => setInquiryStatus(e.target.value as InquiryStatus)}
                      className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                    >
                      {Object.entries(INQUIRY_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[#14222E] mb-1">
                      Báo giá cửa hàng (VNĐ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={quotedPriceStr}
                      onChange={(e) => setQuotedPriceStr(e.target.value)}
                      placeholder="Nhập số tiền báo giá (VNĐ)"
                      className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Ghi chú tư vấn nội bộ
                  </label>
                  <textarea
                    rows={2}
                    value={inquiryAdminNote}
                    onChange={(e) => setInquiryAdminNote(e.target.value)}
                    placeholder="Ghi chú phương án chốt với khách, vật liệu, thời gian giao..."
                    className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                  />
                </div>
              </section>
            </>
          )}

          {/* ================= EVENT QUOTE DETAIL ================= */}
          {record.type === 'event_quote' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderCustomerCard(
                  record.data.customer_name,
                  record.data.customer_phone,
                  record.data.customer_email
                )}

                <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-1">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] inline-flex items-center gap-1.5 pb-1.5 border-b border-[#EFECE4] w-full">
                    <Calendar className="w-3.5 h-3.5 text-[#006A9E]" />
                    Thông tin sự kiện
                  </h3>
                  <DetailRow label="Loại sự kiện" value={record.data.event_type} />
                  <DetailRow
                    label="Ngày & giờ tổ chức"
                    value={`${record.data.event_date}${
                      record.data.event_time ? ` · ${record.data.event_time}` : ''
                    }`}
                    mono
                  />
                  <DetailRow label="Địa điểm tổ chức" value={record.data.location} />
                  <DetailRow
                    label="Không gian"
                    value={VENUE_SETTING_LABELS[record.data.venue_setting] || record.data.venue_setting}
                  />
                  <DetailRow label="Quy mô / Diện tích" value={record.data.scale_area} />
                  <DetailRow label="Ngân sách dự kiến" value={record.data.budget} />
                </section>
              </div>

              <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] pb-1.5 border-b border-[#EFECE4]">
                  Hạng mục &amp; Phong cách trang trí
                </h3>
                <DetailRow label="Tông màu & phong cách" value={record.data.style_colors} />
                <DetailRow
                  label="Báo giá hiện tại"
                  value={
                    record.data.quoted_price !== null
                      ? formatVnd(record.data.quoted_price)
                      : 'Chưa báo giá'
                  }
                  mono
                />
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-[#5C6F80]">Hạng mục khách yêu cầu:</p>
                  {record.data.desired_items.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {record.data.desired_items.map((item, idx) => (
                        <span
                          key={idx}
                          className="px-2.5 py-1 rounded-lg bg-[#FDFBF7] border border-[#EFECE4] text-xs font-medium text-[#14222E]"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#5C6F80]">Chưa chọn hạng mục cụ thể.</p>
                  )}
                </div>
                <div className="pt-1">
                  <p className="text-xs text-[#5C6F80] mb-1">Ghi chú &amp; yêu cầu thêm:</p>
                  <p className="text-xs text-[#14222E] bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-3 whitespace-pre-wrap">
                    {record.data.customer_note || 'Khách không ghi chú thêm.'}
                  </p>
                </div>
              </section>

              {renderReferenceImages(
                record.data.reference_images,
                'Ảnh không gian / ý tưởng sự kiện khách gửi'
              )}

              <section className="rounded-2xl border border-[#E093AB] bg-[#F9E1E8]/40 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#4A1829]">
                  Xử lý tư vấn &amp; báo giá sự kiện
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-[#14222E] mb-1">
                      Trạng thái báo giá
                    </label>
                    <select
                      value={inquiryStatus}
                      onChange={(e) => setInquiryStatus(e.target.value as InquiryStatus)}
                      className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                    >
                      {Object.entries(INQUIRY_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-[#14222E] mb-1">
                      Báo giá sự kiện dự kiến (VNĐ)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={quotedPriceStr}
                      onChange={(e) => setQuotedPriceStr(e.target.value)}
                      placeholder="Nhập số tiền báo giá (VNĐ)"
                      className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Ghi chú khảo sát &amp; tư vấn nội bộ
                  </label>
                  <textarea
                    rows={2}
                    value={inquiryAdminNote}
                    onChange={(e) => setInquiryAdminNote(e.target.value)}
                    placeholder="Ghi chú lịch khảo sát mặt bằng, giờ thi công, nhân sự, cọc..."
                    className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                  />
                </div>
              </section>
            </>
          )}

          {/* ================= CONTACT SUPPORT DETAIL ================= */}
          {record.type === 'contact' && (
            <>
              {renderCustomerCard(
                record.data.customer_name,
                record.data.customer_phone,
                record.data.customer_email
              )}

              <section className="rounded-2xl border border-[#EFECE4] bg-[#F8F5EE]/45 p-4 space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#14222E] pb-1.5 border-b border-[#EFECE4]">
                  Nội dung yêu cầu hỗ trợ / liên hệ
                </h3>
                <DetailRow label="Chủ đề" value={record.data.subject} />
                <div>
                  <p className="text-xs text-[#5C6F80] mb-1">Nội dung chi tiết khách gửi:</p>
                  <p className="text-sm text-[#14222E] bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-3.5 whitespace-pre-wrap leading-relaxed">
                    {record.data.message}
                  </p>
                </div>
              </section>

              <section className="rounded-2xl border border-[#E093AB] bg-[#F9E1E8]/40 p-4 space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[#4A1829]">
                  Trạng thái xử lý hỗ trợ
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-[#14222E] mb-1">
                      Trạng thái phản hồi
                    </label>
                    <select
                      value={contactStatus}
                      onChange={(e) =>
                        setContactStatus(e.target.value as 'new' | 'replied' | 'closed')
                      }
                      className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                    >
                      {Object.entries(CONTACT_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Ghi chú nội bộ sau khi liên hệ khách
                  </label>
                  <textarea
                    rows={2}
                    value={contactAdminNote}
                    onChange={(e) => setContactAdminNote(e.target.value)}
                    placeholder="Ghi chú nội dung đã tư vấn/hỗ trợ cho khách..."
                    className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
                  />
                </div>
              </section>
            </>
          )}
        </div>

          {/* Modal Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-t border-[#EFECE4] bg-[#F8F5EE]/70 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-xs font-semibold text-[#14222E] hover:bg-[#F9E1E8]"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Đang lưu...' : 'Lưu cập nhật'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Image Lightbox Overlay */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#14222E]/88 p-4"
          data-hn-overlay-layer="lightbox"
          data-lenis-prevent
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh phóng to"
        >
          <div className="relative max-w-4xl max-h-[88vh] flex flex-col items-center gap-3">
            <button
              ref={lightboxCloseBtnRef}
              type="button"
              onClick={() => setLightboxImage(null)}
              className="self-end min-h-[44px] px-4 py-2 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> Đóng ảnh
            </button>
            <img
              src={lightboxImage}
              alt="Ảnh phóng to"
              className="max-w-full max-h-[80vh] rounded-2xl border border-[#EFECE4] object-contain bg-[#FDFBF7]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
