import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { CinematicHeading, ScrollReveal } from '../components/CinematicScroll.tsx';
import { usePageMeta } from '../lib/format.ts';
import { fetchJson } from '../lib/api.ts';

export function ContactPage() {
  const { settings } = useStore();
  const [searchParams] = useSearchParams();

  usePageMeta(
    'Liên hệ Hoa Nelly',
    'Thông tin liên hệ và biểu mẫu gửi câu hỏi, tư vấn mẫu hoa bóng bay nghệ thuật và trang trí sự kiện tại Hoa Nelly.'
  );

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [subject, setSubject] = useState(searchParams.get('chuDe') || '');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const json = await fetchJson<{ reference_code: string }>('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        fallbackError: 'Không thể gửi tin nhắn.',
        body: JSON.stringify({
          website_url: honeypot,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          subject,
          message,
        }),
      });
      setRefCode(json.reference_code);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerEmail('');
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối khi gửi tin nhắn.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="hn-page-shell">
      <div className="pb-6 border-b border-[#EFECE4] max-w-2xl">
        <CinematicHeading
          as="h1"
          triggerOnScroll={false}
          className="font-serif text-3xl sm:text-4xl font-medium text-[#14222E]"
        >
          Liên hệ Hoa Nelly
        </CinematicHeading>
        <p className="text-sm sm:text-[15px] text-[#5C6F80] mt-2">
          Gửi lời nhắn trực tiếp trên website hoặc kết nối qua các kênh đã được Hoa Nelly xác nhận.
        </p>
      </div>

      <ScrollReveal
        staggerSelector=".hn-reveal-item"
        once
        y={18}
        stagger={0.08}
        className="hn-grid-12 mt-8 items-start"
      >
        {/* Store Info Column */}
        <aside className="hn-reveal-item lg:col-span-5 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-5">
          <h2 className="font-serif text-xl font-semibold text-[#14222E]">
            Thông tin cửa hàng
          </h2>

          <dl className="space-y-3.5 text-sm">
            <div>
              <dt className="text-xs font-semibold text-[#5C6F80]">SỐ ĐIỆN THOẠI</dt>
              <dd className="mt-0.5 text-[#14222E]">
                <a
                  href={`tel:${(settings?.phone || '0376434207').replace(/\s+/g, '')}`}
                  className="inline-flex items-center min-h-[44px] sm:min-h-0 font-medium text-[#006A9E] hover:underline tabular-nums"
                >
                  {settings?.phone || '0376434207'}
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-[#5C6F80]">EMAIL</dt>
              <dd className="mt-0.5 text-[#14222E]">
                <a
                  href={`mailto:${settings?.email || 'xuantruong252000@gmail.com'}`}
                  className="inline-flex items-center min-h-[44px] sm:min-h-0 font-medium text-[#006A9E] hover:underline break-all"
                >
                  {settings?.email || 'xuantruong252000@gmail.com'}
                </a>
              </dd>
            </div>

            <div>
              <dt className="text-xs font-semibold text-[#5C6F80]">GIỜ HOẠT ĐỘNG</dt>
              <dd className="mt-0.5 text-[#14222E] tabular-nums">
                {settings?.business_hours || '7:00 - 23:00'}
              </dd>
            </div>

            {settings?.delivery_area && (
              <div>
                <dt className="text-xs font-semibold text-[#5C6F80]">KHU VỰC GIAO HÀNG</dt>
                <dd className="mt-0.5 text-[#14222E]">{settings.delivery_area}</dd>
              </div>
            )}
          </dl>
        </aside>

        {/* Contact Form */}
        <section className="hn-reveal-item lg:col-span-7 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 sm:p-8">
          <h2 className="font-serif text-xl font-semibold text-[#14222E] mb-1">
            Gửi lời nhắn cho Hoa Nelly
          </h2>
          <p className="text-xs text-[#5C6F80] mb-5">
            Tin nhắn của bạn được lưu trực tiếp trong hệ thống cửa hàng để đội ngũ phản hồi.
          </p>

          {refCode ? (
            <div className="p-6 rounded-xl bg-[#ECFDF5] border border-[#E093AB] text-center space-y-3">
              <CheckCircle2 className="w-9 h-9 mx-auto text-[#0B7A53]" />
              <p className="font-serif text-lg font-semibold text-[#14222E]">
                Đã gửi lời nhắn thành công
              </p>
              <p className="text-sm text-[#5C6F80]">
                Mã tham chiếu hỗ trợ: <strong className="font-mono text-[#006A9E]">{refCode}</strong>
              </p>
              <button
                type="button"
                onClick={() => setRefCode(null)}
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-[#FDFBF7] border border-[#EFECE4] text-xs font-medium"
              >
                Gửi lời nhắn mới
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Họ tên <span className="text-red-700">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
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
                    className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Email (tùy chọn)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#14222E] mb-1">
                    Chủ đề cần hỗ trợ
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="VD: Tư vấn mẫu hoa, kiểm tra lịch giao..."
                    className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Nội dung <span className="text-red-700">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Nhập câu hỏi hoặc yêu cầu hỗ trợ của bạn..."
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>

              {error && <p className="text-sm text-red-700">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="min-h-[48px] px-6 py-3 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] disabled:opacity-50"
              >
                {submitting ? 'Đang gửi...' : 'Gửi lời nhắn'}
              </button>
            </form>
          )}
        </section>
      </ScrollReveal>
    </div>
  );
}
