import React, { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { CheckCircle2, Search, ShieldCheck, Star } from 'lucide-react';
import type { Order } from '../../shared/types.ts';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  formatDateTimeVi,
  formatVnd,
  getPaymentMethodLabel,
  usePageMeta,
} from '../lib/format.ts';
import { fetchJson } from '../lib/api.ts';
import { CinematicHeading, ScrollReveal } from '../components/CinematicScroll.tsx';

interface LocationState {
  justOrdered?: boolean;
  order?: Order;
  lookupToken?: string;
}

export function OrderTrackingPage() {
  const { orderCode: paramCode } = useParams();
  const location = useLocation();
  const navState = (location.state || {}) as LocationState;

  const [orderCode, setOrderCode] = useState(paramCode || navState.order?.order_code || '');
  const [phone, setPhone] = useState('');
  const [order, setOrder] = useState<Order | null>(navState.order || null);
  const [justOrdered] = useState(Boolean(navState.justOrdered));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageMeta(
    'Xác nhận & Tra cứu đơn hàng – Hoa Nelly',
    'Tra cứu trạng thái xử lý, giao nhận và đánh giá sản phẩm đã hoàn tất tại Hoa Nelly.'
  );

  useEffect(() => {
    if (paramCode) {
      setOrderCode(paramCode);
    }
  }, [paramCode]);

  // If returning with state token, refresh live status from server
  useEffect(() => {
    if (!navState.order?.order_code || !navState.lookupToken) return;
    const controller = new AbortController();
    fetchJson<{ order?: Order }>('/api/orders/lookup', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_code: navState.order.order_code,
        lookup_token: navState.lookupToken,
      }),
    })
      .then((d) => {
        if (!controller.signal.aborted && d?.order) setOrder(d.order);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [navState.order?.order_code, navState.lookupToken]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const json = await fetchJson<{ order: Order }>('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        fallbackError: 'Không tìm thấy đơn hàng khớp với thông tin đã nhập.',
        body: JSON.stringify({
          order_code: orderCode.trim(),
          phone: phone.trim(),
        }),
      });
      setOrder(json.order);
    } catch (err) {
      setOrder(null);
      setError(err instanceof Error ? err.message : 'Lỗi kết nối khi tra cứu đơn hàng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hn-page-shell space-y-12">
      {justOrdered && order && (
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E093AB] p-6 sm:p-7 space-y-3">
          <div className="flex items-center gap-2.5 text-[#0B7A53]">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <h1 className="font-serif text-2xl font-semibold text-[#14222E]">
              Đặt hàng thành công · Mã đơn {order.order_code}
            </h1>
          </div>
          <p className="text-sm text-[#5C6F80] leading-relaxed">
            Hoa Nelly đã ghi nhận đơn hàng của bạn. Vui lòng lưu lại{' '}
            <strong className="text-[#14222E]">mã đơn {order.order_code}</strong> cùng số điện thoại đặt hàng để tra cứu trạng thái bất cứ lúc nào.
          </p>
        </div>
      )}

      {/* Protected Lookup Form */}
      <ScrollReveal once y={16}>
        <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 sm:p-7 space-y-4">
          <div>
            <CinematicHeading
              as={justOrdered ? 'h2' : 'h1'}
              triggerOnScroll={false}
              className="font-serif text-2xl sm:text-3xl font-medium text-[#14222E]"
            >
              Tra cứu trạng thái đơn hàng
            </CinematicHeading>
          <p className="text-sm text-[#5C6F80] mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#0B7A53] shrink-0" />
            <span>
              Để bảo vệ thông tin cá nhân, vui lòng nhập đồng thời mã đơn hàng và số điện thoại đặt hàng.
            </span>
          </p>
        </div>

        <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input
            type="text"
            required
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            placeholder="Mã đơn (VD: HN-20261121-ABCD)"
            className="sm:col-span-5 min-h-[44px] px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg font-mono uppercase"
          />
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Số điện thoại đặt hàng"
            className="sm:col-span-4 min-h-[44px] px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
          />
          <button
            type="submit"
            disabled={loading}
            className="sm:col-span-3 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>{loading ? 'Đang tìm...' : 'Tra cứu'}</span>
          </button>
        </form>

        {error && <p className="text-sm text-red-700">{error}</p>}
        </section>
      </ScrollReveal>

      {/* Order Details Receipt */}
      {order && (
        <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 sm:p-8 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-[#EFECE4]">
            <div>
              <p className="text-xs font-mono text-[#5C6F80]">MÃ ĐƠN HÀNG</p>
              <h3 className="font-mono text-xl font-semibold text-[#14222E] mt-0.5">
                {order.order_code}
              </h3>
              <p className="text-xs text-[#5C6F80] mt-1">
                Đặt lúc {formatDateTimeVi(order.created_at)}
              </p>
            </div>
            <div className="text-left sm:text-right space-y-1 text-sm">
              <p className="font-semibold text-[#006A9E]">
                Trạng thái đơn: {ORDER_STATUS_LABELS[order.status]}
              </p>
              <p className="text-xs text-[#5C6F80]">
                Thanh toán: {PAYMENT_STATUS_LABELS[order.payment_status]}
              </p>
              <p className="text-xs text-[#5C6F80]">
                Lịch hẹn: {order.desired_date} ({order.desired_time_slot}){' '}
                {order.schedule_confirmed ? '· Đã xác nhận lịch' : '· Chờ cửa hàng xác nhận'}
              </p>
            </div>
          </div>

          {/* Delivery Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#5C6F80]">NGƯỜI ĐẶT HÀNG</p>
              <p className="font-medium text-[#14222E]">{order.customer_name}</p>
              <p className="text-[#5C6F80]">{order.customer_phone}</p>
              {order.customer_email && <p className="text-[#5C6F80]">{order.customer_email}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#5C6F80]">GIAO NHẬN</p>
              <p className="font-medium text-[#14222E]">
                {order.delivery_method === 'pickup'
                  ? 'Nhận tại cửa hàng'
                  : order.delivery_address}
              </p>
              {order.recipient_name && (
                <p className="text-[#5C6F80]">
                  Người nhận: {order.recipient_name} ({order.recipient_phone})
                </p>
              )}
              {order.hide_price_for_recipient && (
                <p className="text-xs text-[#0B7A53]">
                  Quà tặng: Không kèm giá trên phiếu gửi người nhận
                </p>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="pt-4 border-t border-[#EFECE4] space-y-3">
            <p className="text-xs font-semibold text-[#5C6F80]">SẢN PHẨM TRONG ĐƠN</p>
            {order.items.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#FDFBF7] border border-[#EFECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 text-sm">
                  <Link
                    to={`/san-pham/${item.product_slug}`}
                    className="font-semibold text-[#14222E] hover:text-[#006A9E]"
                  >
                    {item.product_name} × {item.quantity}
                  </Link>
                  {Object.values(item.selected_variants).length > 0 && (
                    <p className="text-xs text-[#5C6F80]">
                      {Object.values(item.selected_variants)
                        .map((v) => v.label)
                        .join(' · ')}
                    </p>
                  )}
                  {item.selected_addons.length > 0 && (
                    <p className="text-xs text-[#5C6F80]">
                      Phụ kiện: {item.selected_addons.map((a) => a.label).join(', ')}
                    </p>
                  )}
                  {Boolean(item.personalization?.custom_text) && (
                    <p className="text-xs text-[#006A9E]">
                      Chữ cá nhân hóa: {String(item.personalization.custom_text)}
                    </p>
                  )}
                  {Boolean(item.personalization?.card_message) && (
                    <p className="text-xs text-[#5C6F80]">
                      Thiệp: {String(item.personalization.card_message)}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:items-end gap-2 shrink-0">
                  <span className="font-semibold text-[#006A9E] tabular-nums">
                    {formatVnd(item.line_total)}
                  </span>

                  {order.status === 'completed' && item.review_token && (
                    <Link
                      to={`/san-pham/${item.product_slug}?reviewToken=${encodeURIComponent(
                        item.review_token
                      )}#danh-gia`}
                      className="inline-flex items-center justify-center min-h-[44px] gap-1.5 px-3.5 py-2 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-xs font-semibold hover:bg-[#EC9EB5]"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span>{item.has_review ? 'Xem / Sửa đánh giá' : 'Đánh giá sản phẩm'}</span>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <dl className="pt-4 border-t border-[#EFECE4] space-y-2 text-sm max-w-sm ml-auto">
            <div className="flex justify-between">
              <dt className="text-[#5C6F80]">Tiền sản phẩm</dt>
              <dd className="tabular-nums">{formatVnd(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#5C6F80]">Phụ phí tùy chỉnh</dt>
              <dd className="tabular-nums">{formatVnd(order.surcharge_total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#5C6F80]">Phí giao hàng</dt>
              <dd className="tabular-nums">
                {order.shipping_fee_status === 'confirmed'
                  ? formatVnd(order.shipping_fee)
                  : 'Chờ cửa hàng xác nhận'}
              </dd>
            </div>
            {order.discount_amount > 0 && (
              <div className="flex justify-between text-[#0B7A53]">
                <dt>Giảm giá ({order.discount_code})</dt>
                <dd className="tabular-nums">-{formatVnd(order.discount_amount)}</dd>
              </div>
            )}
            <div className="pt-2 border-t border-[#EFECE4] flex justify-between font-semibold text-base">
              <dt>Tổng cộng</dt>
              <dd className="text-[#006A9E] tabular-nums">{formatVnd(order.total_amount)}</dd>
            </div>
            {order.deposit_required !== null && (
              <div className="flex justify-between text-xs text-[#5C6F80]">
                <dt>Đặt cọc yêu cầu</dt>
                <dd className="tabular-nums">
                  {formatVnd(order.deposit_required)} (Đã nhận: {formatVnd(order.deposit_paid_amount)})
                </dd>
              </div>
            )}
          </dl>

          <div className="pt-4 border-t border-[#EFECE4] flex flex-wrap items-center justify-between gap-3 text-xs text-[#5C6F80]">
            <span>
              Phương thức thanh toán đã chọn: {getPaymentMethodLabel(order.payment_method)}
            </span>
            <Link to="/lien-he" className="inline-flex items-center min-h-[44px] sm:min-h-0 text-[#006A9E] font-medium hover:underline">
              Cần hỗ trợ thêm về đơn hàng này?
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
