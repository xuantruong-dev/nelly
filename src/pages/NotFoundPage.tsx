import { Link } from 'react-router-dom';
import { usePageMeta } from '../lib/format.ts';

export function NotFoundPage() {
  usePageMeta('Không tìm thấy trang – Hoa Nelly', 'Đường dẫn bạn truy cập không tồn tại trên Hoa Nelly.');

  return (
    <div className="max-w-xl mx-auto px-5 py-12 sm:py-24 text-center space-y-5">
      <p className="font-mono text-sm text-[#006A9E]">404</p>
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#14222E]">
        Trang bạn tìm hiện không tồn tại
      </h1>
      <p className="text-sm text-[#5C6F80] leading-relaxed">
        Có thể đường dẫn đã thay đổi hoặc mẫu sản phẩm đã được cập nhật. Bạn có thể quay về trang chủ hoặc khám phá danh mục sản phẩm của Hoa Nelly.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link
          to="/"
          className="px-6 py-3 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5]"
        >
          Về trang chủ
        </Link>
        <Link
          to="/san-pham"
          className="px-6 py-3 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] text-sm font-medium text-[#14222E] hover:bg-[#F9E1E8]"
        >
          Xem danh mục sản phẩm
        </Link>
      </div>
    </div>
  );
}
