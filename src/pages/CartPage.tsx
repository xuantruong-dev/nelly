import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatVnd, usePageMeta } from '../lib/format.ts';
import { SafeImage } from '../components/SafeImage.tsx';

export function CartPage() {
  const {
    cart,
    cartCount,
    cartSubtotal,
    cartSurchargeTotal,
    cartGrandTotal,
    updateCartQuantity,
    removeFromCart,
    clearCart,
  } = useStore();

  usePageMeta('Giỏ hàng – Hoa Nelly', 'Xem lại các mẫu hoa bóng bay, phụ kiện và tùy chọn cá nhân hóa trước khi đặt hàng tại Hoa Nelly.');

  return (
    <div className="hn-page-shell">
      <div className="flex flex-wrap items-end justify-between gap-4 pb-6 border-b border-[#EFECE4]">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#14222E]">
            Giỏ hàng ({cartCount})
          </h1>
          <p className="text-sm text-[#5C6F80] mt-1">
            Kiểm tra lại mẫu hoa, tùy chọn màu sắc và nội dung cá nhân hóa trước khi đặt hàng.
          </p>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="inline-flex items-center min-h-[44px] px-1 text-xs text-[#5C6F80] hover:text-red-700 underline underline-offset-4"
          >
            Xóa toàn bộ giỏ hàng
          </button>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="my-12 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-12 text-center space-y-4">
          <ShoppingBag className="w-11 h-11 mx-auto text-[#0297DE]" />
          <h2 className="font-serif text-2xl font-semibold text-[#14222E]">
            Giỏ hàng của bạn đang trống
          </h2>
          <p className="text-sm text-[#5C6F80] max-w-md mx-auto">
            Khám phá các mẫu hoa bóng bay nghệ thuật có sẵn hoặc gửi ý tưởng để Hoa Nelly thiết kế riêng cho bạn.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/san-pham"
              className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5]"
            >
              Khám phá sản phẩm
            </Link>
            <Link
              to="/dat-thiet-ke-rieng"
              className="inline-flex items-center justify-center min-h-[44px] px-6 py-3 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] text-sm font-medium text-[#14222E] hover:bg-[#F9E1E8]"
            >
              Đặt thiết kế riêng
            </Link>
          </div>
        </div>
      ) : (
        <div className="hn-grid-12 mt-8 items-start">
          {/* Items List */}
          <div className="lg:col-span-8 space-y-4">
            {cart.map((item) => (
              <div
                key={item.cart_key}
                className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-4 sm:p-5 flex flex-col sm:flex-row gap-4"
              >
                <Link
                  to={`/san-pham/${item.product_slug}`}
                  className="w-full sm:w-28 h-40 sm:h-36 rounded-xl overflow-hidden bg-[#F8F5EE] shrink-0"
                >
                  <SafeImage src={item.product_image} alt={item.product_name} preset="thumbnail" />
                </Link>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono text-[#5C6F80]">SKU: {item.product_sku}</p>
                      <Link
                        to={`/san-pham/${item.product_slug}`}
                        className="font-serif text-lg font-semibold text-[#14222E] hover:text-[#006A9E]"
                      >
                        {item.product_name}
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.cart_key)}
                      className="w-11 h-11 -mr-2 -mt-2 inline-flex items-center justify-center rounded-xl text-[#5C6F80] hover:text-red-700 hover:bg-[#F9E1E8]/60 shrink-0"
                      aria-label={`Xóa ${item.product_name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Variants & Personalization */}
                  <div className="text-xs text-[#5C6F80] space-y-1">
                    {Object.values(item.selected_variants).length > 0 && (
                      <p>
                        <strong className="text-[#14222E]">Biến thể:</strong>{' '}
                        {Object.values(item.selected_variants)
                          .map((v) =>
                            v.price_delta > 0
                              ? `${v.label} (+${formatVnd(v.price_delta)})`
                              : v.label
                          )
                          .join(' · ')}
                      </p>
                    )}
                    {item.selected_addons.length > 0 && (
                      <p>
                        <strong className="text-[#14222E]">Phụ kiện thêm:</strong>{' '}
                        {item.selected_addons
                          .map((a) => `${a.label} (+${formatVnd(a.price)})`)
                          .join(', ')}
                      </p>
                    )}
                    {item.personalization.custom_text && (
                      <p>
                        <strong className="text-[#14222E]">Chữ cá nhân hóa:</strong>{' '}
                        {item.personalization.custom_text}
                      </p>
                    )}
                    {item.personalization.card_message && (
                      <p>
                        <strong className="text-[#14222E]">Nội dung thiệp:</strong>{' '}
                        {item.personalization.card_message}
                      </p>
                    )}
                    {item.personalization.theme_input && (
                      <p>
                        <strong className="text-[#14222E]">Chủ đề / Nhân vật:</strong>{' '}
                        {item.personalization.theme_input}
                      </p>
                    )}
                    {item.personalization.note && (
                      <p>
                        <strong className="text-[#14222E]">Ghi chú:</strong>{' '}
                        {item.personalization.note}
                      </p>
                    )}
                    {item.personalization.requires_custom_quote && (
                      <p className="text-[#006A9E] font-medium">
                        Có yêu cầu tùy chỉnh ngoài bảng giá - chờ cửa hàng xác nhận phụ phí.
                      </p>
                    )}
                  </div>

                  {/* Pricing & Stepper */}
                  <div className="pt-3 border-t border-[#EFECE4] flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex items-center border border-[#EFECE4] rounded-lg bg-[#FDFBF7]">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.cart_key, item.quantity - 1)}
                          className="w-11 h-11 inline-flex items-center justify-center hover:bg-[#F9E1E8]"
                          aria-label="Giảm số lượng"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-9 text-center text-sm font-semibold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.cart_key, item.quantity + 1)}
                          className="w-11 h-11 inline-flex items-center justify-center hover:bg-[#F9E1E8]"
                          aria-label="Tăng số lượng"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <Link
                        to={`/san-pham/${item.product_slug}`}
                        className="inline-flex items-center min-h-[44px] px-1 text-xs text-[#006A9E] hover:underline"
                      >
                        Chọn lại tùy chọn
                      </Link>
                    </div>

                    <div className="text-right text-xs text-[#5C6F80] tabular-nums">
                      <p>
                        Đơn giá gốc: {formatVnd(item.unit_price)}
                        {item.surcharge_total > 0 && ` · Phụ phí: +${formatVnd(item.surcharge_total)}`}
                      </p>
                      <p className="text-base font-semibold text-[#006A9E] mt-0.5">
                        {formatVnd(item.line_total)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <aside className="lg:col-span-4 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-4 lg:sticky lg:top-24">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">Tóm tắt giỏ hàng</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#5C6F80]">Tiền sản phẩm</dt>
                <dd className="font-medium text-[#14222E] tabular-nums">
                  {formatVnd(cartSubtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5C6F80]">Phụ phí tùy chọn &amp; phụ kiện</dt>
                <dd className="font-medium text-[#14222E] tabular-nums">
                  {formatVnd(cartSurchargeTotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#5C6F80]">Phí giao hàng</dt>
                <dd className="text-xs text-[#5C6F80]">Xác nhận ở bước đặt hàng</dd>
              </div>
              <div className="pt-3 border-t border-[#EFECE4] flex justify-between items-baseline">
                <dt className="font-semibold text-[#14222E]">Tạm tính</dt>
                <dd className="text-xl font-semibold text-[#006A9E] tabular-nums">
                  {formatVnd(cartGrandTotal)}
                </dd>
              </div>
            </dl>

            <Link
              to="/dat-hang"
              className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] transition-colors"
            >
              <span>Tiến hành đặt hàng</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/san-pham"
              className="flex items-center justify-center min-h-[44px] w-full text-center py-2.5 text-sm text-[#5C6F80] hover:text-[#006A9E]"
            >
              Tiếp tục chọn thêm sản phẩm
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
