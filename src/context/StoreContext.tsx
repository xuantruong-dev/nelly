import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../lib/api.ts';
import type {
  CartItem,
  Category,
  GalleryItem,
  Product,
  ProductReview,
  StoreSettings,
} from '../../shared/types.ts';

export interface OccasionItem {
  slug: string;
  name: string;
  subtitle: string;
  image_url: string;
}

interface BootstrapPayload {
  settings: StoreSettings;
  categories: Category[];
  occasions: OccasionItem[];
  featured_products: Product[];
  recent_reviews: ProductReview[];
  gallery_preview: GalleryItem[];
}

interface StoreContextValue {
  loading: boolean;
  error: string | null;
  settings: StoreSettings | null;
  categories: Category[];
  occasions: OccasionItem[];
  featuredProducts: Product[];
  recentReviews: ProductReview[];
  galleryPreview: GalleryItem[];
  refreshBootstrap: () => Promise<void>;

  cart: CartItem[];
  cartCount: number;
  cartSubtotal: number;
  cartSurchargeTotal: number;
  cartGrandTotal: number;
  cartDrawerOpen: boolean;
  setCartDrawerOpen: (open: boolean) => void;
  addToCart: (item: CartItem) => void;
  updateCartQuantity: (cartKey: string, quantity: number) => void;
  removeFromCart: (cartKey: string) => void;
  clearCart: () => void;

  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const CART_STORAGE_KEY = 'hoanelly_cart_v1';

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const refreshBootstrap = useCallback(async () => {
    try {
      setError(null);
      const json = await fetchJson<BootstrapPayload>('/api/bootstrap', {
        fallbackError: 'Không thể tải dữ liệu cửa hàng.',
      });
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  const addToCart = useCallback(
    (item: CartItem) => {
      setCart((prev) => {
        const idx = prev.findIndex((x) => x.cart_key === item.cart_key);
        if (idx >= 0) {
          const next = [...prev];
          const existing = next[idx];
          const newQty = Math.min(50, existing.quantity + item.quantity);
          const perUnitSurcharge = existing.surcharge_total / Math.max(1, existing.quantity);
          next[idx] = {
            ...existing,
            quantity: newQty,
            surcharge_total: Math.round(perUnitSurcharge * newQty),
            line_total: Math.round((existing.unit_price + perUnitSurcharge) * newQty),
          };
          return next;
        }
        return [...prev, item];
      });
      showToast(`Đã thêm "${item.product_name}" vào giỏ hàng.`);
    },
    [showToast]
  );

  const updateCartQuantity = useCallback((cartKey: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        return prev.filter((x) => x.cart_key !== cartKey);
      }
      const clamped = Math.min(50, quantity);
      return prev.map((item) => {
        if (item.cart_key !== cartKey) return item;
        const perUnitSurcharge = item.surcharge_total / Math.max(1, item.quantity);
        const nextSurcharge = Math.round(perUnitSurcharge * clamped);
        return {
          ...item,
          quantity: clamped,
          surcharge_total: nextSurcharge,
          line_total: item.unit_price * clamped + nextSurcharge,
        };
      });
    });
  }, []);

  const removeFromCart = useCallback((cartKey: string) => {
    setCart((prev) => prev.filter((x) => x.cart_key !== cartKey));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartStats = useMemo(() => {
    let count = 0;
    let subtotal = 0;
    let surcharge = 0;
    let grand = 0;
    for (const item of cart) {
      count += item.quantity;
      subtotal += item.unit_price * item.quantity;
      surcharge += item.surcharge_total;
      grand += item.line_total;
    }
    return { count, subtotal, surcharge, grand };
  }, [cart]);

  const value: StoreContextValue = {
    loading,
    error,
    settings: data?.settings || null,
    categories: data?.categories || [],
    occasions: data?.occasions || [],
    featuredProducts: data?.featured_products || [],
    recentReviews: data?.recent_reviews || [],
    galleryPreview: data?.gallery_preview || [],
    refreshBootstrap,
    cart,
    cartCount: cartStats.count,
    cartSubtotal: cartStats.subtotal,
    cartSurchargeTotal: cartStats.surcharge,
    cartGrandTotal: cartStats.grand,
    cartDrawerOpen,
    setCartDrawerOpen,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    toastMessage,
    showToast,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
