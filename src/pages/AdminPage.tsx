import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Copy,
  Eye,
  Lock,
  LogOut,
  MessageSquare,
  Package,
  Palette,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Star,
  Users,
} from 'lucide-react';
import type {
  AdminDashboardAnalytics,
  AdminUser,
  ContactMessage,
  CustomRequest,
  EventQuote,
  InquiryStatus,
  Order,
  OrderStatus,
  PaymentStatus,
  ProductQuestion,
  ProductReview,
} from '../../shared/types.ts';
import { useStore } from '../context/StoreContext.tsx';
import {
  CONTACT_STATUS_LABELS,
  INQUIRY_STATUS_LABELS,
  ORDER_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  VENUE_SETTING_LABELS,
  formatDateTimeVi,
  formatVnd,
  getVnPeriodKey,
  usePageMeta,
} from '../lib/format.ts';
import { fetchJson } from '../lib/api.ts';
import { AdminProductsTab } from './admin/AdminProductsTab.tsx';
import { AdminSettingsTab } from './admin/AdminSettingsTab.tsx';
import { AdminAnalyticsPanel } from './admin/AdminAnalyticsPanel.tsx';
import { AdminDetailModal, type AdminDetailRecord } from './admin/AdminDetailModal.tsx';
import { SafeImage } from '../components/SafeImage.tsx';

type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'consultations'
  | 'reviews'
  | 'settings'
  | 'staff';

export function AdminPage() {
  const { refreshBootstrap, showToast } = useStore();
  usePageMeta('Quản trị cửa hàng – Hoa Nelly', 'Hệ thống quản trị sản phẩm, đơn hàng, yêu cầu tư vấn, đánh giá và cấu hình cửa hàng Hoa Nelly.');

  // Auth token kept strictly in React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authStatus, setAuthStatus] = useState<{
    needsSetup: boolean;
    envPasscodeConfigured: boolean;
    defaultAdminEmail: string;
  } | null>(null);

  // Auth form state
  const [email, setEmail] = useState('admin@hoanelly.vn');
  const [fullName, setFullName] = useState('Chủ cửa hàng Hoa Nelly');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [granularity, setGranularity] = useState<'week' | 'month'>('month');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all');
  const [metrics, setMetrics] = useState<AdminDashboardAnalytics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  const [eventQuotes, setEventQuotes] = useState<EventQuote[]>([]);
  const [contacts, setContacts] = useState<ContactMessage[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [staffList, setStaffList] = useState<AdminUser[]>([]);
  const [detailTarget, setDetailTarget] = useState<AdminDetailRecord | null>(null);

  // List search & status filters
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [consultSearch, setConsultSearch] = useState('');

  // Client-side pagination limits to keep DOM fast with 660+ orders & 220+ reviews
  const [ordersLimit, setOrdersLimit] = useState(20);
  const [customsLimit, setCustomsLimit] = useState(15);
  const [eventsLimit, setEventsLimit] = useState(15);
  const [contactsLimit, setContactsLimit] = useState(15);
  const [reviewsLimit, setReviewsLimit] = useState(15);
  const [questionsLimit, setQuestionsLimit] = useState(15);

  useEffect(() => {
    setOrdersLimit(20);
    setCustomsLimit(15);
    setEventsLimit(15);
    setContactsLimit(15);
    setReviewsLimit(15);
    setQuestionsLimit(15);
  }, [selectedPeriod, granularity, orderSearch, orderStatusFilter, consultSearch]);

  // Inline reply drafts
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [modReasonDrafts, setModReasonDrafts] = useState<Record<number, string>>({});

  // Staff create form
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffPass, setNewStaffPass] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'manager' | 'staff'>('staff');
  const [staffMsg, setStaffMsg] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchJson<{
      needsSetup: boolean;
      envPasscodeConfigured: boolean;
      defaultAdminEmail: string;
    }>('/api/admin/auth/status', { signal: controller.signal })
      .then((d) => {
        if (controller.signal.aborted) return;
        setAuthStatus(d);
        if (d.defaultAdminEmail) setEmail(d.defaultAdminEmail);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const hasPerm = useCallback(
    (perm: string): boolean => {
      if (!user) return false;
      return user.role === 'owner' || user.permissions.includes(perm);
    },
    [user]
  );

  const loadDashboard = useCallback(
    async (
      authToken: string,
      nextGranularity: 'week' | 'month' = granularity,
      nextPeriod: string = selectedPeriod
    ) => {
      const qs = new URLSearchParams({
        granularity: nextGranularity,
        period: nextPeriod,
      });
      const res = await fetch(`/api/admin/dashboard?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setMetrics(await res.json());
    },
    [granularity, selectedPeriod]
  );

  const loadOrders = useCallback(async (authToken: string): Promise<Order[]> => {
    const res = await fetch('/api/admin/orders', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) {
      const items = ((await res.json()).items || []) as Order[];
      setOrders(items);
      return items;
    }
    return [];
  }, []);

  const loadConsultations = useCallback(
    async (
      authToken: string
    ): Promise<{
      customs: CustomRequest[];
      events: EventQuote[];
      messages: ContactMessage[];
    }> => {
      const headers = { Authorization: `Bearer ${authToken}` };
      const [cRes, eRes, mRes] = await Promise.all([
        fetch('/api/admin/custom-requests', { headers }),
        fetch('/api/admin/event-quotes', { headers }),
        fetch('/api/admin/contact-messages', { headers }),
      ]);
      const customs = cRes.ok ? (((await cRes.json()).items || []) as CustomRequest[]) : [];
      const events = eRes.ok ? (((await eRes.json()).items || []) as EventQuote[]) : [];
      const messages = mRes.ok ? (((await mRes.json()).items || []) as ContactMessage[]) : [];
      if (cRes.ok) setCustomRequests(customs);
      if (eRes.ok) setEventQuotes(events);
      if (mRes.ok) setContacts(messages);
      return { customs, events, messages };
    },
    []
  );

  const loadReviewsAndQa = useCallback(async (authToken: string) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    const [rRes, qRes] = await Promise.all([
      fetch('/api/admin/reviews', { headers }),
      fetch('/api/admin/questions', { headers }),
    ]);
    if (rRes.ok) setReviews((await rRes.json()).items || []);
    if (qRes.ok) setQuestions((await qRes.json()).items || []);
  }, []);

  const loadStaff = useCallback(async (authToken: string) => {
    const res = await fetch('/api/admin/staff', {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) setStaffList((await res.json()).items || []);
  }, []);

  // Reload analytics whenever auth token or reporting period/granularity changes
  useEffect(() => {
    if (!token) return;
    loadDashboard(token, granularity, selectedPeriod);
  }, [token, granularity, selectedPeriod, loadDashboard]);

  // Preload operational feeds on sign-in & when switching tabs so dashboard inbox & badges stay fresh
  useEffect(() => {
    if (!token || !user) return;
    if (tab === 'dashboard' || tab === 'orders') {
      if (hasPerm('orders')) loadOrders(token);
    }
    if (tab === 'dashboard' || tab === 'consultations') {
      if (hasPerm('consultations')) loadConsultations(token);
    }
    if (tab === 'reviews' && hasPerm('reviews')) loadReviewsAndQa(token);
    if (tab === 'staff' && hasPerm('staff')) loadStaff(token);
  }, [token, user, tab, hasPerm, loadOrders, loadConsultations, loadReviewsAndQa, loadStaff]);

  const handleChangeGranularity = (next: 'week' | 'month') => {
    if (next === granularity) return;
    setGranularity(next);
    setSelectedPeriod('all');
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    showToast(`Đã sao chép ${label}.`);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);
    try {
      const endpoint = authStatus?.needsSetup ? '/api/admin/auth/setup' : '/api/admin/auth/login';
      const body = authStatus?.needsSetup
        ? { email, full_name: fullName, password }
        : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setAuthError(json.error || 'Đăng nhập thất bại.');
        return;
      }
      setToken(json.token);
      setUser(json.user);
      setPassword('');
      setAuthStatus((prev) => (prev ? { ...prev, needsSetup: false } : prev));
    } catch {
      setAuthError('Lỗi kết nối máy chủ.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (token) {
      await fetch('/api/admin/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setToken(null);
    setUser(null);
  };

  const handleUpdateOrder = async (
    orderId: number,
    patch: {
      status?: OrderStatus;
      payment_status?: PaymentStatus;
      shipping_fee?: number | null;
      schedule_confirmed?: boolean;
      admin_note?: string;
    }
  ) => {
    if (!token) return;
    const res = await fetch(`/api/admin/orders/${orderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      showToast('Đã cập nhật đơn hàng.');
      const nextOrders = await loadOrders(token);
      await loadDashboard(token);
      setDetailTarget((prev) => {
        if (prev?.type === 'order' && prev.data.id === orderId) {
          const fresh = nextOrders.find((o) => o.id === orderId);
          return fresh ? { type: 'order', data: fresh } : prev;
        }
        return prev;
      });
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Không thể cập nhật đơn hàng.');
    }
  };

  const handleUpdateCustomReq = async (
    id: number,
    patch: { status?: InquiryStatus; quoted_price?: number | null; admin_note?: string }
  ) => {
    if (!token) return;
    const res = await fetch(`/api/admin/custom-requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      showToast('Đã cập nhật yêu cầu thiết kế.');
      const next = await loadConsultations(token);
      await loadDashboard(token);
      setDetailTarget((prev) => {
        if (prev?.type === 'custom_request' && prev.data.id === id) {
          const fresh = next.customs.find((c) => c.id === id);
          return fresh ? { type: 'custom_request', data: fresh } : prev;
        }
        return prev;
      });
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Không thể cập nhật yêu cầu thiết kế.');
    }
  };

  const handleUpdateEventQuote = async (
    id: number,
    patch: { status?: InquiryStatus; quoted_price?: number | null; admin_note?: string }
  ) => {
    if (!token) return;
    const res = await fetch(`/api/admin/event-quotes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      showToast('Đã cập nhật báo giá sự kiện.');
      const next = await loadConsultations(token);
      await loadDashboard(token);
      setDetailTarget((prev) => {
        if (prev?.type === 'event_quote' && prev.data.id === id) {
          const fresh = next.events.find((e) => e.id === id);
          return fresh ? { type: 'event_quote', data: fresh } : prev;
        }
        return prev;
      });
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Không thể cập nhật báo giá sự kiện.');
    }
  };

  const handleUpdateContact = async (
    id: number,
    patch: { status?: 'new' | 'replied' | 'closed'; admin_note?: string }
  ) => {
    if (!token) return;
    const res = await fetch(`/api/admin/contact-messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      showToast('Đã cập nhật yêu cầu hỗ trợ.');
      const next = await loadConsultations(token);
      await loadDashboard(token);
      setDetailTarget((prev) => {
        if (prev?.type === 'contact' && prev.data.id === id) {
          const fresh = next.messages.find((m) => m.id === id);
          return fresh ? { type: 'contact', data: fresh } : prev;
        }
        return prev;
      });
    } else {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Không thể cập nhật yêu cầu hỗ trợ.');
    }
  };

  const handleReplyReview = async (reviewId: number) => {
    if (!token) return;
    const content = (replyDrafts[reviewId] || '').trim();
    if (content.length < 3) return;
    const res = await fetch(`/api/admin/reviews/${reviewId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      showToast('Đã gửi phản hồi từ Hoa Nelly.');
      await loadReviewsAndQa(token);
      await refreshBootstrap();
    }
  };

  const handleModerateReview = async (
    reviewId: number,
    status: 'published' | 'flagged' | 'hidden_policy'
  ) => {
    if (!token) return;
    const reason = (modReasonDrafts[reviewId] || '').trim();
    const res = await fetch(`/api/admin/reviews/${reviewId}/moderate`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status, moderation_reason: reason }),
    });
    const json = await res.json();
    if (!res.ok) {
      showToast(json.error || 'Không thể cập nhật trạng thái kiểm duyệt.');
      return;
    }
    showToast('Đã cập nhật trạng thái kiểm duyệt.');
    await loadReviewsAndQa(token);
    await refreshBootstrap();
  };

  const handleAnswerQuestion = async (questionId: number) => {
    if (!token) return;
    const answer = (answerDrafts[questionId] || '').trim();
    if (answer.length < 3) return;
    const res = await fetch(`/api/admin/questions/${questionId}/answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ answer }),
    });
    if (res.ok) {
      showToast('Đã trả lời câu hỏi khách hàng.');
      await loadReviewsAndQa(token);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setStaffMsg(null);
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: newStaffEmail,
        full_name: newStaffName,
        password: newStaffPass,
        role: newStaffRole,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setStaffMsg(json.error || 'Không thể tạo tài khoản.');
      return;
    }
    setNewStaffEmail('');
    setNewStaffName('');
    setNewStaffPass('');
    setStaffMsg('Đã tạo tài khoản nhân viên thành công.');
    await loadStaff(token);
  };

  const handleToggleStaff = async (id: number, currentActive: boolean) => {
    if (!token) return;
    await fetch(`/api/admin/staff/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !currentActive }),
    });
    await loadStaff(token);
  };

  const matchesSelectedPeriod = useCallback(
    (createdAt: string) =>
      selectedPeriod === 'all' || getVnPeriodKey(createdAt, granularity) === selectedPeriod,
    [selectedPeriod, granularity]
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((ord) => {
      if (!matchesSelectedPeriod(ord.created_at)) return false;
      if (orderStatusFilter !== 'all' && ord.status !== orderStatusFilter) return false;
      if (!q) return true;
      return (
        ord.order_code.toLowerCase().includes(q) ||
        ord.customer_name.toLowerCase().includes(q) ||
        ord.customer_phone.toLowerCase().includes(q)
      );
    });
  }, [orders, matchesSelectedPeriod, orderStatusFilter, orderSearch]);

  const filteredCustomRequests = useMemo(() => {
    const q = consultSearch.trim().toLowerCase();
    return customRequests.filter((req) => {
      if (!matchesSelectedPeriod(req.created_at)) return false;
      if (!q) return true;
      return (
        req.reference_code.toLowerCase().includes(q) ||
        req.customer_name.toLowerCase().includes(q) ||
        req.customer_phone.toLowerCase().includes(q) ||
        req.product_type.toLowerCase().includes(q)
      );
    });
  }, [customRequests, matchesSelectedPeriod, consultSearch]);

  const filteredEventQuotes = useMemo(() => {
    const q = consultSearch.trim().toLowerCase();
    return eventQuotes.filter((ev) => {
      if (!matchesSelectedPeriod(ev.created_at)) return false;
      if (!q) return true;
      return (
        ev.reference_code.toLowerCase().includes(q) ||
        ev.customer_name.toLowerCase().includes(q) ||
        ev.customer_phone.toLowerCase().includes(q) ||
        ev.event_type.toLowerCase().includes(q) ||
        ev.location.toLowerCase().includes(q)
      );
    });
  }, [eventQuotes, matchesSelectedPeriod, consultSearch]);

  const filteredContacts = useMemo(() => {
    const q = consultSearch.trim().toLowerCase();
    return contacts.filter((c) => {
      if (!matchesSelectedPeriod(c.created_at)) return false;
      if (!q) return true;
      return (
        c.reference_code.toLowerCase().includes(q) ||
        c.customer_name.toLowerCase().includes(q) ||
        c.customer_phone.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q)
      );
    });
  }, [contacts, matchesSelectedPeriod, consultSearch]);

  const filteredReviews = useMemo(
    () => reviews.filter((r) => matchesSelectedPeriod(r.created_at)),
    [reviews, matchesSelectedPeriod]
  );

  const filteredQuestions = useMemo(
    () => questions.filter((q) => matchesSelectedPeriod(q.created_at)),
    [questions, matchesSelectedPeriod]
  );

  // Unauthenticated View (First-run Claim or Login)
  if (!token || !user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 sm:p-8 space-y-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#006A9E]">
              <Lock className="w-4 h-4" />
              <span>Quản trị cửa hàng Hoa Nelly</span>
            </div>
            <h1 className="font-serif text-2xl font-semibold text-[#14222E]">
              {authStatus?.needsSetup
                ? 'Thiết lập tài khoản Chủ cửa hàng lần đầu'
                : 'Đăng nhập quản trị'}
            </h1>
            <p className="text-xs text-[#5C6F80] leading-relaxed">
              {authStatus?.needsSetup
                ? 'Chưa có tài khoản quản trị hoặc biến môi trường ADMIN_PASSCODE. Hãy tạo mật khẩu chủ cửa hàng để kích hoạt trang quản trị.'
                : authStatus?.envPasscodeConfigured
                  ? 'Hệ thống đang kích hoạt xác thực bằng ADMIN_PASSCODE (chủ cửa hàng) hoặc tài khoản nhân viên đã được cấp quyền.'
                  : 'Đăng nhập bằng email và mật khẩu quản trị đã được thiết lập.'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">Email quản trị</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>

            {authStatus?.needsSetup && (
              <div>
                <label className="block text-xs font-medium text-[#14222E] mb-1">
                  Tên hiển thị (hiển thị khi phản hồi đánh giá)
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#14222E] mb-1">
                Mật khẩu {authStatus?.needsSetup ? '(tối thiểu 8 ký tự)' : ''}
              </label>
              <input
                type="password"
                required
                minLength={authStatus?.needsSetup ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#EFECE4] rounded-lg"
              />
            </div>

            {authError && <p className="text-xs text-red-700">{authError}</p>}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] text-sm font-semibold hover:bg-[#EC9EB5] disabled:opacity-50"
            >
              {authLoading
                ? 'Đang xử lý...'
                : authStatus?.needsSetup
                  ? 'Tạo tài khoản Chủ cửa hàng'
                  : 'Đăng nhập quản trị'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navTabs: { id: AdminTab; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: <Shield className="w-4 h-4" />, visible: true },
    { id: 'orders', label: 'Đơn hàng', icon: <ShoppingBag className="w-4 h-4" />, visible: hasPerm('orders') },
    { id: 'products', label: 'Sản phẩm', icon: <Package className="w-4 h-4" />, visible: hasPerm('products') },
    {
      id: 'consultations',
      label: 'Thiết kế & Sự kiện',
      icon: <Palette className="w-4 h-4" />,
      visible: hasPerm('consultations'),
    },
    {
      id: 'reviews',
      label: 'Đánh giá & Hỏi đáp',
      icon: <Star className="w-4 h-4" />,
      visible: hasPerm('reviews'),
    },
    {
      id: 'settings',
      label: 'Cài đặt & Nội dung',
      icon: <Settings className="w-4 h-4" />,
      visible: hasPerm('settings'),
    },
    { id: 'staff', label: 'Nhân sự', icon: <Users className="w-4 h-4" />, visible: hasPerm('staff') },
  ];

  return (
    <div className="hn-page-shell space-y-6">
      {/* Admin Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#EFECE4]">
        <div>
          <p className="text-xs text-[#006A9E] font-medium">
            {user.full_name} · Vai trò:{' '}
            {user.role === 'owner' ? 'Chủ cửa hàng' : user.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#14222E]">
            Trang quản trị Hoa Nelly
          </h1>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] text-xs font-medium text-[#14222E] hover:bg-[#F9E1E8]"
        >
          <LogOut className="w-4 h-4" />
          <span>Đăng xuất</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {navTabs
          .filter((t) => t.visible)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold border transition-colors ${
                tab === t.id
                  ? 'bg-[#F4B6C8] text-[#4A1829] border-[#D47B97] font-semibold'
                  : 'bg-[#FDFBF7] text-[#14222E] border-[#EFECE4] hover:border-[#D47B97]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
      </div>

      {/* TAB: DASHBOARD */}
      {tab === 'dashboard' && metrics && (
        <AdminAnalyticsPanel
          analytics={metrics}
          granularity={granularity}
          selectedPeriod={selectedPeriod}
          onChangeGranularity={handleChangeGranularity}
          onSelectPeriod={setSelectedPeriod}
          orders={orders}
          customRequests={customRequests}
          eventQuotes={eventQuotes}
          contacts={contacts}
          onOpenDetail={setDetailTarget}
          onJumpTab={(nextTab) => setTab(nextTab)}
        />
      )}

      {/* SHARED PERIOD FILTER STRIP FOR OPERATIONAL TABS */}
      {(tab === 'orders' || tab === 'consultations' || tab === 'reviews') && metrics && (
        <div className="bg-[#F8F5EE]/60 rounded-2xl border border-[#EFECE4] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-[#14222E]">Lọc theo kỳ:</span>
            <div className="inline-flex rounded-xl border border-[#EFECE4] bg-[#FDFBF7] p-0.5">
              <button
                type="button"
                onClick={() => handleChangeGranularity('week')}
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  granularity === 'week'
                    ? 'bg-[#F4B6C8] text-[#4A1829]'
                    : 'text-[#5C6F80] hover:text-[#14222E]'
                }`}
              >
                Theo tuần
              </button>
              <button
                type="button"
                onClick={() => handleChangeGranularity('month')}
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  granularity === 'month'
                    ? 'bg-[#F4B6C8] text-[#4A1829]'
                    : 'text-[#5C6F80] hover:text-[#14222E]'
                }`}
              >
                Theo tháng
              </button>
            </div>
            <select
              aria-label="Chọn kỳ lọc danh sách"
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-3 py-1.5 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl font-medium text-[#14222E]"
            >
              <option value="all">Tất cả thời gian</option>
              {[...(metrics.buckets || [])].reverse().map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
            {selectedPeriod !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedPeriod('all')}
                className="px-2.5 py-1.5 rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-[#5C6F80] hover:text-[#14222E]"
              >
                Bỏ lọc kỳ
              </button>
            )}
          </div>
          {selectedPeriod !== 'all' && (
            <span className="text-[#5C6F80] tabular-nums">
              Đang xem kỳ:{' '}
              <strong className="text-[#14222E]">
                {metrics.buckets.find((b) => b.key === selectedPeriod)?.label || selectedPeriod}
              </strong>
            </span>
          )}
        </div>
      )}

      {/* TAB: ORDERS */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              Quản lý đơn hàng ({filteredOrders.length}
              {filteredOrders.length !== orders.length ? ` / ${orders.length}` : ''})
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#5C6F80] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Tìm mã đơn, tên, SĐT..."
                  className="pl-8 pr-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl w-52"
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl"
              >
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(ORDER_STATUS_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-8 text-center text-sm text-[#5C6F80]">
              {orders.length === 0
                ? 'Chưa có đơn hàng nào được tạo.'
                : 'Không có đơn hàng nào khớp bộ lọc hiện tại.'}
            </div>
          ) : (
            filteredOrders.slice(0, ordersLimit).map((ord) => (
              <div
                key={ord.id}
                className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-[#EFECE4]">
                  <div>
                    <p className="font-mono text-base font-semibold text-[#006A9E]">
                      {ord.order_code}
                    </p>
                    <p className="text-xs text-[#5C6F80]">
                      {ord.customer_name} · {ord.customer_phone}
                      {ord.customer_email ? ` · ${ord.customer_email}` : ''} · Đặt lúc{' '}
                      {formatDateTimeVi(ord.created_at)}
                    </p>
                    <p className="text-xs text-[#5C6F80] mt-0.5">
                      Lịch hẹn: {ord.desired_date} ({ord.desired_time_slot}) ·{' '}
                      {ord.delivery_method === 'pickup'
                        ? 'Nhận tại cửa hàng'
                        : ord.delivery_address}
                    </p>
                    {ord.hide_price_for_recipient && (
                      <p className="text-xs text-[#0B7A53] font-medium mt-0.5">
                        Quà tặng: Không kèm giá trên phiếu gửi người nhận
                      </p>
                    )}
                    {ord.customer_note && (
                      <p className="text-xs text-[#14222E] mt-1">
                        Ghi chú khách: <span className="text-[#5C6F80]">{ord.customer_note}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 tabular-nums">
                    <div className="text-right">
                      <p className="text-lg font-semibold text-[#14222E]">
                        {formatVnd(ord.total_amount)}
                      </p>
                      <p className="text-xs text-[#5C6F80]">
                        Phí giao:{' '}
                        {ord.shipping_fee_status === 'confirmed'
                          ? formatVnd(ord.shipping_fee)
                          : 'Chờ xác nhận'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailTarget({ type: 'order', data: ord })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem chi tiết</span>
                    </button>
                  </div>
                </div>

                {/* Items + verified review links when completed */}
                <div className="space-y-2 text-xs">
                  {ord.items.map((it) => (
                    <div
                      key={it.id}
                      className="p-3 rounded-xl bg-[#F8F5EE]/40 border border-[#EFECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <p className="font-semibold text-[#14222E]">
                          {it.product_name} × {it.quantity} ({formatVnd(it.line_total)})
                        </p>
                        {Object.values(it.selected_variants).length > 0 && (
                          <p className="text-[#5C6F80]">
                            Biến thể:{' '}
                            {Object.values(it.selected_variants)
                              .map((v) => v.label)
                              .join(' · ')}
                          </p>
                        )}
                        {Boolean(it.personalization?.custom_text) && (
                          <p className="text-[#006A9E]">
                            Chữ in: {String(it.personalization.custom_text)}
                          </p>
                        )}
                        {Boolean(it.personalization?.card_message) && (
                          <p className="text-[#5C6F80]">
                            Thiệp: {String(it.personalization.card_message)}
                          </p>
                        )}
                      </div>

                      {ord.status === 'completed' && it.review_token && (
                        <div className="flex items-center gap-2 shrink-0">
                          <Link
                            to={`/san-pham/${it.product_slug}?reviewToken=${encodeURIComponent(
                              it.review_token
                            )}#danh-gia`}
                            className="px-2.5 py-1.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-[11px] font-medium"
                          >
                            Mở link đánh giá
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                `${window.location.origin}/san-pham/${it.product_slug}?reviewToken=${it.review_token}#danh-gia`,
                                'liên kết đánh giá xác thực'
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#EFECE4] bg-[#FDFBF7] text-[11px]"
                          >
                            <Copy className="w-3 h-3" /> Copy link
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-2">
                  <div>
                    <label className="block font-medium mb-1">Trạng thái đơn</label>
                    <select
                      value={ord.status}
                      onChange={(e) =>
                        handleUpdateOrder(ord.id, { status: e.target.value as OrderStatus })
                      }
                      className="w-full px-2.5 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    >
                      {Object.entries(ORDER_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Trạng thái thanh toán</label>
                    <select
                      value={ord.payment_status}
                      onChange={(e) =>
                        handleUpdateOrder(ord.id, {
                          payment_status: e.target.value as PaymentStatus,
                        })
                      }
                      className="w-full px-2.5 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    >
                      {Object.entries(PAYMENT_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Cập nhật phí giao (VNĐ)</label>
                    <input
                      type="number"
                      defaultValue={ord.shipping_fee ?? ''}
                      placeholder="Nhập phí & Enter"
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        const nextFee = val === '' ? null : Number(val);
                        if (nextFee !== ord.shipping_fee) {
                          handleUpdateOrder(ord.id, { shipping_fee: nextFee });
                        }
                      }}
                      className="w-full px-2.5 py-2 border border-[#EFECE4] rounded-lg"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateOrder(ord.id, { schedule_confirmed: !ord.schedule_confirmed })
                      }
                      className={`w-full py-2 px-3 rounded-lg border font-medium inline-flex items-center justify-center gap-1.5 ${
                        ord.schedule_confirmed
                          ? 'border-[#0B7A53]/40 bg-[#E6F4EE] text-[#0B7A53]'
                          : 'border-[#EFECE4] bg-[#FDFBF7] text-[#14222E]'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        {ord.schedule_confirmed ? 'Đã xác nhận lịch giao' : 'Xác nhận lịch giao'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
          {filteredOrders.length > ordersLimit && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrdersLimit((n) => n + 20)}
                className="px-5 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold cursor-pointer"
              >
                Xem thêm 20 đơn hàng (đang hiển thị {ordersLimit}/{filteredOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setOrdersLimit(filteredOrders.length)}
                className="px-4 py-2.5 rounded-xl border border-[#EFECE4] bg-[#FDFBF7] text-xs font-medium text-[#5C6F80] hover:text-[#14222E] cursor-pointer"
              >
                Hiển thị tất cả
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: PRODUCTS */}
      {tab === 'products' && (
        <AdminProductsTab
          token={token}
          onChanged={() => {
            loadDashboard(token);
            refreshBootstrap();
          }}
        />
      )}

      {/* TAB: CONSULTATIONS */}
      {tab === 'consultations' && (
        <div className="space-y-8">
          {/* Search bar for consultations */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#5C6F80]">
              Tất cả yêu cầu từ trang Đặt thiết kế riêng, Tư vấn sự kiện và Liên hệ hỗ trợ được ghi nhận đầy đủ tại đây.
            </p>
            <div className="relative text-xs">
              <Search className="w-3.5 h-3.5 text-[#5C6F80] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={consultSearch}
                onChange={(e) => setConsultSearch(e.target.value)}
                placeholder="Tìm mã, tên, SĐT, sự kiện..."
                className="pl-8 pr-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-xl w-64"
              />
            </div>
          </div>

          {/* Custom Design Requests */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              Yêu cầu thiết kế riêng ({filteredCustomRequests.length}
              {filteredCustomRequests.length !== customRequests.length
                ? ` / ${customRequests.length}`
                : ''}
              )
            </h2>
            {filteredCustomRequests.length === 0 ? (
              <p className="text-sm text-[#5C6F80] bg-[#FDFBF7] p-6 rounded-xl border border-[#EFECE4]">
                {customRequests.length === 0
                  ? 'Chưa có yêu cầu thiết kế riêng nào.'
                  : 'Không có yêu cầu thiết kế riêng nào trong kỳ / bộ lọc đang chọn.'}
              </p>
            ) : (
              filteredCustomRequests.slice(0, customsLimit).map((req) => (
                <div
                  key={req.id}
                  className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div>
                        <span className="font-mono font-semibold text-[#006A9E]">
                          {req.reference_code}
                        </span>
                        <span className="text-xs text-[#5C6F80] ml-2">
                          {req.product_type} · Dịp: {req.occasion} · Cần ngày: {req.needed_date}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C6F80]">
                        <strong className="text-[#14222E]">{req.customer_name}</strong> ({req.customer_phone})
                        {req.customer_email ? ` · ${req.customer_email}` : ''} · Gửi lúc{' '}
                        {formatDateTimeVi(req.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailTarget({ type: 'custom_request', data: req })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem chi tiết</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#5C6F80]">
                    Màu: {req.colors || '-'} · Chủ đề: {req.theme_character || '-'} · Kích thước:{' '}
                    {req.desired_size || '-'} · Ngân sách: {req.budget || '-'}
                  </p>
                  {req.personalization_text && (
                    <p className="text-xs text-[#14222E]">
                      Cá nhân hóa: {req.personalization_text}
                    </p>
                  )}
                  {req.customer_note && (
                    <p className="text-xs text-[#5C6F80]">
                      Ghi chú khách: <span className="text-[#14222E]">{req.customer_note}</span>
                    </p>
                  )}
                  {req.reference_images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {req.reference_images.map((u, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setDetailTarget({ type: 'custom_request', data: req })}
                          className="rounded-lg overflow-hidden border border-[#EFECE4] hover:border-[#D83995]"
                          title="Bấm xem chi tiết ảnh"
                        >
                          <SafeImage
                            src={u}
                            alt={`Ảnh tham khảo ${i + 1}`}
                            preset="thumbnail"
                            wrapperClassName="w-14 h-14"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <select
                      value={req.status}
                      onChange={(e) =>
                        handleUpdateCustomReq(req.id, { status: e.target.value as InquiryStatus })
                      }
                      className="px-2.5 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    >
                      {Object.entries(INQUIRY_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      defaultValue={req.quoted_price ?? ''}
                      placeholder="Báo giá (VNĐ)"
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const nextVal = raw === '' ? null : Number(raw);
                        if (nextVal !== req.quoted_price) {
                          handleUpdateCustomReq(req.id, { quoted_price: nextVal });
                        }
                      }}
                      className="px-2.5 py-2 border border-[#EFECE4] rounded-lg"
                    />
                    <input
                      type="text"
                      defaultValue={req.admin_note || ''}
                      placeholder="Ghi chú tư vấn nội bộ..."
                      onBlur={(e) => {
                        if (e.target.value !== (req.admin_note || '')) {
                          handleUpdateCustomReq(req.id, { admin_note: e.target.value });
                        }
                      }}
                      className="px-2.5 py-2 border border-[#EFECE4] rounded-lg"
                    />
                  </div>
                </div>
              ))
            )}
            {filteredCustomRequests.length > customsLimit && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setCustomsLimit((n) => n + 15)}
                  className="px-4 py-2 rounded-xl border border-[#E093AB] bg-[#FDFBF7] text-xs font-semibold text-[#4A1829] hover:bg-[#F9E1E8] cursor-pointer"
                >
                  Xem thêm yêu cầu thiết kế ({customsLimit}/{filteredCustomRequests.length})
                </button>
              </div>
            )}
          </section>

          {/* Event Quotes */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              Yêu cầu tư vấn &amp; báo giá sự kiện ({filteredEventQuotes.length}
              {filteredEventQuotes.length !== eventQuotes.length ? ` / ${eventQuotes.length}` : ''})
            </h2>
            {filteredEventQuotes.length === 0 ? (
              <p className="text-sm text-[#5C6F80] bg-[#FDFBF7] p-6 rounded-xl border border-[#EFECE4]">
                {eventQuotes.length === 0
                  ? 'Chưa có yêu cầu trang trí sự kiện nào.'
                  : 'Không có yêu cầu sự kiện nào trong kỳ / bộ lọc đang chọn.'}
              </p>
            ) : (
              filteredEventQuotes.slice(0, eventsLimit).map((ev) => (
                <div
                  key={ev.id}
                  className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-3 text-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <div>
                        <span className="font-mono font-semibold text-[#006A9E]">
                          {ev.reference_code}
                        </span>
                        <span className="text-xs text-[#5C6F80] ml-2">
                          {ev.event_type} · Ngày: {ev.event_date} {ev.event_time}
                        </span>
                      </div>
                      <p className="text-xs text-[#5C6F80]">
                        <strong className="text-[#14222E]">{ev.customer_name}</strong> ({ev.customer_phone})
                        {ev.customer_email ? ` · ${ev.customer_email}` : ''} · Gửi lúc{' '}
                        {formatDateTimeVi(ev.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailTarget({ type: 'event_quote', data: ev })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem chi tiết</span>
                    </button>
                  </div>
                  <p className="text-xs text-[#5C6F80]">
                    Địa điểm: {ev.location} ({VENUE_SETTING_LABELS[ev.venue_setting] || ev.venue_setting}) · Quy mô:{' '}
                    {ev.scale_area || '-'} · Ngân sách: {ev.budget || '-'}
                  </p>
                  {ev.style_colors && (
                    <p className="text-xs text-[#5C6F80]">
                      Phong cách &amp; màu sắc: <span className="text-[#14222E]">{ev.style_colors}</span>
                    </p>
                  )}
                  {ev.desired_items.length > 0 && (
                    <p className="text-xs text-[#14222E]">
                      Hạng mục: {ev.desired_items.join(', ')}
                    </p>
                  )}
                  {ev.customer_note && (
                    <p className="text-xs text-[#5C6F80]">
                      Ghi chú khách: <span className="text-[#14222E]">{ev.customer_note}</span>
                    </p>
                  )}
                  {ev.reference_images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {ev.reference_images.map((u, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setDetailTarget({ type: 'event_quote', data: ev })}
                          className="rounded-lg overflow-hidden border border-[#EFECE4] hover:border-[#D83995]"
                          title="Bấm xem chi tiết ảnh"
                        >
                          <SafeImage
                            src={u}
                            alt={`Ảnh sự kiện ${i + 1}`}
                            preset="thumbnail"
                            wrapperClassName="w-14 h-14"
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                    <select
                      value={ev.status}
                      onChange={(e) =>
                        handleUpdateEventQuote(ev.id, { status: e.target.value as InquiryStatus })
                      }
                      className="px-2.5 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    >
                      {Object.entries(INQUIRY_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      defaultValue={ev.quoted_price ?? ''}
                      placeholder="Báo giá dự kiến (VNĐ)"
                      onBlur={(e) => {
                        const raw = e.target.value.trim();
                        const nextVal = raw === '' ? null : Number(raw);
                        if (nextVal !== ev.quoted_price) {
                          handleUpdateEventQuote(ev.id, { quoted_price: nextVal });
                        }
                      }}
                      className="px-2.5 py-2 border border-[#EFECE4] rounded-lg"
                    />
                    <input
                      type="text"
                      defaultValue={ev.admin_note || ''}
                      placeholder="Ghi chú tư vấn..."
                      onBlur={(e) => {
                        if (e.target.value !== (ev.admin_note || '')) {
                          handleUpdateEventQuote(ev.id, { admin_note: e.target.value });
                        }
                      }}
                      className="px-2.5 py-2 border border-[#EFECE4] rounded-lg"
                    />
                  </div>
                </div>
              ))
            )}
            {filteredEventQuotes.length > eventsLimit && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setEventsLimit((n) => n + 15)}
                  className="px-4 py-2 rounded-xl border border-[#E093AB] bg-[#FDFBF7] text-xs font-semibold text-[#4A1829] hover:bg-[#F9E1E8] cursor-pointer"
                >
                  Xem thêm yêu cầu sự kiện ({eventsLimit}/{filteredEventQuotes.length})
                </button>
              </div>
            )}
          </section>

          {/* Contact Messages / Support */}
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              Lời nhắn liên hệ &amp; yêu cầu hỗ trợ ({filteredContacts.length}
              {filteredContacts.length !== contacts.length ? ` / ${contacts.length}` : ''})
            </h2>
            {filteredContacts.length === 0 ? (
              <p className="text-sm text-[#5C6F80] bg-[#FDFBF7] p-6 rounded-xl border border-[#EFECE4]">
                {contacts.length === 0
                  ? 'Chưa có lời nhắn liên hệ nào.'
                  : 'Không có lời nhắn liên hệ nào trong kỳ / bộ lọc đang chọn.'}
              </p>
            ) : (
              filteredContacts.slice(0, contactsLimit).map((c) => (
                <div
                  key={c.id}
                  className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 text-xs space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-[#14222E] text-sm">
                        <span className="font-mono text-[#006A9E] mr-2">{c.reference_code}</span>
                        {c.subject}
                      </p>
                      <p className="text-[#5C6F80]">
                        <strong className="text-[#14222E]">{c.customer_name}</strong> ({c.customer_phone})
                        {c.customer_email ? ` · ${c.customer_email}` : ''} · Gửi lúc{' '}
                        {formatDateTimeVi(c.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailTarget({ type: 'contact', data: c })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Xem chi tiết</span>
                    </button>
                  </div>
                  <p className="text-[#14222E] whitespace-pre-wrap leading-relaxed">{c.message}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <select
                      value={c.status}
                      onChange={(e) =>
                        handleUpdateContact(c.id, {
                          status: e.target.value as 'new' | 'replied' | 'closed',
                        })
                      }
                      className="px-2.5 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    >
                      {Object.entries(CONTACT_STATUS_LABELS).map(([k, lbl]) => (
                        <option key={k} value={k}>
                          {lbl}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      defaultValue={c.admin_note || ''}
                      placeholder="Ghi chú hỗ trợ nội bộ..."
                      onBlur={(e) => {
                        if (e.target.value !== (c.admin_note || '')) {
                          handleUpdateContact(c.id, { admin_note: e.target.value });
                        }
                      }}
                      className="sm:col-span-2 px-2.5 py-2 border border-[#EFECE4] rounded-lg"
                    />
                  </div>
                </div>
              ))
            )}
            {filteredContacts.length > contactsLimit && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => setContactsLimit((n) => n + 15)}
                  className="px-4 py-2 rounded-xl border border-[#E093AB] bg-[#FDFBF7] text-xs font-semibold text-[#4A1829] hover:bg-[#F9E1E8] cursor-pointer"
                >
                  Xem thêm lời nhắn liên hệ ({contactsLimit}/{filteredContacts.length})
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB: REVIEWS & Q&A */}
      {tab === 'reviews' && (
        <div className="space-y-8">
          <section className="space-y-4">
            <div>
              <h2 className="font-serif text-xl font-semibold text-[#14222E]">
                Đánh giá sản phẩm &amp; Phản hồi từ Hoa Nelly ({filteredReviews.length}
                {filteredReviews.length !== reviews.length ? ` / ${reviews.length}` : ''})
              </h2>
              <p className="text-xs text-[#5C6F80]">
                Số sao và nhận xét của khách được bảo toàn nguyên vẹn. Chỉ ẩn khi vi phạm quy định (spam, xúc phạm, lộ thông tin cá nhân).
              </p>
            </div>

            {filteredReviews.length === 0 ? (
              <p className="text-sm text-[#5C6F80] bg-[#FDFBF7] p-6 rounded-xl border border-[#EFECE4]">
                {reviews.length === 0
                  ? 'Chưa có đánh giá nào từ đơn hàng hoàn tất.'
                  : 'Không có đánh giá nào trong kỳ đang chọn.'}
              </p>
            ) : (
              filteredReviews.slice(0, reviewsLimit).map((rev) => (
                <div
                  key={rev.id}
                  className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-5 space-y-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-[#14222E]">{rev.display_name}</span>
                      <span className="text-xs text-[#E09619] font-semibold ml-2">
                        {rev.rating}★
                      </span>
                      <span className="text-xs text-[#5C6F80] ml-2">
                        Sản phẩm: {rev.product_name} · Trạng thái: {rev.status}
                      </span>
                    </div>
                    <span className="text-xs text-[#5C6F80]">{formatDateTimeVi(rev.created_at)}</span>
                  </div>

                  <p className="text-[#14222E]">{rev.comment}</p>

                  {/* Shop Reply Box */}
                  <div className="p-3.5 rounded-xl bg-[#F8F5EE]/60 border border-[#EFECE4] space-y-2">
                    <p className="text-xs font-semibold text-[#006A9E]">
                      {rev.reply ? 'Phản hồi đã đăng từ Hoa Nelly (có thể cập nhật):' : 'Trả lời với tư cách Hoa Nelly:'}
                    </p>
                    <textarea
                      rows={2}
                      value={replyDrafts[rev.id] ?? rev.reply?.content ?? ''}
                      onChange={(e) =>
                        setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                      }
                      placeholder="Nhập lời cảm ơn hoặc phản hồi hỗ trợ từ Hoa Nelly..."
                      className="w-full px-3 py-2 text-xs bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleReplyReview(rev.id)}
                      className="px-4 py-1.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-medium"
                    >
                      {rev.reply ? 'Cập nhật phản hồi' : 'Gửi phản hồi từ Hoa Nelly'}
                    </button>
                  </div>

                  {/* Moderation controls */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EFECE4] text-xs">
                    <input
                      type="text"
                      value={modReasonDrafts[rev.id] ?? rev.moderation_reason ?? ''}
                      onChange={(e) =>
                        setModReasonDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                      }
                      placeholder="Lý do nếu ẩn do vi phạm (spam / xúc phạm / lộ thông tin cá nhân)"
                      className="flex-1 min-w-[240px] px-3 py-1.5 border border-[#EFECE4] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleModerateReview(rev.id, 'published')}
                      className="px-3 py-1.5 rounded-lg border border-[#EFECE4] hover:bg-[#F9E1E8]"
                    >
                      Công khai
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModerateReview(rev.id, 'hidden_policy')}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Ẩn do vi phạm
                    </button>
                  </div>
                </div>
              ))
            )}
            {filteredReviews.length > reviewsLimit && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setReviewsLimit((n) => n + 20)}
                  className="px-5 py-2.5 rounded-xl bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold cursor-pointer"
                >
                  Xem thêm 20 đánh giá (đang hiển thị {reviewsLimit}/{filteredReviews.length})
                </button>
              </div>
            )}
          </section>

          {/* Product Questions */}
          <section className="space-y-4">
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              Hỏi đáp sản phẩm ({filteredQuestions.length}
              {filteredQuestions.length !== questions.length ? ` / ${questions.length}` : ''})
            </h2>
            {filteredQuestions.length === 0 ? (
              <p className="text-sm text-[#5C6F80] bg-[#FDFBF7] p-6 rounded-xl border border-[#EFECE4]">
                {questions.length === 0
                  ? 'Chưa có câu hỏi sản phẩm nào.'
                  : 'Không có câu hỏi nào trong kỳ đang chọn.'}
              </p>
            ) : (
              filteredQuestions.slice(0, questionsLimit).map((q) => (
                <div
                  key={q.id}
                  className="bg-[#FDFBF7] rounded-xl border border-[#EFECE4] p-4 space-y-2.5 text-sm"
                >
                  <p className="text-xs text-[#5C6F80]">
                    <strong className="text-[#14222E]">{q.asker_name}</strong> hỏi về{' '}
                    <strong>{q.product_name}</strong> · {formatDateTimeVi(q.created_at)}
                  </p>
                  <p className="text-[#14222E]">{q.question}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answerDrafts[q.id] ?? q.answer ?? ''}
                      onChange={(e) =>
                        setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="Nhập câu trả lời công khai từ Hoa Nelly..."
                      className="flex-1 px-3 py-2 text-xs border border-[#EFECE4] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleAnswerQuestion(q.id)}
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-medium"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Trả lời</span>
                    </button>
                  </div>
                </div>
              ))
            )}
            {filteredQuestions.length > questionsLimit && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setQuestionsLimit((n) => n + 15)}
                  className="px-5 py-2.5 rounded-xl border border-[#E093AB] bg-[#FDFBF7] text-xs font-semibold text-[#4A1829] hover:bg-[#F9E1E8] cursor-pointer"
                >
                  Xem thêm câu hỏi ({questionsLimit}/{filteredQuestions.length})
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB: SETTINGS */}
      {tab === 'settings' && (
        <AdminSettingsTab
          token={token}
          onSaved={() => {
            refreshBootstrap();
          }}
        />
      )}

      {/* TAB: STAFF (Owner only) */}
      {tab === 'staff' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateStaff}
            className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] p-6 space-y-4"
          >
            <h2 className="font-serif text-xl font-semibold text-[#14222E]">
              Thêm tài khoản nhân viên &amp; phân quyền
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <input
                type="text"
                required
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="Họ tên nhân viên"
                className="px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
              <input
                type="email"
                required
                value={newStaffEmail}
                onChange={(e) => setNewStaffEmail(e.target.value)}
                placeholder="Email đăng nhập"
                className="px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
              <input
                type="password"
                required
                minLength={8}
                value={newStaffPass}
                onChange={(e) => setNewStaffPass(e.target.value)}
                placeholder="Mật khẩu (≥ 8 ký tự)"
                className="px-3 py-2 border border-[#EFECE4] rounded-lg"
              />
              <select
                value={newStaffRole}
                onChange={(e) => setNewStaffRole(e.target.value as 'manager' | 'staff')}
                className="px-3 py-2 bg-[#FDFBF7] border border-[#EFECE4] rounded-lg"
              >
                <option value="staff">Nhân viên (Đơn, Tư vấn, Đánh giá)</option>
                <option value="manager">Quản lý (Đầy đủ trừ Nhân sự)</option>
              </select>
            </div>
            {staffMsg && <p className="text-xs text-[#006A9E]">{staffMsg}</p>}
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg bg-[#F4B6C8] text-[#4A1829] border border-[#E093AB] hover:bg-[#EC9EB5] text-xs font-semibold"
            >
              Tạo tài khoản
            </button>
          </form>

          <div className="bg-[#FDFBF7] rounded-2xl border border-[#EFECE4] divide-y divide-[#EFECE4]">
            {staffList.map((st) => (
              <div key={st.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-semibold text-[#14222E]">
                    {st.full_name} <span className="text-xs font-normal text-[#5C6F80]">({st.email})</span>
                  </p>
                  <p className="text-xs text-[#5C6F80]">
                    Vai trò: {st.role} · Quyền: {st.permissions.join(', ')}
                  </p>
                </div>
                {st.role !== 'owner' && (
                  <button
                    type="button"
                    onClick={() => handleToggleStaff(st.id, st.is_active)}
                    className="px-3 py-1.5 rounded-lg border border-[#EFECE4] text-xs"
                  >
                    {st.is_active ? 'Tạm khóa' : 'Mở khóa'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Full Detail Modal for Orders, Custom Requests, Event Quotes & Support Contacts */}
      <AdminDetailModal
        record={detailTarget}
        onClose={() => setDetailTarget(null)}
        onCopy={handleCopyText}
        onUpdateOrder={handleUpdateOrder}
        onUpdateCustomReq={handleUpdateCustomReq}
        onUpdateEventQuote={handleUpdateEventQuote}
        onUpdateContact={handleUpdateContact}
      />
    </div>
  );
}
