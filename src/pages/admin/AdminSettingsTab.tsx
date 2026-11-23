import React, { useEffect, useState } from 'react';
import { ImagePlus, Plus, Trash2 } from 'lucide-react';
import type { GalleryItem, PromoCode, StoreSettings } from '../../../shared/types.ts';
import {
  GALLERY_TYPE_LABELS,
  formatVnd,
  uploadImagesWithStats,
} from '../../lib/format.ts';
import { SafeImage } from '../../components/SafeImage.tsx';

interface Props {
  token: string;
  onSaved: () => void;
}

export function AdminSettingsTab({ token, onSaved }: Props) {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // New promo form
  const [promoCode, setPromoCode] = useState('');
  const [promoType, setPromoType] = useState<'fixed' | 'percent'>('fixed');
  const [promoVal, setPromoVal] = useState('30000');
  const [promoMin, setPromoMin] = useState('300000');

  // New gallery form
  const [galTitle, setGalTitle] = useState('');
  const [galCat, setGalCat] = useState('Hoa bóng bay nghệ thuật');
  const [galType, setGalType] = useState<'sample_product' | 'reference_idea' | 'completed_project'>(
    'completed_project'
  );
  const [galCaption, setGalCaption] = useState('');
  const [galUrl, setGalUrl] = useState('');
  const [galUploadNote, setGalUploadNote] = useState<string | null>(null);
  const [uploadingGal, setUploadingGal] = useState(false);

  const loadAll = async () => {
    const headers = { Authorization: `Bearer ${token}` };
    const [sRes, pRes, gRes] = await Promise.all([
      fetch('/api/admin/settings', { headers }),
      fetch('/api/admin/promos', { headers }),
      fetch('/api/admin/gallery', { headers }),
    ]);
    const sJson = await sRes.json();
    const pJson = await pRes.json();
    const gJson = await gRes.json();
    setSettings(sJson.settings);
    setPromos(pJson.items || []);
    setGallery(gJson.items || []);
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSavedNotice(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSavedNotice('Đã lưu cấu hình cửa hàng thành công.');
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/promos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code: promoCode,
        discount_type: promoType,
        discount_value: Number(promoVal),
        min_order_amount: Number(promoMin),
      }),
    });
    if (res.ok) {
      setPromoCode('');
      await loadAll();
    }
  };

  const handleDeletePromo = async (id: number) => {
    await fetch(`/api/admin/promos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAll();
  };

  const handleUploadGal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploadingGal(true);
    setGalUploadNote(null);
    try {
      const { urls, stats } = await uploadImagesWithStats([e.target.files[0]]);
      if (urls[0]) setGalUrl(urls[0]);
      if (stats[0]) {
        const s = stats[0];
        const pct =
          s.originalBytes > 0
            ? Math.max(0, Math.round(((s.originalBytes - s.optimizedBytes) / s.originalBytes) * 100))
            : 0;
        setGalUploadNote(
          `Đã tối ưu WebP (${Math.round(s.optimizedBytes / 1024)} KB${pct > 0 ? `, giảm ${pct}%` : ''}).`
        );
      }
    } finally {
      setUploadingGal(false);
      e.target.value = '';
    }
  };

  const handleAddGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galTitle || !galUrl) return;
    const res = await fetch('/api/admin/gallery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title: galTitle,
        category: galCat,
        image_type: galType,
        image_url: galUrl,
        caption: galCaption,
      }),
    });
    if (res.ok) {
      setGalTitle('');
      setGalCaption('');
      setGalUrl('');
      await loadAll();
    }
  };

  const handleDeleteGallery = async (id: number) => {
    await fetch(`/api/admin/gallery/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    await loadAll();
  };

  if (!settings) return <p className="text-sm text-[#5C6F80]">Đang tải cấu hình...</p>;

  return (
    <div className="space-y-8">
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Store Contact */}
        <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#14222E]">
            Thông tin thương hiệu &amp; liên hệ
          </h2>
          <p className="text-xs text-[#5C6F80]">
            Thông tin hiển thị trực tiếp ở chân trang và trang Liên hệ Hoa Nelly.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">Số điện thoại</label>
              <input
                type="text"
                value={settings.phone}
                onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                placeholder="0376434207"
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email liên hệ</label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                placeholder="xuantruong252000@gmail.com"
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Giờ hoạt động</label>
              <input
                type="text"
                value={settings.business_hours}
                onChange={(e) => setSettings({ ...settings, business_hours: e.target.value })}
                placeholder="7:00 - 23:00"
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Khu vực giao hàng</label>
              <input
                type="text"
                value={settings.delivery_area}
                onChange={(e) => setSettings({ ...settings, delivery_area: e.target.value })}
                placeholder="Tùy chọn"
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
          </div>
        </section>

        {/* Homepage Banner & Announcement */}
        <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#14222E]">
            Nội dung trang chủ &amp; Thanh thông báo
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">Tiêu đề chính (Hero)</label>
              <input
                type="text"
                value={settings.hero_title}
                onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Mô tả chính (Hero)</label>
              <input
                type="text"
                value={settings.hero_subtitle}
                onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })}
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
          </div>

          <div className="pt-2 space-y-2 text-sm">
            <label className="flex items-center gap-2 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={settings.announcement_enabled}
                onChange={(e) =>
                  setSettings({ ...settings, announcement_enabled: e.target.checked })
                }
                className="accent-[#006A9E]"
              />
              <span>Bật thanh thông báo đầu trang</span>
            </label>
            <input
              type="text"
              value={settings.announcement_text}
              onChange={(e) => setSettings({ ...settings, announcement_text: e.target.value })}
              placeholder="VD: Nhận giao hoa nội thành từ 08:30 – 20:00 mỗi ngày"
              className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg text-sm"
            />
          </div>
        </section>

        {/* Shipping, Capacity & Deposit */}
        <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-4">
          <h2 className="font-serif text-xl font-semibold text-[#14222E]">
            Giao nhận, lịch nhận đơn &amp; Đặt cọc
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">Cách tính phí giao</label>
              <select
                value={settings.shipping_fee_mode}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    shipping_fee_mode: e.target.value as 'pending_confirmation' | 'flat_rate',
                  })
                }
                className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
              >
                <option value="pending_confirmation">Chờ cửa hàng báo phí</option>
                <option value="flat_rate">Đồng giá cố định</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Phí giao đồng giá (VNĐ)</label>
              <input
                type="number"
                disabled={settings.shipping_fee_mode !== 'flat_rate'}
                value={settings.flat_shipping_fee ?? ''}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    flat_shipping_fee: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg disabled:bg-[#F8F5EE]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Giới hạn đơn / ngày</label>
              <input
                type="number"
                min={1}
                value={settings.daily_order_capacity}
                onChange={(e) =>
                  setSettings({ ...settings, daily_order_capacity: Number(e.target.value || 10) })
                }
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">% Đặt cọc (nếu bật)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={settings.deposit_percent}
                onChange={(e) =>
                  setSettings({ ...settings, deposit_percent: Number(e.target.value || 0) })
                }
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={settings.deposit_policy_enabled}
              onChange={(e) =>
                setSettings({ ...settings, deposit_policy_enabled: e.target.checked })
              }
              className="accent-[#006A9E]"
            />
            <span>Bật hiển thị khoản đặt cọc dự kiến trên trang đặt hàng</span>
          </label>
        </section>

        {savedNotice && <p className="text-sm text-[#0B7A53] font-medium">{savedNotice}</p>}

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5]"
        >
          {saving ? 'Đang lưu cấu hình...' : 'Lưu toàn bộ cài đặt cửa hàng'}
        </button>
      </form>

      {/* Promo Codes */}
      <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-4">
        <h2 className="font-serif text-xl font-semibold text-[#14222E]">Mã ưu đãi</h2>
        <form onSubmit={handleCreatePromo} className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
          <input
            type="text"
            required
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="Mã (VD: NELLY30)"
            className="px-3 py-2 border border-[#EFECE4] rounded-lg uppercase font-mono"
          />
          <select
            value={promoType}
            onChange={(e) => setPromoType(e.target.value as 'fixed' | 'percent')}
            className="px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
          >
            <option value="fixed">Giảm tiền (VNĐ)</option>
            <option value="percent">Giảm %</option>
          </select>
          <input
            type="number"
            required
            value={promoVal}
            onChange={(e) => setPromoVal(e.target.value)}
            placeholder="Mức giảm"
            className="px-3 py-2 border border-[#EFECE4] rounded-lg"
          />
          <input
            type="number"
            value={promoMin}
            onChange={(e) => setPromoMin(e.target.value)}
            placeholder="Đơn tối thiểu"
            className="px-3 py-2 border border-[#EFECE4] rounded-lg"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 px-4 py-2 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo mã</span>
          </button>
        </form>

        {promos.length === 0 ? (
          <p className="text-xs text-[#5C6F80]">Chưa có mã ưu đãi nào được tạo.</p>
        ) : (
          <div className="divide-y divide-[#EFECE4] text-sm">
            {promos.map((pr) => (
              <div key={pr.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-mono font-semibold text-[#006A9E]">{pr.code}</span>
                  <span className="text-xs text-[#5C6F80] ml-2">
                    Giảm{' '}
                    {pr.discount_type === 'percent'
                      ? `${pr.discount_value}%`
                      : formatVnd(pr.discount_value)}{' '}
                    · Đơn từ {formatVnd(pr.min_order_amount)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeletePromo(pr.id)}
                  className="text-xs text-red-700 hover:underline inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Xóa
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Gallery Management */}
      <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-4">
        <h2 className="font-serif text-xl font-semibold text-[#14222E]">
          Quản lý thư viện hình ảnh ({gallery.length})
        </h2>
        <p className="text-xs text-[#5C6F80]">
          Chỉ chọn loại &ldquo;Dự án đã thực hiện&rdquo; khi đăng ảnh thực tế có xác nhận của cửa hàng.
        </p>

        <form onSubmit={handleAddGallery} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
          <input
            type="text"
            required
            value={galTitle}
            onChange={(e) => setGalTitle(e.target.value)}
            placeholder="Tiêu đề ảnh"
            className="px-3 py-2 border border-[#EFECE4] rounded-lg"
          />
          <select
            value={galCat}
            onChange={(e) => setGalCat(e.target.value)}
            className="px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
          >
            <option>Hoa bóng bay nghệ thuật</option>
            <option>Tạo hình nhân vật</option>
            <option>Phụ kiện sinh nhật</option>
            <option>Trang trí sự kiện</option>
            <option>Quà tặng</option>
          </select>
          <select
            value={galType}
            onChange={(e) =>
              setGalType(
                e.target.value as 'sample_product' | 'reference_idea' | 'completed_project'
              )
            }
            className="px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
          >
            <option value="completed_project">Dự án đã thực hiện</option>
            <option value="sample_product">Sản phẩm tiêu biểu</option>
            <option value="reference_idea">Ảnh ý tưởng tham khảo</option>
          </select>
          <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-[#EFECE4] rounded-lg text-xs cursor-pointer hover:bg-[#F9E1E8]">
            <ImagePlus className="w-4 h-4 text-[#006A9E]" />
            <span>{uploadingGal ? 'Đang tải...' : galUrl ? 'Đã chọn ảnh' : 'Tải ảnh'}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleUploadGal}
              className="hidden"
            />
          </label>
          <button
            type="submit"
            disabled={!galUrl}
            className="px-4 py-2 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold disabled:opacity-40"
          >
            Thêm vào thư viện
          </button>
          {galUploadNote && (
            <p className="text-[11px] text-[#0B7A53] sm:col-span-2">{galUploadNote}</p>
          )}
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
          {gallery.map((g) => (
            <div key={g.id} className="border border-[#EFECE4] rounded-xl overflow-hidden text-xs">
              <div className="w-full aspect-square">
                <SafeImage src={g.image_url} alt={g.title} preset="thumbnail" />
              </div>
              <div className="p-2 space-y-1">
                <p className="font-medium truncate">{g.title}</p>
                <p className="text-[10px] text-[#5C6F80] truncate">
                  {GALLERY_TYPE_LABELS[g.image_type]}
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteGallery(g.id)}
                  className="text-[11px] text-red-700 hover:underline"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
