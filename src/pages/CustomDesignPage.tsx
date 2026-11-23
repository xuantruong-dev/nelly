import React, { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ImagePlus, X } from 'lucide-react';
import { getLocalDateIso, uploadImages, usePageMeta } from '../lib/format.ts';
import { fetchJson } from '../lib/api.ts';
import { SafeImage } from '../components/SafeImage.tsx';

const PRODUCT_TYPES = [
  'Bó hoa bóng bay nghệ thuật',
  'Tạo hình nhân vật kết hợp hoa',
  'Túi / Hộp quà hoa bóng bay',
  'Bó bóng pha lê in chữ riêng',
  'Cụm hoa để bàn trưng bày',
  'Ý tưởng kết hợp khác',
];

const OCCASION_OPTIONS = [
  'Sinh nhật',
  'Tốt nghiệp',
  'Kỷ niệm',
  'Quà tặng người thương',
  'Khai trương',
  'Sự kiện / Tiệc',
  'Dịp khác',
];

export function CustomDesignPage() {
  const [searchParams] = useSearchParams();
  const presetSample = searchParams.get('mau') || '';

  usePageMeta(
    'Đặt thiết kế theo yêu cầu – Hoa Nelly',
    'Gửi ý tưởng màu sắc, tạo hình nhân vật, lời chúc cá nhân hóa và ảnh tham khảo để Hoa Nelly thiết kế món quà mang dấu ấn riêng.'
  );

  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `tk-${Date.now()}`
  );

  const [productType, setProductType] = useState(PRODUCT_TYPES[0]);
  const [occasion, setOccasion] = useState(OCCASION_OPTIONS[0]);
  const [colors, setColors] = useState('');
  const [themeCharacter, setThemeCharacter] = useState(presetSample ? `Tương tự mẫu: ${presetSample}` : '');
  const [desiredSize, setDesiredSize] = useState('');
  const [personalizationText, setPersonalizationText] = useState('');
  const [budget, setBudget] = useState('');
  const [neededDate, setNeededDate] = useState('');
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    if (referenceImages.length + e.target.files.length > 4) {
      setError('Tối đa 4 ảnh tham khảo.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const urls = await uploadImages(e.target.files);
      setReferenceImages((prev) => [...prev, ...urls].slice(0, 4));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải ảnh tham khảo.');
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
      const json = await fetchJson<{ reference_code: string }>('/api/custom-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        fallbackError: 'Không thể gửi yêu cầu.',
        body: JSON.stringify({
          idempotency_key: idempotencyKeyRef.current,
          website_url: honeypot,
          product_type: productType,
          occasion,
          colors,
          theme_character: themeCharacter,
          desired_size: desiredSize,
          personalization_text: personalizationText,
          budget,
          needed_date: neededDate,
          reference_images: referenceImages,
          customer_name: customerName,
          customer_phone: customerPhone,
          customer_email: customerEmail,
          customer_note: customerNote,
        }),
      });
      setSubmittedCode(json.reference_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối khi gửi yêu cầu thiết kế riêng.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FDFBF7]">
      {/* Custom Design Hero Banner (exact unmodified artwork, responsive WebP + PNG fallback) */}
      <section className="relative -mt-[64px] sm:-mt-[74px] w-full bg-white border-b border-[#EFECE4]">
        <h1 className="sr-only">Đặt thiết kế theo yêu cầu</h1>
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet="/assets/aistudio/custom_design_banner_640.webp"
            type="image/webp"
          />
          <source
            media="(max-width: 960px)"
            srcSet="/assets/aistudio/custom_design_banner_960.webp"
            type="image/webp"
          />
          <source
            srcSet="/assets/aistudio/custom_design_banner.webp"
            type="image/webp"
          />
          <img
            src="/assets/aistudio/79f06a33-c247-4b71-ab94-b0d56e40c74d_9a76b4e0.png"
            alt="Đặt thiết kế theo yêu cầu - Chọn ý tưởng, gửi yêu cầu, nhận tư vấn và báo giá, hoàn thiện và giao hàng tại Hoa Nelly"
            width={1754}
            height={896}
            decoding="async"
            fetchPriority="high"
            draggable={false}
            className="block w-full max-w-[1920px] mx-auto h-auto select-none"
          />
        </picture>
      </section>

      <div className="hn-container py-12 sm:py-14 lg:py-16">
      {submittedCode ? (
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#E093AB] p-8 text-center space-y-4">
          <CheckCircle2 className="w-11 h-11 mx-auto text-[#0B7A53]" />
          <h2 className="font-serif text-2xl font-semibold text-[#14222E]">
            Đã tiếp nhận yêu cầu thiết kế riêng
          </h2>
          <p className="text-sm text-[#5C6F80]">
            Mã tham chiếu của bạn là{' '}
            <strong className="font-mono text-[#006A9E]">{submittedCode}</strong>. Trạng thái hiện tại: <strong className="text-[#14222E]">Mới tiếp nhận</strong>.
          </p>
          <p className="text-xs text-[#5C6F80] max-w-md mx-auto">
            Đội ngũ Hoa Nelly sẽ xem ảnh tham khảo, kiểm tra lịch thực hiện và liên hệ tư vấn báo giá qua số điện thoại bạn đã cung cấp.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link
              to="/san-pham"
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-sm font-medium"
            >
              Khám phá thêm mẫu hoa
            </Link>
            <button
              type="button"
              onClick={() => {
                setSubmittedCode(null);
                idempotencyKeyRef.current = `tk-${Date.now()}`;
              }}
              className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg border border-[#EFECE4] text-sm text-[#14222E]"
            >
              Gửi thêm yêu cầu khác
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 sm:p-8 space-y-6"
        >
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Loại sản phẩm muốn đặt <span className="text-red-700">*</span>
              </label>
              <select
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
              >
                {PRODUCT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Dịp sử dụng <span className="text-red-700">*</span>
              </label>
              <select
                value={occasion}
                onChange={(e) => setOccasion(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
              >
                {OCCASION_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Tông màu mong muốn
              </label>
              <input
                type="text"
                value={colors}
                onChange={(e) => setColors(e.target.value)}
                placeholder="VD: Hồng phấn – trắng kem – nơ vàng đồng"
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Chủ đề hoặc nhân vật
              </label>
              <input
                type="text"
                value={themeCharacter}
                onChange={(e) => setThemeCharacter(e.target.value)}
                placeholder="VD: Cử nhân nữ tóc dài, thỏ trắng, bó tulip tối giản..."
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Kích thước mong muốn
              </label>
              <input
                type="text"
                value={desiredSize}
                onChange={(e) => setDesiredSize(e.target.value)}
                placeholder="VD: Cỡ vừa cầm tay (~50cm) hoặc cỡ lớn nổi bật (~75cm)"
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
                placeholder="VD: 400.000₫ – 600.000₫"
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Ngày cần nhận <span className="text-red-700">*</span>
              </label>
              <input
                type="date"
                required
                min={getLocalDateIso(0)}
                value={neededDate}
                onChange={(e) => setNeededDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Nội dung cá nhân hóa (tên, lời chúc trên bóng/thiệp)
              </label>
              <input
                type="text"
                value={personalizationText}
                onChange={(e) => setPersonalizationText(e.target.value)}
                placeholder="VD: Chúc mừng tốt nghiệp Thảo Vy"
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>
          </div>

          {/* Reference Image Upload */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[#14222E]">
              Ảnh tham khảo (tối đa 4 ảnh · JPG, PNG, WebP · ≤ 5MB/ảnh)
            </label>
            <div className="flex flex-wrap items-center gap-3">
              {referenceImages.length < 4 && (
                <label className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg border border-[#EFECE4] text-xs font-medium text-[#14222E] hover:bg-[#F9E1E8] cursor-pointer">
                  <ImagePlus className="w-4 h-4 text-[#006A9E]" />
                  <span>{uploading ? 'Đang tải lên...' : 'Tải ảnh tham khảo'}</span>
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
                    alt={`Ảnh tham khảo ${idx + 1}`}
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

          <div className="pt-4 border-t border-[#EFECE4] space-y-4">
            <h2 className="font-serif text-lg font-semibold text-[#14222E]">Thông tin liên hệ</h2>
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
                Mô tả thêm ý tưởng hoặc yêu cầu giao nhận
              </label>
              <textarea
                rows={3}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Chia sẻ thêm chi tiết bạn mong muốn..."
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
            className="w-full sm:w-auto min-h-[48px] px-8 py-3.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] disabled:opacity-50"
          >
            {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu thiết kế riêng'}
          </button>
        </form>
      )}
      </div>
    </div>
  );
}
