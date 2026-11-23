import React, { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ImagePlus, X } from 'lucide-react';
import { getLocalDateIso, uploadImages, usePageMeta } from '../lib/format.ts';
import { fetchJson } from '../lib/api.ts';
import { SafeImage } from '../components/SafeImage.tsx';
import { ScrollReveal } from '../components/CinematicScroll.tsx';
import { EventHeroSection } from '../components/EventHeroSection.tsx';

const EVENT_TYPES = [
  'Tiệc sinh nhật',
  'Khai trương cửa hàng / doanh nghiệp',
  'Tiệc kỷ niệm / Cầu hôn',
  'Tiệc thôi nôi / Đầy tháng',
  'Sự kiện nội bộ / Tốt nghiệp',
  'Sự kiện khác',
];

const DESIRED_ITEMS = [
  'Backdrop & khu vực chụp ảnh',
  'Cổng bóng bay đón khách',
  'Cụm bóng bay & hoa bóng đứng',
  'Trang trí bàn bánh / bàn gallery',
  'Bóng chữ tên & tuổi cá nhân hóa',
  'Bó hoa bóng bay tặng nhân vật chính',
];

const PACKAGES_OVERVIEW = [
  {
    eyebrow: 'Không gian nhỏ · Ấm cúng',
    name: 'Góc chụp ảnh & Bàn tiệc ấm cúng',
    scope: 'Phù hợp phòng gia đình, phòng riêng nhà hàng hoặc quán café.',
    includes: 'Cụm hoa bóng bay nghệ thuật, bóng trang trí bàn bánh và phối màu đồng bộ.',
    note: 'Hạng mục và báo giá chi tiết xác nhận theo kích thước không gian thực tế.',
  },
  {
    eyebrow: 'Tiệc vừa · Điểm nhấn rõ nét',
    name: 'Backdrop & Cụm bóng sự kiện',
    scope: 'Phù hợp tiệc sinh nhật quy mô vừa, tiệc kỷ niệm và sự kiện nhỏ.',
    includes: 'Backdrop in tên/chủ đề, viền cụm bóng nghệ thuật và phụ kiện đồng bộ.',
    note: 'Phụ phí vận chuyển, thi công và thu dọn (nếu có) sẽ được báo rõ trong bảng giá.',
  },
  {
    eyebrow: 'Cửa hàng · Doanh nghiệp',
    name: 'Trang trí khai trương thương hiệu',
    scope: 'Phù hợp mặt tiền cửa hàng, showroom, studio hoặc văn phòng.',
    includes: 'Cổng/cụm bóng bay theo màu thương hiệu, trụ hoa bóng đón khách.',
    note: 'Khuyến nghị gửi ảnh mặt bằng và cho biết vị trí trong nhà hay ngoài trời.',
  },
];

export function EventDecorationPage() {
  const [searchParams] = useSearchParams();
  const presetSample = searchParams.get('mau') || '';

  usePageMeta(
    'Dịch vụ trang trí sự kiện – Hoa Nelly',
    'Nhận tư vấn và báo giá trang trí sinh nhật, backdrop chụp ảnh, cổng bóng bay, bàn tiệc và khai trương theo không gian thực tế cùng Hoa Nelly.'
  );

  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `sk-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const [eventType, setEventType] = useState(EVENT_TYPES[0]);
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [location, setLocation] = useState('');
  const [venueSetting, setVenueSetting] = useState<'indoor' | 'outdoor' | 'both'>('indoor');
  const [scaleArea, setScaleArea] = useState('');
  const [styleColors, setStyleColors] = useState(
    presetSample ? `Quan tâm gói: ${presetSample}` : ''
  );
  const [desiredItems, setDesiredItems] = useState<string[]>([DESIRED_ITEMS[0], DESIRED_ITEMS[2]]);
  const [budget, setBudget] = useState('');
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const toggleItem = (label: string) => {
    setDesiredItems((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    if (referenceImages.length + e.target.files.length > 4) {
      setError('Tối đa 4 ảnh không gian / ảnh tham khảo.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const urls = await uploadImages(e.target.files);
      setReferenceImages((prev) => [...prev, ...urls].slice(0, 4));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải ảnh.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const json = await fetchJson<{ reference_code: string }>('/api/event-quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        fallbackError: 'Không thể gửi yêu cầu báo giá sự kiện.',
        body: JSON.stringify({
          idempotency_key: idempotencyKeyRef.current,
          website_url: honeypot,
          event_type: eventType,
          event_date: eventDate,
          event_time: eventTime,
          location,
          venue_setting: venueSetting,
          scale_area: scaleArea,
          style_colors: styleColors,
          desired_items: desiredItems,
          budget,
          reference_images: referenceImages,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_note: customerNote,
        }),
      });
      setSubmittedCode(json.reference_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối khi gửi yêu cầu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Opening Event Hero + Floating Service Bar + Natural White Service Discovery */}
      <EventHeroSection />

      <div className="hn-page-shell space-y-12 sm:space-y-14">
        {/* Transparent Service Scopes */}
        <div id="goi-dich-vu" className="scroll-mt-28">
          <ScrollReveal
            staggerSelector=".hn-reveal-item"
            once
            y={20}
            stagger={0.08}
            className="hn-grid-3"
          >
        {PACKAGES_OVERVIEW.map((pkg) => (
          <div
            key={pkg.name}
            className="hn-reveal-item bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2.5">
              <p className="text-[12.5px] font-medium text-[#006A9E]">{pkg.eyebrow}</p>
              <h2 className="font-serif text-xl font-medium text-[#14222E]">{pkg.name}</h2>
              <p className="text-sm text-[#4A5C6B] leading-relaxed">{pkg.scope}</p>
              <p className="text-xs text-[#14222E] pt-2 border-t border-[#EFECE4] leading-relaxed">
                <strong>Hạng mục tham khảo:</strong> {pkg.includes}
              </p>
            </div>
            <p className="text-xs text-[#5C6F80] italic">{pkg.note}</p>
          </div>
        ))}
          </ScrollReveal>
        </div>

      {/* Event Quote Form */}
      <section id="form-su-kien" className="scroll-mt-28">
        {submittedCode ? (
          <div className="bg-[#FDFBF7] rounded-2xl border border-[#E093AB] p-8 text-center space-y-4 max-w-2xl mx-auto">
            <CheckCircle2 className="w-11 h-11 mx-auto text-[#0B7A53]" />
            <h2 className="font-serif text-2xl font-semibold text-[#14222E]">
              Đã tiếp nhận yêu cầu báo giá sự kiện
            </h2>
            <p className="text-sm text-[#5C6F80]">
              Mã tham chiếu của bạn:{' '}
              <strong className="font-mono text-[#006A9E]">{submittedCode}</strong> · Trạng thái:{' '}
              <strong className="text-[#14222E]">Mới tiếp nhận</strong>.
            </p>
            <p className="text-xs text-[#5C6F80]">
              Hoa Nelly sẽ xem thông tin không gian, thời gian tổ chức và gửi đề xuất hạng mục kèm báo giá chi tiết qua số điện thoại bạn đã đăng ký.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmittedCode(null);
                idempotencyKeyRef.current =
                  typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `sk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
              }}
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg border border-[#EFECE4] text-sm text-[#14222E]"
            >
              Gửi yêu cầu sự kiện khác
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 sm:p-8 space-y-6"
          >
            <div>
              <h2 className="font-serif text-2xl font-semibold text-[#14222E]">
                Gửi thông tin sự kiện để nhận tư vấn
              </h2>
              <p className="text-sm text-[#5C6F80] mt-1">
                Càng nhiều thông tin về không gian và tông màu, bảng đề xuất của Hoa Nelly sẽ càng sát nhu cầu của bạn.
              </p>
            </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Loại sự kiện <span className="text-red-700">*</span>
                </label>
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Ngày tổ chức <span className="text-red-700">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={getLocalDateIso(0)}
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Thời gian diễn ra
                </label>
                <input
                  type="text"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  placeholder="VD: 18:00 – 21:00"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Địa điểm tổ chức <span className="text-red-700">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Địa chỉ nhà riêng, nhà hàng, quán café hoặc cửa hàng"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Không gian tổ chức
                </label>
                <select
                  value={venueSetting}
                  onChange={(e) =>
                    setVenueSetting(e.target.value as 'indoor' | 'outdoor' | 'both')
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                >
                  <option value="indoor">Trong nhà</option>
                  <option value="outdoor">Ngoài trời</option>
                  <option value="both">Kết hợp trong nhà &amp; ngoài trời</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Quy mô hoặc diện tích dự kiến
                </label>
                <input
                  type="text"
                  value={scaleArea}
                  onChange={(e) => setScaleArea(e.target.value)}
                  placeholder="VD: ~30 khách, khu backdrop ngang 3m"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Phong cách và tông màu
                </label>
                <input
                  type="text"
                  value={styleColors}
                  onChange={(e) => setStyleColors(e.target.value)}
                  placeholder="VD: Pastel kem – hồng phấn tối giản"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Ngân sách dự kiến (VNĐ)
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="VD: 2.000.000₫ – 5.000.000₫"
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>
            </div>

            {/* Desired Items Checklist */}
            <div className="space-y-2.5">
              <p className="text-xs font-medium text-[#14222E]">Các hạng mục mong muốn</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {DESIRED_ITEMS.map((item) => {
                  const checked = desiredItems.includes(item);
                  return (
                    <label
                      key={item}
                      className={`flex items-center gap-2.5 p-3 rounded-xl border text-sm cursor-pointer ${
                        checked
                          ? 'border-[#D47B97] bg-[#F8F5EE]/60 text-[#006A9E] font-medium'
                          : 'border-[#EFECE4] text-[#14222E]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleItem(item)}
                        className="accent-[#006A9E]"
                      />
                      <span>{item}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Space / Reference Photos */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[#14222E]">
                Ảnh không gian tổ chức hoặc ảnh tham khảo (tối đa 4 ảnh · ≤ 5MB/ảnh)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                {referenceImages.length < 4 && (
                  <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg border border-[#EFECE4] text-xs font-medium cursor-pointer hover:bg-[#F9E1E8]">
                    <ImagePlus className="w-4 h-4 text-[#006A9E]" />
                    <span>{uploading ? 'Đang tải lên...' : 'Tải ảnh không gian / tham khảo'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                )}
                {referenceImages.map((url, idx) => (
                  <div key={url} className="relative w-16 h-16">
                    <SafeImage
                      src={url}
                      alt={`Ảnh không gian ${idx + 1}`}
                      preset="thumbnail"
                      wrapperClassName="w-16 h-16 rounded-lg border border-[#EFECE4]"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setReferenceImages((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-3.5 -right-3.5 w-11 h-11 inline-flex items-center justify-center"
                      aria-label="Xóa ảnh"
                    >
                      <span className="w-6 h-6 rounded-full bg-[#14222E] text-white flex items-center justify-center shadow-sm">
                        <X className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div className="pt-4 border-t border-[#EFECE4] space-y-4">
              <h3 className="font-serif text-lg font-semibold text-[#14222E]">Thông tin liên hệ</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              </div>
              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Ghi chú thêm cho buổi sự kiện
                </label>
                <textarea
                  rows={3}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                  placeholder="Ví dụ: Thời gian có thể vào setup trước tiệc, quy định tòa nhà..."
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] disabled:opacity-50 transition-colors cursor-pointer"
            >
              {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu báo giá sự kiện'}
            </button>
          </form>
        )}
      </section>
      </div>
    </div>
  );
}
