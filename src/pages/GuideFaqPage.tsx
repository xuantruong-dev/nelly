import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { CinematicHeading, ScrollReveal } from '../components/CinematicScroll.tsx';
import { usePageMeta } from '../lib/format.ts';

export function GuideFaqPage() {
  const { settings } = useStore();
  const [openId, setOpenId] = useState<string | null>('faq-order');

  usePageMeta(
    'Hướng dẫn đặt hàng & Câu hỏi thường gặp – Hoa Nelly',
    'Hướng dẫn mua sản phẩm có sẵn, đặt thiết kế theo yêu cầu, đặt trang trí sự kiện và giải đáp thắc mắc thường gặp tại Hoa Nelly.'
  );

  return (
    <div className="hn-page-shell space-y-12 sm:space-y-14">
      <div className="pb-6 border-b border-[#EFECE4]">
        <CinematicHeading
          as="h1"
          triggerOnScroll={false}
          className="font-serif text-3xl sm:text-4xl font-medium text-[#14222E]"
        >
          Hướng dẫn đặt hàng &amp; Câu hỏi thường gặp
        </CinematicHeading>
        <p className="text-sm sm:text-[15px] text-[#5C6F80] mt-2">
          Ba cách đặt hàng linh hoạt tùy theo nhu cầu tặng quà hoặc tổ chức sự kiện của bạn.
        </p>
      </div>

      {/* 3 Journeys */}
      <ScrollReveal
        staggerSelector=".hn-reveal-item"
        once
        y={20}
        stagger={0.08}
        className="hn-grid-3"
      >
        <div className="hn-reveal-item bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-3">
          <p className="text-[12.5px] font-medium text-[#006A9E]">Chọn mẫu có sẵn</p>
          <h2 className="font-serif text-lg font-medium text-[#14222E]">
            Mua sản phẩm có giá niêm yết
          </h2>
          <p className="text-sm text-[#5C6F80] leading-relaxed">
            Chọn mẫu trong danh mục, tùy chọn màu/kích thước/phụ kiện, viết nội dung thiệp rồi thêm vào giỏ và gửi đơn mà không cần tài khoản.
          </p>
          <Link to="/san-pham" className="inline-flex items-center min-h-[44px] sm:min-h-0 text-xs font-semibold text-[#006A9E] underline">
            Vào danh mục sản phẩm
          </Link>
        </div>

        <div className="hn-reveal-item bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-3">
          <p className="text-[12.5px] font-medium text-[#006A9E]">Cá nhân hóa riêng</p>
          <h2 className="font-serif text-lg font-medium text-[#14222E]">
            Đặt thiết kế theo yêu cầu
          </h2>
          <p className="text-sm text-[#5C6F80] leading-relaxed">
            Gửi ý tưởng nhân vật, màu sắc, lời chúc riêng và ảnh tham khảo. Hệ thống tạo mã tham chiếu để Hoa Nelly tư vấn và báo giá chi tiết.
          </p>
          <Link
            to="/dat-thiet-ke-rieng"
            className="inline-flex items-center min-h-[44px] sm:min-h-0 text-xs font-semibold text-[#006A9E] underline"
          >
            Mở biểu mẫu thiết kế riêng
          </Link>
        </div>

        <div className="hn-reveal-item bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-3">
          <p className="text-[12.5px] font-medium text-[#006A9E]">Không gian tiệc &amp; sự kiện</p>
          <h2 className="font-serif text-lg font-medium text-[#14222E]">
            Đặt dịch vụ trang trí sự kiện
          </h2>
          <p className="text-sm text-[#5C6F80] leading-relaxed">
            Cung cấp loại tiệc, thời gian, địa điểm, ảnh không gian và hạng mục mong muốn để Hoa Nelly gửi phương án và báo giá minh bạch.
          </p>
          <Link
            to="/trang-tri-su-kien"
            className="inline-flex items-center min-h-[44px] sm:min-h-0 text-xs font-semibold text-[#006A9E] underline"
          >
            Gửi thông tin sự kiện
          </Link>
        </div>
      </ScrollReveal>

      {/* FAQs */}
      <ScrollReveal once y={18} className="space-y-4">
        <CinematicHeading
          as="h2"
          className="font-serif text-2xl font-medium text-[#14222E]"
        >
          Câu hỏi thường gặp
        </CinematicHeading>
        <div className="divide-y divide-[#EFECE4] bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] px-6">
          {(settings?.faqs || []).map((faq) => {
            const isOpen = openId === faq.id;
            return (
              <div key={faq.id} className="py-4">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full min-h-[44px] flex items-center justify-between gap-4 text-left py-2"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15px] font-semibold text-[#14222E]">{faq.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#006A9E] shrink-0 transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="pt-2.5 text-sm text-[#5C6F80] leading-relaxed space-y-1.5">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollReveal>

      <ScrollReveal once y={18}>
        <section className="p-6 rounded-2xl bg-[#F8F5EE] border border-[#EFECE4] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-serif text-lg font-medium text-[#14222E]">
              Bạn cần tìm hiểu thêm về chính sách giao nhận hoặc đánh giá?
            </p>
            <p className="text-xs text-[#5C6F80] mt-0.5">
              Xem đầy đủ hệ thống chính sách hoặc gửi tin nhắn trực tiếp cho Hoa Nelly.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/chinh-sach"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] text-xs font-semibold text-[#14222E]"
            >
              Xem chính sách
            </Link>
            <Link
              to="/lien-he"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold"
            >
              Liên hệ Hoa Nelly
            </Link>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
