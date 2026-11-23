import { Link, useParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext.tsx';
import { CinematicHeading, ScrollReveal } from '../components/CinematicScroll.tsx';
import { usePageMeta } from '../lib/format.ts';

export function PoliciesPage() {
  const { slug } = useParams();
  const { settings } = useStore();
  const policies = settings?.policies || {};
  const policyEntries = Object.entries(policies);
  const activeKey = slug && policies[slug] ? slug : policyEntries[0]?.[0] || '';
  const activePolicy = activeKey ? policies[activeKey] : null;

  usePageMeta(
    activePolicy ? `${activePolicy.title} – Hoa Nelly` : 'Chính sách cửa hàng – Hoa Nelly',
    'Chính sách đặt hàng, giao nhận, thanh toán, đổi hủy, sản phẩm cá nhân hóa, bảo vệ thông tin và quy định đăng đánh giá tại Hoa Nelly.'
  );

  return (
    <div className="hn-page-shell">
      <div className="pb-6 border-b border-[#EFECE4]">
        <CinematicHeading
          as="h1"
          triggerOnScroll={false}
          className="font-serif text-3xl sm:text-4xl font-medium text-[#14222E]"
        >
          Chính sách &amp; Quy định
        </CinematicHeading>
        <p className="text-sm text-[#5C6F80] mt-1.5">
          Thông tin minh bạch giúp bạn yên tâm khi mua sắm, đặt thiết kế riêng và đánh giá sản phẩm tại Hoa Nelly.
        </p>
      </div>

      <ScrollReveal
        staggerSelector=".hn-reveal-item"
        once
        y={18}
        stagger={0.08}
        className="hn-grid-12 mt-8 items-start"
      >
        <aside className="hn-reveal-item lg:col-span-4 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-4 space-y-1">
          {policyEntries.map(([key, item]) => (
            <Link
              key={key}
              to={`/chinh-sach/${key}`}
              className={`flex flex-col justify-center min-h-[44px] px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
                activeKey === key
                  ? 'bg-[#F4B6C8]/70 text-[#4A1829] font-semibold'
                  : 'text-[#14222E] hover:bg-[#F9E1E8]'
              }`}
            >
              <span>{item.title}</span>
            </Link>
          ))}
        </aside>

        <article className="hn-reveal-item lg:col-span-8 bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 sm:p-8 space-y-4">
          {activePolicy ? (
            <>
              <div className="pb-4 border-b border-[#EFECE4]">
                <h2 className="font-serif text-2xl font-medium text-[#14222E]">
                  {activePolicy.title}
                </h2>
              </div>
              <div className="text-sm sm:text-[15px] text-[#14222E] leading-relaxed whitespace-pre-line">
                {activePolicy.content}
              </div>
            </>
          ) : (
            <p className="text-sm text-[#5C6F80]">Đang tải nội dung chính sách...</p>
          )}
        </article>
      </ScrollReveal>
    </div>
  );
}
