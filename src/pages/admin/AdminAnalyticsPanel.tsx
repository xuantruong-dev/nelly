import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Calendar,
  Eye,
  Filter,
  MessageSquare,
  Palette,
  ShoppingBag,
  Star,
  TrendingUp,
} from 'lucide-react';
import type {
  AdminDashboardAnalytics,
  ContactMessage,
  CustomRequest,
  EventQuote,
  Order,
} from '../../../shared/types.ts';
import {
  CONTACT_STATUS_LABELS,
  INQUIRY_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  formatDateTimeVi,
  formatVnd,
  getVnPeriodKey,
} from '../../lib/format.ts';
import type { AdminDetailRecord } from './AdminDetailModal.tsx';

type ChartMetric = 'revenue' | 'orders' | 'consultations' | 'support_reviews';
type FeedFilter = 'all' | 'order' | 'custom_request' | 'event_quote' | 'contact';

interface AdminAnalyticsPanelProps {
  analytics: AdminDashboardAnalytics;
  granularity: 'week' | 'month';
  selectedPeriod: string;
  onChangeGranularity: (g: 'week' | 'month') => void;
  onSelectPeriod: (periodKey: string) => void;
  orders: Order[];
  customRequests: CustomRequest[];
  eventQuotes: EventQuote[];
  contacts: ContactMessage[];
  onOpenDetail: (record: AdminDetailRecord) => void;
  onJumpTab: (tab: 'orders' | 'consultations' | 'reviews') => void;
}

interface UnifiedInboxItem {
  uid: string;
  type: 'order' | 'custom_request' | 'event_quote' | 'contact';
  code: string;
  customerName: string;
  customerPhone: string;
  summary: string;
  statusLabel: string;
  isUrgent: boolean;
  amountLabel?: string;
  createdAt: string;
  record: AdminDetailRecord;
}

function formatCompactVnd(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}tỷ`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(val >= 10_000_000 ? 0 : 1)}tr`;
  if (val >= 1_000) return `${Math.round(val / 1_000)}k`;
  return String(Math.round(val));
}

export function AdminAnalyticsPanel({
  analytics,
  granularity,
  selectedPeriod,
  onChangeGranularity,
  onSelectPeriod,
  orders,
  customRequests,
  eventQuotes,
  contacts,
  onOpenDetail,
  onJumpTab,
}: AdminAnalyticsPanelProps) {
  const [chartMetric, setChartMetric] = useState<ChartMetric>('revenue');
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');

  const summary = analytics.summary;
  const buckets = analytics.buckets || [];
  const currentBucketKey = buckets.length > 0 ? buckets[buckets.length - 1].key : 'all';
  const activeBucket = buckets.find((b) => b.key === selectedPeriod) || null;

  const periodHeading = activeBucket
    ? activeBucket.label
    : granularity === 'week'
      ? 'Tất cả thời gian (so sánh 8 tuần gần nhất)'
      : 'Tất cả thời gian (so sánh 12 tháng gần nhất)';

  // Chart bar computation
  const chartBars = useMemo(() => {
    const items = buckets.map((b) => {
      if (chartMetric === 'revenue') {
        const primary = b.paid_revenue;
        const secondary = b.gross_revenue;
        return {
          bucket: b,
          value: Math.max(primary, secondary),
          primary,
          secondary,
          displayLabel: secondary > 0 ? formatCompactVnd(secondary) : '0',
          tooltip: `${b.label}: Đã thanh toán ${formatVnd(b.paid_revenue)} · Tổng đơn ${formatVnd(
            b.gross_revenue
          )} · Báo giá đã chốt ${formatVnd(b.quoted_confirmed_value)}`,
        };
      }
      if (chartMetric === 'orders') {
        return {
          bucket: b,
          value: b.orders_total,
          primary: b.orders_completed,
          secondary: b.orders_total,
          displayLabel: String(b.orders_total),
          tooltip: `${b.label}: ${b.orders_total} đơn (Hoàn tất: ${b.orders_completed}, Đang xử lý: ${b.orders_pending}, Hủy: ${b.orders_cancelled})`,
        };
      }
      if (chartMetric === 'consultations') {
        const total = b.custom_requests_total + b.event_quotes_total;
        return {
          bucket: b,
          value: total,
          primary: b.event_quotes_total,
          secondary: total,
          displayLabel: String(total),
          tooltip: `${b.label}: ${b.custom_requests_total} thiết kế riêng · ${b.event_quotes_total} sự kiện`,
        };
      }
      const total = b.contact_messages_total + b.questions_total + b.reviews_count;
      return {
        bucket: b,
        value: total,
        primary: b.reviews_count,
        secondary: total,
        displayLabel: String(total),
        tooltip: `${b.label}: ${b.contact_messages_total} liên hệ · ${b.questions_total} hỏi đáp · ${b.reviews_count} đánh giá (${b.reviews_avg_rating > 0 ? `${b.reviews_avg_rating}★` : '-'})`,
      };
    });
    const maxVal = Math.max(1, ...items.map((x) => x.value));
    return { items, maxVal };
  }, [buckets, chartMetric]);

  // Totals row for the visible buckets table
  const tableTotals = useMemo(() => {
    let ratingWeighted = 0;
    let ratingCount = 0;
    const acc = {
      paid_revenue: 0,
      gross_revenue: 0,
      quoted_confirmed_value: 0,
      orders_total: 0,
      orders_completed: 0,
      custom_requests_total: 0,
      event_quotes_total: 0,
      contact_messages_total: 0,
      questions_total: 0,
      reviews_count: 0,
    };
    for (const b of buckets) {
      acc.paid_revenue += b.paid_revenue;
      acc.gross_revenue += b.gross_revenue;
      acc.quoted_confirmed_value += b.quoted_confirmed_value;
      acc.orders_total += b.orders_total;
      acc.orders_completed += b.orders_completed;
      acc.custom_requests_total += b.custom_requests_total;
      acc.event_quotes_total += b.event_quotes_total;
      acc.contact_messages_total += b.contact_messages_total;
      acc.questions_total += b.questions_total;
      acc.reviews_count += b.reviews_count;
      if (b.reviews_count > 0) {
        ratingWeighted += b.reviews_avg_rating * b.reviews_count;
        ratingCount += b.reviews_count;
      }
    }
    return {
      ...acc,
      avg_rating: ratingCount > 0 ? Math.round((ratingWeighted / ratingCount) * 10) / 10 : 0,
    };
  }, [buckets]);

  // Unified recent incoming records across all 4 intake flows
  const unifiedFeed = useMemo<UnifiedInboxItem[]>(() => {
    const matchesPeriod = (createdAt: string) =>
      selectedPeriod === 'all' || getVnPeriodKey(createdAt, granularity) === selectedPeriod;

    const list: UnifiedInboxItem[] = [];

    for (const ord of orders) {
      if (!matchesPeriod(ord.created_at)) continue;
      list.push({
        uid: `order-${ord.id}`,
        type: 'order',
        code: ord.order_code,
        customerName: ord.customer_name,
        customerPhone: ord.customer_phone,
        summary: `${ord.items.length} sản phẩm · Giao ${ord.desired_date} (${ord.desired_time_slot})`,
        statusLabel: ORDER_STATUS_LABELS[ord.status],
        isUrgent: ord.status === 'pending_confirmation',
        amountLabel: formatVnd(ord.total_amount),
        createdAt: ord.created_at,
        record: { type: 'order', data: ord },
      });
    }

    for (const req of customRequests) {
      if (!matchesPeriod(req.created_at)) continue;
      list.push({
        uid: `custom-${req.id}`,
        type: 'custom_request',
        code: req.reference_code,
        customerName: req.customer_name,
        customerPhone: req.customer_phone,
        summary: `${req.product_type} · Dịp: ${req.occasion} · Cần ngày ${req.needed_date}`,
        statusLabel: INQUIRY_STATUS_LABELS[req.status],
        isUrgent: req.status === 'new' || req.status === 'consulting',
        amountLabel: req.quoted_price !== null ? formatVnd(req.quoted_price) : req.budget || undefined,
        createdAt: req.created_at,
        record: { type: 'custom_request', data: req },
      });
    }

    for (const ev of eventQuotes) {
      if (!matchesPeriod(ev.created_at)) continue;
      list.push({
        uid: `event-${ev.id}`,
        type: 'event_quote',
        code: ev.reference_code,
        customerName: ev.customer_name,
        customerPhone: ev.customer_phone,
        summary: `${ev.event_type} · Ngày ${ev.event_date} · ${ev.location}`,
        statusLabel: INQUIRY_STATUS_LABELS[ev.status],
        isUrgent: ev.status === 'new' || ev.status === 'consulting',
        amountLabel: ev.quoted_price !== null ? formatVnd(ev.quoted_price) : ev.budget || undefined,
        createdAt: ev.created_at,
        record: { type: 'event_quote', data: ev },
      });
    }

    for (const c of contacts) {
      if (!matchesPeriod(c.created_at)) continue;
      list.push({
        uid: `contact-${c.id}`,
        type: 'contact',
        code: c.reference_code,
        customerName: c.customer_name,
        customerPhone: c.customer_phone,
        summary: `${c.subject}: ${c.message.slice(0, 75)}${c.message.length > 75 ? '…' : ''}`,
        statusLabel: CONTACT_STATUS_LABELS[c.status],
        isUrgent: c.status === 'new',
        createdAt: c.created_at,
        record: { type: 'contact', data: c },
      });
    }

    list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    if (feedFilter === 'all') return list;
    return list.filter((item) => item.type === feedFilter);
  }, [orders, customRequests, eventQuotes, contacts, selectedPeriod, granularity, feedFilter]);

  const typeBadge = (type: UnifiedInboxItem['type']) => {
    switch (type) {
      case 'order':
        return { label: 'Đặt hàng', cls: 'bg-[#E6F2FA] text-[#005582] border-[#B6DAF0]' };
      case 'custom_request':
        return { label: 'Thiết kế riêng', cls: 'bg-[#F9E1E8] text-[#4A1829] border-[#E093AB]' };
      case 'event_quote':
        return { label: 'Sự kiện', cls: 'bg-[#F3E8D2] text-[#6B4610] border-[#D9C08B]' };
      case 'contact':
        return { label: 'Hỗ trợ', cls: 'bg-[#ECE3F5] text-[#4C246E] border-[#CFC0E3]' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Period Selector Toolbar */}
      <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#006A9E]">
            Báo cáo kinh doanh &amp; vận hành
          </p>
          <h2 className="font-serif text-xl font-semibold text-[#14222E] mt-0.5">
            {periodHeading}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity Segmented Control */}
          <div className="inline-flex rounded-xl border border-[#EFECE4] bg-[#F8F5EE]/65 p-1 text-xs">
            <button
              type="button"
              onClick={() => onChangeGranularity('week')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                granularity === 'week'
                  ? 'bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB]'
                  : 'text-[#14222E] hover:bg-[#FDFBF7]'
              }`}
            >
              Theo tuần
            </button>
            <button
              type="button"
              onClick={() => onChangeGranularity('month')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                granularity === 'month'
                  ? 'bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB]'
                  : 'text-[#14222E] hover:bg-[#FDFBF7]'
              }`}
            >
              Theo tháng
            </button>
          </div>

          {/* Period Select */}
          <div className="inline-flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#5C6F80]" />
            <select
              aria-label="Chọn kỳ thống kê"
              value={selectedPeriod}
              onChange={(e) => onSelectPeriod(e.target.value)}
              className="px-3 py-2 text-xs font-medium bg-[#FDFBF7] border border-[#EFECE4] rounded-xl text-[#14222E]"
            >
              <option value="all">Tất cả thời gian</option>
              {[...buckets].reverse().map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Current Period / Reset Buttons */}
          <button
            type="button"
            onClick={() => onSelectPeriod(selectedPeriod === currentBucketKey ? 'all' : currentBucketKey)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              selectedPeriod === currentBucketKey
                ? 'bg-[#F4B6C8] text-[#4A1829] border-[#E093AB]'
                : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:bg-[#F9E1E8]'
            }`}
          >
            {granularity === 'week' ? 'Tuần này' : 'Tháng này'}
          </button>

          {selectedPeriod !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectPeriod('all')}
              className="px-3 py-2 rounded-xl text-xs font-medium border border-[#EFECE4] bg-[#FDFBF7] text-[#5C6F80] hover:text-[#14222E]"
            >
              Xem tất cả
            </button>
          )}
        </div>
      </div>

      {/* 4 Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C6F80]">
            <span>Doanh số đã thanh toán</span>
            <TrendingUp className="w-4 h-4 text-[#006A9E]" />
          </div>
          <p className="text-2xl font-semibold text-[#006A9E] tabular-nums">
            {formatVnd(summary.paid_revenue)}
          </p>
          <div className="text-[11px] text-[#5C6F80] space-y-0.5 tabular-nums pt-1 border-t border-[#EFECE4]/70">
            <p>Tổng đơn (không hủy): <strong className="text-[#14222E]">{formatVnd(summary.gross_revenue)}</strong></p>
            <p>Đơn hoàn tất: <strong className="text-[#14222E]">{formatVnd(summary.completed_revenue)}</strong></p>
            <p>Báo giá đã chốt: <strong className="text-[#14222E]">{formatVnd(summary.quoted_confirmed_value)}</strong></p>
          </div>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C6F80]">
            <span>Đơn hàng</span>
            <ShoppingBag className="w-4 h-4 text-[#006A9E]" />
          </div>
          <p className="text-2xl font-semibold text-[#14222E] tabular-nums">
            {summary.total_orders}
          </p>
          <div className="text-[11px] text-[#5C6F80] space-y-0.5 tabular-nums pt-1 border-t border-[#EFECE4]/70">
            <p>Đang xử lý: <strong className="text-[#9A5B13]">{summary.pending_orders}</strong> · Hoàn tất: <strong className="text-[#0B7A53]">{summary.completed_orders}</strong></p>
            <p>Đã hủy: <strong className="text-[#14222E]">{summary.cancelled_orders}</strong></p>
            <button
              type="button"
              onClick={() => onJumpTab('orders')}
              className="text-[#006A9E] font-medium hover:underline pt-0.5"
            >
              Mở danh sách đơn hàng →
            </button>
          </div>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C6F80]">
            <span>Thiết kế &amp; Báo giá sự kiện</span>
            <Palette className="w-4 h-4 text-[#D83995]" />
          </div>
          <p className="text-2xl font-semibold text-[#14222E] tabular-nums">
            {summary.custom_requests_total + summary.event_quotes_total}
          </p>
          <div className="text-[11px] text-[#5C6F80] space-y-0.5 tabular-nums pt-1 border-t border-[#EFECE4]/70">
            <p>
              Thiết kế riêng: <strong className="text-[#14222E]">{summary.custom_requests_total}</strong>{' '}
              (đang mở: <strong className="text-[#D83995]">{summary.open_custom_requests}</strong>)
            </p>
            <p>
              Báo giá sự kiện: <strong className="text-[#14222E]">{summary.event_quotes_total}</strong>{' '}
              (đang mở: <strong className="text-[#D83995]">{summary.open_event_quotes}</strong>)
            </p>
            <button
              type="button"
              onClick={() => onJumpTab('consultations')}
              className="text-[#006A9E] font-medium hover:underline pt-0.5"
            >
              Xem yêu cầu tư vấn →
            </button>
          </div>
        </div>

        <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#5C6F80]">
            <span>Hỗ trợ &amp; Đánh giá</span>
            <Star className="w-4 h-4 text-[#D83995]" />
          </div>
          <p className="text-2xl font-semibold text-[#14222E] tabular-nums">
            {summary.published_reviews > 0 ? `${summary.average_rating} / 5★` : 'Chưa có ★'}
          </p>
          <div className="text-[11px] text-[#5C6F80] space-y-0.5 tabular-nums pt-1 border-t border-[#EFECE4]/70">
            <p>
              Đánh giá: <strong className="text-[#14222E]">{summary.published_reviews}</strong> · Hỏi đáp:{' '}
              <strong className="text-[#14222E]">{summary.questions_total}</strong> (chờ: {summary.unanswered_questions})
            </p>
            <p>
              Liên hệ hỗ trợ: <strong className="text-[#14222E]">{summary.contact_messages_total}</strong>{' '}
              (mới: <strong className="text-[#D83995]">{summary.open_contact_messages}</strong>)
            </p>
            <button
              type="button"
              onClick={() => onJumpTab('reviews')}
              className="text-[#006A9E] font-medium hover:underline pt-0.5"
            >
              Mở Đánh giá &amp; Hỏi đáp →
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Weekly / Monthly Bar Chart */}
      <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#14222E] inline-flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#006A9E]" />
              Biểu đồ thống kê {granularity === 'week' ? '8 tuần gần nhất' : '12 tháng gần nhất'}
            </h3>
            <p className="text-xs text-[#5C6F80]">
              Bấm vào từng cột để lọc chi tiết số liệu và danh sách đơn/yêu cầu của kỳ đó.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ['revenue', 'Doanh số'],
                ['orders', 'Đơn hàng'],
                ['consultations', 'Thiết kế & Sự kiện'],
                ['support_reviews', 'Hỗ trợ & Đánh giá'],
              ] as [ChartMetric, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setChartMetric(key)}
                className={`px-3 py-1.5 rounded-xl font-semibold border transition-colors ${
                  chartMetric === key
                    ? 'bg-[#F4B6C8] text-[#4A1829] border-[#E093AB]'
                    : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:bg-[#F9E1E8]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Bars */}
        <div className="overflow-x-auto pb-1">
          <div
            className="grid gap-2 items-end min-w-[540px] pt-6"
            style={{ gridTemplateColumns: `repeat(${Math.max(1, chartBars.items.length)}, minmax(0, 1fr))` }}
          >
            {chartBars.items.map(({ bucket, value, primary, displayLabel, tooltip }) => {
              const isSelected = selectedPeriod === bucket.key;
              const totalPct = value > 0 ? Math.max(8, Math.round((value / chartBars.maxVal) * 100)) : 2;
              const primaryPct =
                value > 0 && primary > 0 ? Math.max(6, Math.round((primary / value) * 100)) : 0;

              return (
                <button
                  key={bucket.key}
                  type="button"
                  title={tooltip}
                  onClick={() => onSelectPeriod(isSelected ? 'all' : bucket.key)}
                  className={`group flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-colors ${
                    isSelected
                      ? 'bg-[#F9E1E8]/80 border-[#D47B97]'
                      : 'border-transparent hover:bg-[#F8F5EE]/60 hover:border-[#EFECE4]'
                  }`}
                >
                  <span className="text-[11px] font-semibold text-[#14222E] tabular-nums">
                    {displayLabel}
                  </span>
                  <div className="w-full max-w-[38px] h-36 flex items-end justify-center bg-[#F8F5EE]/55 rounded-lg p-1 overflow-hidden">
                    <div
                      className={`w-full rounded-md relative overflow-hidden transition-all duration-300 ${
                        value === 0
                          ? 'bg-[#EFECE4]'
                          : isSelected
                            ? 'bg-[#D83995]/35'
                            : 'bg-[#0297DE]/30 group-hover:bg-[#0297DE]/45'
                      }`}
                      style={{ height: `${totalPct}%` }}
                    >
                      {primaryPct > 0 && (
                        <div
                          className={`absolute bottom-0 inset-x-0 rounded-md transition-all duration-300 ${
                            isSelected ? 'bg-[#D83995]' : 'bg-[#0297DE]'
                          }`}
                          style={{ height: `${primaryPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-medium tabular-nums text-center leading-tight ${
                      isSelected ? 'text-[#4A1829] font-semibold' : 'text-[#5C6F80]'
                    }`}
                  >
                    {bucket.short_label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chart Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] text-[#5C6F80] pt-1 border-t border-[#EFECE4]/70">
          {chartMetric === 'revenue' && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0297DE]" /> Doanh số đã đối soát thanh toán
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0297DE]/30" /> Tổng giá trị đơn (không hủy)
              </span>
            </>
          )}
          {chartMetric === 'orders' && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0297DE]" /> Đơn hoàn tất
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0297DE]/30" /> Tổng đơn hàng trong kỳ
              </span>
            </>
          )}
          {chartMetric === 'consultations' && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0297DE]" /> Báo giá sự kiện
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0297DE]/30" /> Tổng thiết kế riêng + sự kiện
              </span>
            </>
          )}
          {chartMetric === 'support_reviews' && (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0297DE]" /> Đánh giá sản phẩm
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#0297DE]/30" /> Tổng hỗ trợ (liên hệ + hỏi đáp) &amp; đánh giá
              </span>
            </>
          )}
        </div>
      </section>

      {/* Detailed Weekly / Monthly Breakdown Table */}
      <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#EFECE4] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#14222E]">
              Bảng tổng hợp chi tiết theo {granularity === 'week' ? 'tuần' : 'tháng'}
            </h3>
            <p className="text-xs text-[#5C6F80]">
              Phân chia đầy đủ doanh số, đơn hàng, yêu cầu thiết kế, sự kiện, hỗ trợ và đánh giá theo từng kỳ.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F5EE]/75 border-b border-[#EFECE4] text-[#14222E]">
                <th className="py-3 px-4 font-semibold whitespace-nowrap">
                  {granularity === 'week' ? 'Tuần' : 'Tháng'}
                </th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                  Doanh số đã TT
                </th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                  Tổng giá trị đơn
                </th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                  Đơn hàng
                </th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                  Thiết kế riêng
                </th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                  Sự kiện
                </th>
                <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">
                  Hỗ trợ (LH / Q&amp;A)
                </th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">
                  Đánh giá
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFECE4]/75 tabular-nums">
              {[...buckets].reverse().map((b) => {
                const isSelected = selectedPeriod === b.key;
                const isCurrent = b.key === currentBucketKey;
                return (
                  <tr
                    key={b.key}
                    onClick={() => onSelectPeriod(isSelected ? 'all' : b.key)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#F9E1E8]/75'
                        : 'hover:bg-[#F8F5EE]/45'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-medium text-[#14222E] whitespace-nowrap">
                      {b.label}
                      {isCurrent && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-[#F4B6C8] text-[#4A1829] text-[10px] font-semibold">
                          Hiện tại
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-semibold text-[#006A9E] whitespace-nowrap">
                      {formatVnd(b.paid_revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#14222E] whitespace-nowrap">
                      {formatVnd(b.gross_revenue)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#14222E] whitespace-nowrap">
                      <strong>{b.orders_total}</strong>
                      <span className="text-[#5C6F80]"> ({b.orders_completed} xong)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#14222E] whitespace-nowrap">
                      {b.custom_requests_total}
                      {b.custom_requests_open > 0 && (
                        <span className="text-[#D83995] font-medium"> ({b.custom_requests_open} mở)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#14222E] whitespace-nowrap">
                      {b.event_quotes_total}
                      {b.event_quotes_open > 0 && (
                        <span className="text-[#D83995] font-medium"> ({b.event_quotes_open} mở)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#14222E] whitespace-nowrap">
                      {b.contact_messages_total} / {b.questions_total}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#14222E] whitespace-nowrap">
                      {b.reviews_count > 0
                        ? `${b.reviews_count} (${b.reviews_avg_rating}★)`
                        : '0'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#F8F5EE]/85 border-t-2 border-[#DDD4BE] font-semibold text-[#14222E] tabular-nums">
                <td className="py-3 px-4 whitespace-nowrap">
                  Tổng ({granularity === 'week' ? '8 tuần' : '12 tháng'})
                </td>
                <td className="py-3 px-3 text-right text-[#006A9E] whitespace-nowrap">
                  {formatVnd(tableTotals.paid_revenue)}
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {formatVnd(tableTotals.gross_revenue)}
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {tableTotals.orders_total} ({tableTotals.orders_completed} xong)
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {tableTotals.custom_requests_total}
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {tableTotals.event_quotes_total}
                </td>
                <td className="py-3 px-3 text-right whitespace-nowrap">
                  {tableTotals.contact_messages_total} / {tableTotals.questions_total}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  {tableTotals.reviews_count > 0
                    ? `${tableTotals.reviews_count} (${tableTotals.avg_rating}★)`
                    : '0'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Unified Recent Incoming Inbox (All 4 Customer Flows) */}
      <section className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif text-lg font-semibold text-[#14222E] inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#D83995]" />
              Đơn hàng &amp; yêu cầu khách gửi gần đây ({unifiedFeed.length})
            </h3>
            <p className="text-xs text-[#5C6F80]">
              Gộp tự động từ Đặt hàng, Đặt thiết kế riêng, Tư vấn sự kiện và Liên hệ hỗ trợ - bấm “Xem chi tiết” để xem đầy đủ thông tin khách gửi.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs">
            {(
              [
                ['all', 'Tất cả'],
                ['order', 'Đặt hàng'],
                ['custom_request', 'Thiết kế riêng'],
                ['event_quote', 'Sự kiện'],
                ['contact', 'Hỗ trợ'],
              ] as [FeedFilter, string][]
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFeedFilter(k)}
                className={`px-3 py-1.5 rounded-xl font-semibold border transition-colors ${
                  feedFilter === k
                    ? 'bg-[#F4B6C8] text-[#4A1829] border-[#E093AB]'
                    : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:bg-[#F9E1E8]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {unifiedFeed.length === 0 ? (
          <div className="rounded-xl border border-[#EFECE4] bg-[#F8F5EE]/40 p-6 text-center text-xs text-[#5C6F80]">
            Chưa có đơn hàng hoặc yêu cầu nào trong kỳ đang chọn.
          </div>
        ) : (
          <div className="divide-y divide-[#EFECE4] border border-[#EFECE4] rounded-xl overflow-hidden">
            {unifiedFeed.slice(0, 20).map((item) => {
              const badge = typeBadge(item.type);
              return (
                <div
                  key={item.uid}
                  className="p-3.5 sm:p-4 bg-[#FDFBF7] hover:bg-[#F8F5EE]/45 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                      <span className="font-mono font-semibold text-[#006A9E]">{item.code}</span>
                      <span className="font-semibold text-[#14222E]">{item.customerName}</span>
                      <span className="text-[#5C6F80] tabular-nums">({item.customerPhone})</span>
                      {item.amountLabel && (
                        <span className="font-semibold text-[#14222E] tabular-nums">
                          · {item.amountLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#5C6F80] truncate">{item.summary}</p>
                    <p className="text-[11px] text-[#5C6F80] tabular-nums">
                      Gửi lúc {formatDateTimeVi(item.createdAt)} · Trạng thái:{' '}
                      <strong className={item.isUrgent ? 'text-[#D83995]' : 'text-[#14222E]'}>
                        {item.statusLabel}
                      </strong>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenDetail(item.record)}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Xem chi tiết</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Catalog Status Note */}
      <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#5C6F80]">
        <div className="inline-flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-[#006A9E] shrink-0" />
          <span>
            Danh mục hiện có <strong className="text-[#14222E]">{summary.products_active}</strong> /{' '}
            <strong className="text-[#14222E]">{summary.products_total}</strong> sản phẩm đang mở bán công khai trên website.
          </span>
        </div>
      </div>
    </div>
  );
}
