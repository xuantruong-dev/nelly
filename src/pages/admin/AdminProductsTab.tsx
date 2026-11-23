import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, ImagePlus, Pencil, Plus, X } from 'lucide-react';
import type { AvailabilityStatus, Category, PricingType, Product } from '../../../shared/types.ts';
import {
  AVAILABILITY_LABELS,
  formatProductPrice,
  uploadImagesWithStats,
} from '../../lib/format.ts';
import { SafeImage } from '../../components/SafeImage.tsx';

interface Props {
  token: string;
  onChanged: () => void;
}

const EMPTY_FORM = {
  sku: '',
  slug: '',
  name: '',
  category_slug: 'hoa-bong-bay-nghe-thuat',
  pricing_type: 'fixed' as PricingType,
  base_price: '380000',
  original_price: '',
  availability_status: 'made_to_order' as AvailabilityStatus,
  prep_hours: '12',
  short_description: '',
  colors_text: 'Hồng pastel, Trắng kem',
  occasions_text: 'sinh-nhat, ky-niem',
  images: [] as string[],
  is_featured: false,
  is_active: true,
  is_demo_sample: false,
};

export function AdminProductsTab({ token, onChanged }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/products', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setProducts(json.items || []);
      setCategories(json.categories || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [token]);

  const startCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setMsg(null);
    setShowForm(true);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      sku: p.sku,
      slug: p.slug,
      name: p.name,
      category_slug: p.category_slug,
      pricing_type: p.pricing_type,
      base_price: p.base_price !== null ? String(p.base_price) : '',
      original_price: p.original_price !== null ? String(p.original_price) : '',
      availability_status: p.availability_status,
      prep_hours: String(p.prep_hours),
      short_description: p.short_description,
      colors_text: p.colors.join(', '),
      occasions_text: p.occasions.join(', '),
      images: p.images,
      is_featured: p.is_featured,
      is_active: p.is_active,
      is_demo_sample: p.is_demo_sample,
    });
    setMsg(null);
    setShowForm(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setUploading(true);
    setUploadNote(null);
    setMsg(null);
    try {
      const { urls, stats } = await uploadImagesWithStats(e.target.files);
      setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
      if (stats.length > 0) {
        const orig = stats.reduce((s, item) => s + item.originalBytes, 0);
        const opt = stats.reduce((s, item) => s + item.optimizedBytes, 0);
        const pct = orig > 0 ? Math.max(0, Math.round(((orig - opt) / orig) * 100)) : 0;
        setUploadNote(
          `Đã tối ưu ${stats.length} ảnh sang WebP (${Math.round(opt / 1024)} KB${
            pct > 0 ? `, giảm ${pct}%` : ''
          }).`
        );
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Lỗi tải ảnh.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const existing = editingId ? products.find((p) => p.id === editingId) : null;
    const payload = {
      sku: form.sku,
      slug:
        form.slug ||
        form.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/đ/g, 'd')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      name: form.name,
      category_slug: form.category_slug,
      pricing_type: form.pricing_type,
      base_price: form.pricing_type === 'quote' ? null : Number(form.base_price || 0),
      original_price: form.original_price ? Number(form.original_price) : null,
      availability_status: form.availability_status,
      prep_hours: Number(form.prep_hours || 12),
      short_description: form.short_description,
      colors: form.colors_text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      occasions: form.occasions_text
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      images: form.images,
      variants: existing?.variants || [],
      addons: existing?.addons || [],
      personalization: existing?.personalization || {
        allow_card_message: true,
        allow_custom_text: false,
        custom_text_surcharge: 0,
        allow_reference_image: true,
        allow_note: true,
        allow_theme_input: false,
      },
      specs: existing?.specs || {
        components: '',
        dimensions: '',
        materials: '',
        included_accessories: '',
        customizable_parts: '',
        care_guide: 'Đặt nơi thoáng mát, tránh ánh nắng trực tiếp và vật nhọn.',
        prep_time: `Tối thiểu ${form.prep_hours || 12} giờ.`,
        delivery_notes: '',
        store_notes: '',
      },
      is_featured: form.is_featured,
      is_active: form.is_active,
      is_demo_sample: form.is_demo_sample,
    };

    try {
      const url = editingId ? `/api/admin/products/${editingId}` : '/api/admin/products';
      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error || 'Không thể lưu sản phẩm.');
        return;
      }
      setShowForm(false);
      await load();
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: number) => {
    await fetch(`/api/admin/products/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
    onChanged();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#14222E]">
            Quản lý sản phẩm ({products.length})
          </h2>
          <p className="text-xs text-[#5C6F80]">
            Thêm mới, chỉnh sửa giá/biến thể, cập nhật hình ảnh hoặc tạm ẩn sản phẩm.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-xs font-semibold hover:bg-[#EC9EB5]"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm sản phẩm mới</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          className="bg-[#FDFBF7] rounded-2xl border border-[#E093AB] p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg font-semibold text-[#14222E]">
              {editingId ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm mới'}
            </h3>
            <button type="button" onClick={() => setShowForm(false)}>
              <X className="w-5 h-5 text-[#5C6F80]" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">Tên sản phẩm *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Mã SKU *</label>
              <input
                type="text"
                required
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
                placeholder="HN-HBB-010"
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Đường dẫn (slug)</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="tu-dong-tao-neu-de-trong"
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Danh mục</label>
              <select
                value={form.category_slug}
                onChange={(e) => setForm({ ...form, category_slug: e.target.value })}
                className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
              >
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Hình thức giá</label>
              <select
                value={form.pricing_type}
                onChange={(e) =>
                  setForm({ ...form, pricing_type: e.target.value as PricingType })
                }
                className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
              >
                <option value="fixed">Giá cố định</option>
                <option value="from">Giá từ (cấu hình cơ bản)</option>
                <option value="quote">Liên hệ báo giá</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Giá bán (VNĐ)</label>
              <input
                type="number"
                disabled={form.pricing_type === 'quote'}
                value={form.base_price}
                onChange={(e) => setForm({ ...form, base_price: e.target.value })}
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg disabled:bg-[#F8F5EE]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Giá gốc (chỉ nhập nếu có giảm giá thật)
              </label>
              <input
                type="number"
                value={form.original_price}
                onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Trạng thái nhận đặt</label>
              <select
                value={form.availability_status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    availability_status: e.target.value as AvailabilityStatus,
                  })
                }
                className="w-full px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
              >
                <option value="in_stock">Nhận làm trong ngày</option>
                <option value="made_to_order">Nhận đặt làm thủ công</option>
                <option value="paused">Tạm ngừng nhận đặt</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Thời gian chuẩn bị (giờ)</label>
              <input
                type="number"
                min={1}
                value={form.prep_hours}
                onChange={(e) => setForm({ ...form, prep_hours: e.target.value })}
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium mb-1">
                Tông màu (ngăn cách bằng dấu phẩy)
              </label>
              <input
                type="text"
                value={form.colors_text}
                onChange={(e) => setForm({ ...form, colors_text: e.target.value })}
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Dịp tặng slug (sinh-nhat, tot-nghiep, ky-niem, khai-truong...)
              </label>
              <input
                type="text"
                value={form.occasions_text}
                onChange={(e) => setForm({ ...form, occasions_text: e.target.value })}
                className="w-full px-3 py-2 border border-[#EFECE4] rounded-lg font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1">Mô tả ngắn</label>
            <textarea
              rows={2}
              value={form.short_description}
              onChange={(e) => setForm({ ...form, short_description: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-[#EFECE4] rounded-lg"
            />
          </div>

          {/* Images */}
          <div className="space-y-2">
            <label className="block text-xs font-medium">Ảnh sản phẩm</label>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#EFECE4] text-xs cursor-pointer hover:bg-[#F9E1E8]">
                <ImagePlus className="w-4 h-4 text-[#006A9E]" />
                <span>{uploading ? 'Đang tải...' : 'Tải ảnh lên'}</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
              {form.images.map((img, i) => (
                <div key={i} className="relative w-14 h-14">
                  <SafeImage
                    src={img}
                    alt={`Ảnh sản phẩm ${i + 1}`}
                    preset="thumbnail"
                    wrapperClassName="w-14 h-14 rounded-lg border border-[#EFECE4]"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))
                    }
                    className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-[#14222E] text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            {uploadNote && <p className="text-[11px] text-[#0B7A53] mt-1.5">{uploadNote}</p>}
          </div>

          <div className="flex flex-wrap gap-5 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                className="accent-[#006A9E]"
              />
              <span>Hiển thị ở mục Sản phẩm nổi bật</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="accent-[#006A9E]"
              />
              <span>Hiển thị công khai</span>
            </label>
          </div>

          {msg && <p className="text-xs text-red-700">{msg}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold"
            >
              {saving ? 'Đang lưu...' : 'Lưu sản phẩm'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-lg border border-[#EFECE4] text-xs"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[#5C6F80]">Đang tải danh sách sản phẩm...</p>
      ) : (
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FDFBF7] border-b border-[#EFECE4] text-xs text-[#5C6F80]">
              <tr>
                <th className="py-3 px-4">Sản phẩm</th>
                <th className="py-3 px-4">Danh mục</th>
                <th className="py-3 px-4">Giá</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4">Đánh giá</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]">
              {products.map((p) => (
                <tr key={p.id} className={!p.is_active ? 'opacity-55' : ''}>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <SafeImage
                        src={p.images[0]}
                        alt={p.name}
                        preset="thumbnail"
                        wrapperClassName="w-10 h-12 rounded-lg shrink-0"
                        className="w-full h-full object-cover"
                      />
                      <div>
                        <p className="font-medium text-[#14222E]">{p.name}</p>
                        <p className="text-xs text-[#5C6F80] font-mono">
                          {p.sku}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#5C6F80]">{p.category_name}</td>
                  <td className="py-3 px-4 font-medium text-[#006A9E] tabular-nums whitespace-nowrap">
                    {formatProductPrice(p)}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#5C6F80]">
                    {AVAILABILITY_LABELS[p.availability_status]}
                    <span className="block">{p.is_active ? 'Đang hiển thị' : 'Đang ẩn'}</span>
                  </td>
                  <td className="py-3 px-4 text-xs tabular-nums">
                    {p.review_count > 0 ? `${p.rating_avg}★ (${p.review_count})` : 'Chưa có'}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EFECE4] text-xs hover:bg-[#F9E1E8]"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Sửa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggle(p.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EFECE4] text-xs hover:bg-[#F9E1E8]"
                    >
                      {p.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{p.is_active ? 'Ẩn' : 'Hiện'}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
