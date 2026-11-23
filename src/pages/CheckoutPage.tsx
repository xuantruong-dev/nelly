import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, ShoppingBag } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatVnd, getLocalDateIso, usePageMeta } from '../lib/format.ts';
import { fetchJson } from '../lib/api.ts';

const TIME_SLOTS = [
  '08:30 – 10:30',
  '10:30 – 12:30',
  '13:30 – 15:30',
  '15:30 – 17:30',
  '17:30 – 20:00',
];

export function CheckoutPage() {
  const {
    settings,
    cart,
    cartSubtotal,
    cartSurchargeTotal,
    cartGrandTotal,
    clearCart,
    showToast,
  } = useStore();
  const navigate = useNavigate();

  usePageMeta(
    'Đặt hàng – Hoa Nelly',
    'Điền thông tin giao nhận và đặt hàng không cần tài khoản tại Hoa Nelly.'
  );

  // Stable idempotency key per checkout session to prevent duplicate orders on double click
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `ord-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const enabledPayments = useMemo(
    () => (settings?.payment_methods || []).filter((m) => m.enabled),
    [settings]
  );

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'delivery' | 'pickup'>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [differentRecipient, setDifferentRecipient] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [desiredDate, setDesiredDate] = useState(() => getLocalDateIso(1));
  const [desiredTimeSlot, setDesiredTimeSlot] = useState(TIME_SLOTS[0]);
  const [hidePrice, setHidePrice] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [honeypot, setHoneypot] = useState('');

  // Promo code
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount_amount: number } | null>(
    null
  );
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Schedule verification
  const [scheduleInfo, setScheduleInfo] = useState<{
    canConfirmDirectly: boolean;
    reason: string;
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentMethod && enabledPayments.length > 0) {
      setPaymentMethod(enabledPayments[0].id);
    }
  }, [enabledPayments, paymentMethod]);

  useEffect(() => {
    if (!desiredDate) return;
    const controller = new AbortController();
    fetchJson<{ canConfirmDirectly: boolean; reason: string }>(
      `/api/schedule-check?date=${encodeURIComponent(desiredDate)}&prepHours=12`,
      { signal: controller.signal }
    )
      .then((d) => {
        if (!controller.signal.aborted) setScheduleInfo(d);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [desiredDate]);

  const shippingSummary = useMemo(() => {
    if (deliveryMethod === 'pickup') {
      return { fee: 0, label: '0₫ (Nhận tại cửa hàng)', confirmed: true };
    }
    if (
      settings?.shipping_fee_mode === 'flat_rate' &&
      settings.flat_shipping_fee !== null
    ) {
      if (
        settings.free_shipping_threshold !== null &&
        cartGrandTotal >= settings.free_shipping_threshold
      ) {
        return { fee: 0, label: '0₫ (Đạt mức miễn phí giao hàng)', confirmed: true };
      }
      return {
        fee: settings.flat_shipping_fee,
        label: formatVnd(settings.flat_shipping_fee),
        confirmed: true,
      };
    }
    return {
      fee: 0,
      label: 'Chưa xác định (Chờ cửa hàng báo phí)',
      confirmed: false,
    };
  }, [deliveryMethod, settings, cartGrandTotal]);

  const discountAmount = appliedPromo?.discount_amount || 0;
  const finalTotal = Math.max(0, cartGrandTotal - discountAmount + shippingSummary.fee);
  const depositRequired =
    settings?.deposit_policy_enabled && settings.deposit_percent > 0
      ? Math.round((finalTotal * settings.deposit_percent) / 100)
      : null;

  const hasCustomQuoteItems = cart.some((i) => i.personalization.requires_custom_quote);

  const handleApplyPromo = async () => {
    const code = promoInput.trim();
    if (!code || promoLoading) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const json = await fetchJson<{ code: string; discount_amount: number; message: string }>(
        '/api/promo/validate',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          fallbackError: 'Mã ưu đãi không hợp lệ.',
          body: JSON.stringify({ code, subtotal: cartGrandTotal }),
        }
      );
      setAppliedPromo({ code: json.code, discount_amount: json.discount_amount });
      showToast(json.message);
    } catch (err) {
      setAppliedPromo(null);
      setPromoError(err instanceof Error ? err.message : 'Không thể kiểm tra mã ưu đãi lúc này.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const json = await fetchJson<{ order: any; lookup_token: string }>('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        fallbackError: 'Không thể hoàn tất đặt hàng. Vui lòng kiểm tra thông tin.',
        body: JSON.stringify({
          idempotency_key: idempotencyKeyRef.current,
          website_url: honeypot,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_email: customerEmail.trim(),
          delivery_method: deliveryMethod,
          delivery_address: deliveryMethod === 'delivery' ? deliveryAddress.trim() : '',
          recipient_name: differentRecipient ? recipientName.trim() : '',
          recipient_phone: differentRecipient ? recipientPhone.trim() : '',
          desired_date: desiredDate,
          desired_time_slot: desiredTimeSlot,
          hide_price_for_recipient: hidePrice,
          customer_note: customerNote.trim(),
          payment_method: paymentMethod,
          discount_code: appliedPromo?.code || '',
          items: cart.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            selected_variants: item.selected_variants,
            selected_addons: item.selected_addons,
            personalization: item.personalization,
          })),
        }),
      });

      clearCart();
      navigate(`/don-hang/${json.order.order_code}`, {
        state: {
          justOrdered: true,
          order: json.order,
          lookupToken: json.lookup_token,
        },
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Lỗi kết nối khi gửi đơn hàng. Vui lòng thử lại.'
      );
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-5 py-12 sm:py-20 text-center space-y-4">
        <ShoppingBag className="w-10 h-10 mx-auto text-[#0297DE]" />
        <h1 className="font-serif text-2xl font-semibold text-[#14222E]">
          Chưa có sản phẩm để đặt hàng
        </h1>
        <p className="text-sm text-[#5C6F80]">
          Vui lòng thêm mẫu hoa hoặc phụ kiện vào giỏ hàng trước khi chuyển sang bước thanh toán.
        </p>
        <Link
          to="/san-pham"
          className="inline-flex px-6 py-3 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-sm font-medium"
        >
          Khám phá sản phẩm
        </Link>
      </div>
    );
  }

  return (
    <div className="hn-page-shell">
      <div className="pb-6 border-b border-[#EFECE4]">
        <h1 className="font-serif text-3xl font-semibold text-[#14222E]">
          Thông tin giao nhận &amp; Đặt hàng
        </h1>
        <p className="text-sm text-[#5C6F80] mt-1">
          Đặt hàng nhanh không cần tạo tài khoản. Hoa Nelly kiểm tra lại giá, lịch thực hiện và xác nhận minh bạch trước khi thanh toán.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="hn-grid-12 mt-8 items-start">
        {/* Honeypot field */}
        <input
          type="text"
          name="website_url"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden="true"
        />

        {/* Left Form */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Buyer Info */}
          <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 sm:p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              1. Thông tin người đặt
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Họ và tên <span className="text-red-700">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nguyễn Minh Anh"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Số điện thoại <span className="text-red-700">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="09xxxxxxxx"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Email nhận thông báo đơn hàng (tùy chọn)
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="ban@email.com"
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>
          </section>

          {/* 2. Delivery & Schedule */}
          <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 sm:p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              2. Hình thức nhận &amp; Lịch hẹn
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-2.5 ${
                  deliveryMethod === 'delivery'
                    ? 'border-[#D47B97] bg-[#F8F5EE]/60'
                    : 'border-[#EFECE4]'
                }`}
              >
                <input
                  type="radio"
                  name="deliveryMethod"
                  checked={deliveryMethod === 'delivery'}
                  onChange={() => setDeliveryMethod('delivery')}
                  className="mt-1 accent-[#006A9E]"
                />
                <span className="text-sm">
                  <strong className="block text-[#14222E]">Giao hàng tận nơi</strong>
                  <span className="text-xs text-[#5C6F80]">
                    {settings?.delivery_area || 'Khu vực & phí giao xác nhận theo địa chỉ'}
                  </span>
                </span>
              </label>

              {settings?.supports_pickup !== false && (
                <label
                  className={`p-3.5 rounded-xl border cursor-pointer flex items-start gap-2.5 ${
                    deliveryMethod === 'pickup'
                      ? 'border-[#D47B97] bg-[#F8F5EE]/60'
                      : 'border-[#EFECE4]'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryMethod"
                    checked={deliveryMethod === 'pickup'}
                    onChange={() => setDeliveryMethod('pickup')}
                    className="mt-1 accent-[#006A9E]"
                  />
                  <span className="text-sm">
                    <strong className="block text-[#14222E]">Nhận trực tiếp tại cửa hàng</strong>
                    <span className="text-xs text-[#5C6F80]">
                      {settings?.address || 'Địa chỉ cụ thể sẽ được xác nhận sau khi đặt'}
                    </span>
                  </span>
                </label>
              )}
            </div>

            {deliveryMethod === 'delivery' && (
              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Địa chỉ giao hàng chi tiết <span className="text-red-700">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>
            )}

            <label className="flex items-center gap-2.5 text-sm text-[#14222E] cursor-pointer">
              <input
                type="checkbox"
                checked={differentRecipient}
                onChange={(e) => setDifferentRecipient(e.target.checked)}
                className="accent-[#006A9E] w-4 h-4"
              />
              <span>Người nhận quà khác người đặt</span>
            </label>

            {differentRecipient && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-[#FDFBF7] border border-[#EFECE4]">
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Tên người nhận
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Số điện thoại người nhận
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Ngày nhận mong muốn <span className="text-red-700">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={getLocalDateIso(0)}
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Khung giờ mong muốn <span className="text-red-700">*</span>
                </label>
                <select
                  value={desiredTimeSlot}
                  onChange={(e) => setDesiredTimeSlot(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {scheduleInfo && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                  scheduleInfo.canConfirmDirectly
                    ? 'bg-[#ECFDF5] text-[#0B7A53]'
                    : 'bg-[#F4B6C8]/70 text-[#4A1829]'
                }`}
              >
                {scheduleInfo.canConfirmDirectly ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <span>{scheduleInfo.reason}</span>
              </div>
            )}

            {settings?.supports_hide_price_gift !== false && (
              <label className="flex items-center gap-2.5 text-sm text-[#14222E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidePrice}
                  onChange={(e) => setHidePrice(e.target.checked)}
                  className="accent-[#006A9E] w-4 h-4"
                />
                <span>Đây là quà tặng - không hiển thị giá trên phiếu gửi kèm cho người nhận</span>
              </label>
            )}

            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Lời nhắn &amp; ghi chú giao nhận
              </label>
              <textarea
                rows={2}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Ví dụ: Gọi trước 15 phút khi giao, giao tại sảnh lễ tân..."
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>
          </section>

          {/* 3. Payment Method */}
          <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 sm:p-6 space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              3. Phương thức thanh toán
            </h2>
            <div className="space-y-3">
              {enabledPayments.map((pm) => (
                <label
                  key={pm.id}
                  className={`block p-4 rounded-xl border cursor-pointer ${
                    paymentMethod === pm.id
                      ? 'border-[#D47B97] bg-[#F8F5EE]/60'
                      : 'border-[#EFECE4]'
                  }`}
                >
                  <span className="flex items-start gap-2.5">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={pm.id}
                      checked={paymentMethod === pm.id}
                      onChange={() => setPaymentMethod(pm.id)}
                      className="mt-1 accent-[#006A9E]"
                    />
                    <span>
                      <strong className="block text-sm text-[#14222E]">{pm.label}</strong>
                      <span className="block text-xs text-[#5C6F80] mt-1 leading-relaxed">
                        {pm.description}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Right Order Summary */}
        <aside className="lg:col-span-5 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 sm:p-6 space-y-5 lg:sticky lg:top-24">
          <h2 className="font-serif text-xl font-semibold text-[#14222E]">
            Đơn hàng của bạn ({cart.length} dòng)
          </h2>

          <div className="divide-y divide-[#EFECE4] max-h-72 overflow-y-auto pr-1">
            {cart.map((item) => (
              <div key={item.cart_key} className="py-3 flex justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-[#14222E]">
                    {item.product_name} × {item.quantity}
                  </p>
                  {Object.values(item.selected_variants).length > 0 && (
                    <p className="text-xs text-[#5C6F80]">
                      {Object.values(item.selected_variants)
                        .map((v) => v.label)
                        .join(' · ')}
                    </p>
                  )}
                  {item.personalization.custom_text && (
                    <p className="text-xs text-[#006A9E]">
                      Chữ: &ldquo;{item.personalization.custom_text}&rdquo;
                    </p>
                  )}
                </div>
                <span className="font-medium text-[#14222E] tabular-nums shrink-0">
                  {formatVnd(item.line_total)}
                </span>
              </div>
            ))}
          </div>

          {/* Promo Code */}
          <div className="pt-3 border-t border-[#EFECE4] space-y-2">
            <label className="block text-xs font-medium text-[#14222E]">
              Mã ưu đãi (nếu có)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value)}
                placeholder="Nhập mã ưu đãi"
                className="flex-1 min-h-[44px] px-3 py-2 text-sm border border-[#EFECE4] rounded-lg uppercase"
              />
              <button
                type="button"
                disabled={promoLoading}
                onClick={handleApplyPromo}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-[#D47B97] text-[#006A9E] text-xs font-semibold hover:bg-[#F9E1E8]"
              >
                {promoLoading ? 'Kiểm tra...' : 'Áp dụng'}
              </button>
            </div>
            {promoError && <p className="text-xs text-red-700">{promoError}</p>}
            {appliedPromo && (
              <div className="flex items-center justify-between gap-2 text-xs text-[#0B7A53] font-medium">
                <span>
                  Đã áp dụng mã {appliedPromo.code} (-{formatVnd(appliedPromo.discount_amount)})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoInput('');
                    setPromoError(null);
                  }}
                  className="text-[11px] font-semibold text-[#7A2047] hover:underline px-2 py-1 rounded cursor-pointer shrink-0"
                >
                  Bỏ mã
                </button>
              </div>
            )}
          </div>

          {/* Cost Breakdown */}
          <dl className="pt-3 border-t border-[#EFECE4] space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-[#5C6F80]">Tiền sản phẩm</dt>
              <dd className="tabular-nums font-medium">{formatVnd(cartSubtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[#5C6F80]">Phụ phí tùy chỉnh &amp; phụ kiện</dt>
              <dd className="tabular-nums font-medium">{formatVnd(cartSurchargeTotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#5C6F80]">Phí giao hàng</dt>
              <dd className="text-right text-xs sm:text-sm tabular-nums text-[#14222E]">
                {shippingSummary.label}
              </dd>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-[#0B7A53]">
                <dt>Giảm giá ({appliedPromo?.code})</dt>
                <dd className="tabular-nums font-medium">-{formatVnd(discountAmount)}</dd>
              </div>
            )}
            <div className="pt-3 border-t border-[#EFECE4] flex justify-between items-baseline">
              <dt className="font-semibold text-[#14222E]">
                {shippingSummary.confirmed && !hasCustomQuoteItems
                  ? 'Tổng thanh toán'
                  : 'Tổng tạm tính'}
              </dt>
              <dd className="text-xl font-semibold text-[#006A9E] tabular-nums">
                {formatVnd(finalTotal)}
              </dd>
            </div>
            {depositRequired !== null && (
              <div className="flex justify-between text-xs text-[#006A9E]">
                <dt>Khoản đặt cọc dự kiến ({settings?.deposit_percent}%)</dt>
                <dd className="tabular-nums font-semibold">{formatVnd(depositRequired)}</dd>
              </div>
            )}
          </dl>

          {(!shippingSummary.confirmed || hasCustomQuoteItems) && (
            <p className="text-xs text-[#5C6F80] bg-[#FDFBF7] p-3 rounded-lg border border-[#EFECE4]">
              {!shippingSummary.confirmed
                ? 'Phí giao hàng chưa được tính vào tổng tạm tính trên. '
                : ''}
              {hasCustomQuoteItems
                ? 'Đơn có tùy chỉnh ngoài bảng giá chuẩn - Hoa Nelly sẽ báo tổng cuối cùng trước khi thực hiện.'
                : 'Hoa Nelly sẽ xác nhận tổng thanh toán cuối cùng với bạn qua số điện thoại.'}
            </p>
          )}

          {submitError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] py-3.5 px-5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Đang gửi đơn hàng...' : 'Xác nhận đặt hàng'}
          </button>

          <p className="text-[11px] text-[#5C6F80] text-center">
            Bằng việc gửi đơn, bạn đồng ý với{' '}
            <Link to="/chinh-sach/dieu-khoan-su-dung" className="underline">
              Điều khoản sử dụng
            </Link>{' '}
            và{' '}
            <Link to="/chinh-sach/bao-ve-thong-tin" className="underline">
              Chính sách bảo vệ thông tin
            </Link>
            .
          </p>
        </aside>
      </form>
    </div>
  );
}
