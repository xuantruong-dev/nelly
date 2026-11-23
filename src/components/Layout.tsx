import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../context/StoreContext.tsx';
import { formatVnd } from '../lib/format.ts';
import { BrandLogo } from './BrandLogo.tsx';
import { RouteTransition } from './RouteTransition.tsx';
import { SafeImage } from './SafeImage.tsx';
import { useOverlayLock } from '../hooks/useOverlayLock.ts';
import {
  MOTION_CONFIG,
  ScrollTrigger,
  gsap,
  prefersReducedMotion,
  useGSAP,
} from '../lib/motionConfig.ts';
import {
  scrollToTop,
  startSmoothScroll,
  stopSmoothScroll,
} from '../lib/smoothScroll.ts';

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    settings,
    categories,
    cart,
    cartCount,
    cartGrandTotal,
    cartDrawerOpen,
    setCartDrawerOpen,
    updateCartQuantity,
    removeFromCart,
    toastMessage,
  } = useStore();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [headerElevated, setHeaderElevated] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const isAdminRoute = location.pathname.startsWith('/quan-tri');
  const isProductDetailRoute = /^\/san-pham\/[^/]+/.test(location.pathname);
  const headerRef = useRef<HTMLElement>(null);
  const catDropdownRef = useRef<HTMLDivElement>(null);
  const catTriggerRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const mobileCloseBtnRef = useRef<HTMLButtonElement>(null);
  const cartBtnRef = useRef<HTMLButtonElement>(null);
  const cartCloseBtnRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartBadgeRef = useRef<HTMLSpanElement>(null);
  const prevCartCountRef = useRef<number>(cartCount);
  const mobileBackdropRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const cartBackdropRef = useRef<HTMLDivElement>(null);
  const cartPanelRef = useRef<HTMLElement>(null);
  const backTopRingRef = useRef<SVGRectElement>(null);
  const footerRef = useRef<HTMLElement>(null);

  // Subtle 0-0.4s navigation fade-down on initial load
  useGSAP(
    () => {
      if (prefersReducedMotion() || !headerRef.current || isAdminRoute) return;
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: -12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: MOTION_CONFIG.eases.primary,
          clearProps: 'transform,opacity',
        }
      );
    },
    { dependencies: [isAdminRoute] }
  );

  // Enable silky Lenis smooth mouse-wheel scrolling across all storefront routes (bypass Admin)
  useEffect(() => {
    if (isAdminRoute) {
      stopSmoothScroll();
      return;
    }
    startSmoothScroll();
    return () => {
      stopSmoothScroll();
    };
  }, [isAdminRoute]);

  // Lock native touch scroll and pause Lenis when slide-over drawers are open
  useOverlayLock(mobileMenuOpen || cartDrawerOpen);

  // Pause ambient decorative CSS animations globally whenever the browser tab is hidden
  useEffect(() => {
    const syncVisibility = () => {
      document.documentElement.dataset.hnTabHidden = document.hidden ? 'true' : 'false';
    };
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, []);

  // Mutual exclusivity when external actions (e.g. PDP "Thêm vào giỏ") open Cart Drawer
  const skipMobileFocusRestoreRef = useRef(false);
  const skipCartFocusRestoreRef = useRef(false);
  useEffect(() => {
    if (cartDrawerOpen) {
      if (mobileMenuOpen) {
        skipMobileFocusRestoreRef.current = true;
      }
      setMobileMenuOpen(false);
      setSearchOpen(false);
      setCatMenuOpen(false);
    }
  }, [cartDrawerOpen, mobileMenuOpen]);

  // Reset overlays and scroll cleanly on route navigation (including Browser Back/Forward)
  useEffect(() => {
    if (mobileMenuOpen) skipMobileFocusRestoreRef.current = true;
    if (cartDrawerOpen) skipCartFocusRestoreRef.current = true;
    setMobileMenuOpen(false);
    setCartDrawerOpen(false);
    setCatMenuOpen(false);
    setSearchOpen(false);
    if (!location.hash) {
      scrollToTop(true);
    }
    const raf = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, location.hash, setCartDrawerOpen]);

  // Header subtle depth and Back-to-Top rounded-rectangle progress border (cached maxScroll)
  useEffect(() => {
    let rafId = 0;
    let cachedMaxScroll = 1;
    const rectPerimeter = 138;

    const measureMaxScroll = () => {
      cachedMaxScroll = Math.max(
        1,
        document.documentElement.scrollHeight - window.innerHeight
      );
    };

    const updateScrollChrome = () => {
      rafId = 0;
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const progress = Math.min(1, Math.max(0, scrollY / cachedMaxScroll));

      if (backTopRingRef.current) {
        backTopRingRef.current.style.strokeDashoffset = String(
          rectPerimeter * (1 - progress)
        );
      }
      setHeaderElevated(scrollY > 24);
      setShowBackToTop(scrollY > 460);
    };

    const onScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(updateScrollChrome);
      }
    };

    const onResize = () => {
      measureMaxScroll();
      onScroll();
    };

    measureMaxScroll();
    updateScrollChrome();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && document.body) {
      ro = new ResizeObserver(() => {
        measureMaxScroll();
      });
      ro.observe(document.body);
    }

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [location.pathname]);

  // Gentle staggered footer reveal on scroll into view
  useGSAP(
    () => {
      if (prefersReducedMotion() || !footerRef.current || isAdminRoute) return;
      const cols = gsap.utils.toArray<HTMLElement>('.hn-footer-col', footerRef.current);
      if (cols.length === 0) return;
      gsap.fromTo(
        cols,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          stagger: 0.08,
          ease: MOTION_CONFIG.eases.primary,
          clearProps: 'transform,opacity',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 90%',
            once: true,
          },
        }
      );
    },
    { scope: footerRef, dependencies: [location.pathname, isAdminRoute] }
  );

  useEffect(() => {
    if (searchOpen) {
      const id = window.setTimeout(() => searchInputRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [searchOpen]);

  // Focus management for mobile navigation drawer (open -> close button, close -> menu trigger)
  const prevMobileOpenRef = useRef(false);
  useEffect(() => {
    if (mobileMenuOpen) {
      prevMobileOpenRef.current = true;
      skipMobileFocusRestoreRef.current = false;
      const id = window.setTimeout(() => mobileCloseBtnRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
    if (prevMobileOpenRef.current) {
      prevMobileOpenRef.current = false;
      if (skipMobileFocusRestoreRef.current) {
        skipMobileFocusRestoreRef.current = false;
      } else {
        menuBtnRef.current?.focus();
      }
    }
  }, [mobileMenuOpen]);

  // Focus management for slide-over cart drawer (open -> close button, close -> cart trigger)
  const prevCartOpenRef = useRef(false);
  useEffect(() => {
    if (cartDrawerOpen) {
      prevCartOpenRef.current = true;
      skipCartFocusRestoreRef.current = false;
      const id = window.setTimeout(() => cartCloseBtnRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
    if (prevCartOpenRef.current) {
      prevCartOpenRef.current = false;
      if (skipCartFocusRestoreRef.current) {
        skipCartFocusRestoreRef.current = false;
      } else {
        cartBtnRef.current?.focus();
      }
    }
  }, [cartDrawerOpen]);

  // Close category dropdown and search bar on outside pointer/touch interaction
  useEffect(() => {
    if (!catMenuOpen && !searchOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (catMenuOpen && catDropdownRef.current && !catDropdownRef.current.contains(target)) {
        setCatMenuOpen(false);
      }
      if (
        searchOpen &&
        searchPanelRef.current &&
        !searchPanelRef.current.contains(target) &&
        !searchBtnRef.current?.contains(target)
      ) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [catMenuOpen, searchOpen]);

  // Layered Escape key & drawer focus traps (mobile navigation drawer + cart drawer)
  useEffect(() => {
    if (!mobileMenuOpen && !cartDrawerOpen && !searchOpen && !catMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        // Let higher-z-index page overlays (lightboxes, modals, filter drawers) handle Escape first
        if (
          document.querySelector(
            '[data-hn-overlay-layer="lightbox"], [data-hn-overlay-layer="modal"], [data-hn-overlay-layer="drawer"]'
          )
        ) {
          return;
        }
        // Dismiss only the topmost active shell layer per Escape press
        if (cartDrawerOpen) {
          e.preventDefault();
          setCartDrawerOpen(false);
          return;
        }
        if (mobileMenuOpen) {
          e.preventDefault();
          setMobileMenuOpen(false);
          return;
        }
        if (searchOpen) {
          e.preventDefault();
          setSearchOpen(false);
          searchBtnRef.current?.focus();
          return;
        }
        if (catMenuOpen) {
          e.preventDefault();
          setCatMenuOpen(false);
          catTriggerRef.current?.focus();
          return;
        }
      }
      const activeDrawerPanel = mobileMenuOpen
        ? mobilePanelRef.current
        : cartDrawerOpen
          ? cartPanelRef.current
          : null;
      if (e.key === 'Tab' && activeDrawerPanel) {
        const focusables = activeDrawerPanel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen, cartDrawerOpen, searchOpen, catMenuOpen, setCartDrawerOpen]);

  useGSAP(
    () => {
      const prev = prevCartCountRef.current;
      prevCartCountRef.current = cartCount;
      if (cartCount > prev && cartBadgeRef.current && !prefersReducedMotion()) {
        gsap.fromTo(
          cartBadgeRef.current,
          { scale: 0.72 },
          {
            scale: 1,
            duration: MOTION_CONFIG.durations.micro + 0.12,
            ease: MOTION_CONFIG.eases.balloonPop,
            clearProps: 'transform',
          }
        );
      }
    },
    { dependencies: [cartCount] }
  );

  useGSAP(
    () => {
      if (!mobileMenuOpen || prefersReducedMotion()) return;
      if (mobileBackdropRef.current) {
        gsap.fromTo(
          mobileBackdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: MOTION_CONFIG.durations.overlay * 0.8, ease: 'power2.out' }
        );
      }
      if (mobilePanelRef.current) {
        gsap.fromTo(
          mobilePanelRef.current,
          { xPercent: -100 },
          {
            xPercent: 0,
            duration: MOTION_CONFIG.durations.overlay,
            ease: MOTION_CONFIG.eases.primary,
            clearProps: 'transform',
          }
        );
      }
    },
    { dependencies: [mobileMenuOpen] }
  );

  useGSAP(
    () => {
      if (!cartDrawerOpen || prefersReducedMotion()) return;
      if (cartBackdropRef.current) {
        gsap.fromTo(
          cartBackdropRef.current,
          { opacity: 0 },
          { opacity: 1, duration: MOTION_CONFIG.durations.overlay * 0.8, ease: 'power2.out' }
        );
      }
      if (cartPanelRef.current) {
        gsap.fromTo(
          cartPanelRef.current,
          { xPercent: 100 },
          {
            xPercent: 0,
            duration: MOTION_CONFIG.durations.overlay,
            ease: MOTION_CONFIG.eases.primary,
            clearProps: 'transform',
          }
        );
      }
    },
    { dependencies: [cartDrawerOpen] }
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    navigate(trimmed ? `/san-pham?q=${encodeURIComponent(trimmed)}` : '/san-pham');
    setSearchOpen(false);
    setMobileMenuOpen(false);
  };

  const openMobileMenu = () => {
    setSearchOpen(false);
    setCatMenuOpen(false);
    setCartDrawerOpen(false);
    setMobileMenuOpen(true);
  };

  const openCartDrawer = () => {
    setSearchOpen(false);
    setCatMenuOpen(false);
    setMobileMenuOpen(false);
    setCartDrawerOpen(true);
  };

  const toggleSearchPopover = () => {
    setCatMenuOpen(false);
    setMobileMenuOpen(false);
    setCartDrawerOpen(false);
    setSearchOpen((v) => !v);
  };

  const handleCatMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      catDropdownRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || []
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(currentIndex + 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const showAnnouncement = Boolean(
    settings?.announcement_enabled && settings?.announcement_text?.trim()
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FDFBF7] text-[#14222E]">
      {/* Confirmed announcement bar only */}
      {showAnnouncement && (
        <div className="bg-[#F4B6C8] text-[#4A1829] font-medium text-xs sm:text-[13px] py-2 px-5 text-center border-b border-[#E093AB]">
          <p className="max-w-[1320px] mx-auto truncate">{settings?.announcement_text}</p>
        </div>
      )}

      {/* 3D Liquid Glass Capsule Navbar */}
      <header
        ref={headerRef}
        className="sticky top-0 z-40 bg-transparent h-[68px] sm:h-[76px] px-4 sm:px-3.5 lg:px-4 pt-1.5 sm:pt-2 overflow-visible"
      >
        <div className="relative w-full max-w-[1408px] mx-auto">
          <div
            className={`relative w-full rounded-full hn-liquid-nav ${
              headerElevated ? 'hn-liquid-nav-scrolled' : ''
            }`}
          >
            <div className="relative z-10 h-[54px] sm:h-[60px] min-[1200px]:h-[64px] pl-1.5 sm:pl-6 lg:pl-7 min-[1360px]:pl-8 pr-[5px] sm:pr-[7px] min-[1200px]:pr-[8px] flex items-center justify-between gap-2 sm:gap-4 min-[1360px]:gap-7">
              {/* Zone 1: Brand Group */}
              <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 min-w-0">
                <button
                  ref={menuBtnRef}
                  type="button"
                  onClick={openMobileMenu}
                  className="min-[1200px]:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-[#172B35] hover:text-[#EC277A] hn-liquid-icon-btn cursor-pointer shrink-0"
                  aria-label="Mở menu điều hướng"
                  aria-expanded={mobileMenuOpen}
                  aria-controls="hn-mobile-nav-drawer"
                >
                  <Menu className="w-[18px] h-[18px]" strokeWidth={1.85} />
                </button>
                <Link
                  to="/"
                  aria-label="Trang chủ Hoa Nelly"
                  className="inline-flex items-center min-h-[44px] shrink-0 rounded-full focus-visible:outline-offset-4"
                >
                  <BrandLogo size="nav" />
                </Link>
              </div>

              {/* Zone 2: Single-Row Navigation Group (Desktop >= 1200px - avoids 1024-1199px crowding) */}
              <nav
                aria-label="Điều hướng chính"
                className="hidden min-[1200px]:flex items-center gap-5 min-[1360px]:gap-7 text-[15px] font-medium text-[#2A1F27]"
              >
                <Link
                  to="/"
                  aria-current={location.pathname === '/' ? 'page' : undefined}
                  className={`relative py-2 transition-colors duration-200 whitespace-nowrap shrink-0 after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#EC277A] after:shadow-[0_1px_6px_rgba(236,39,122,0.35)] after:transition-transform after:duration-200 after:origin-center ${
                    location.pathname === '/'
                      ? 'text-[#EC277A] after:scale-x-100'
                      : 'text-[#382B34] hover:text-[#EC277A] after:scale-x-0 hover:after:scale-x-100'
                  }`}
                >
                  Trang chủ
                </Link>

                <div
                  ref={catDropdownRef}
                  className="relative"
                  onPointerEnter={(e) => {
                    if (e.pointerType === 'mouse') {
                      setSearchOpen(false);
                      setCatMenuOpen(true);
                    }
                  }}
                  onPointerLeave={(e) => {
                    if (e.pointerType === 'mouse') setCatMenuOpen(false);
                  }}
                >
                  <button
                    ref={catTriggerRef}
                    type="button"
                    onClick={() => {
                      setSearchOpen(false);
                      setCatMenuOpen((v) => !v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setSearchOpen(false);
                        setCatMenuOpen(true);
                        requestAnimationFrame(() => {
                          catDropdownRef.current
                            ?.querySelector<HTMLElement>('[role="menuitem"]')
                            ?.focus();
                        });
                      }
                    }}
                    className={`relative inline-flex items-center gap-1 min-h-[44px] py-2 transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer after:content-[''] after:absolute after:inset-x-0 after:bottom-1 after:h-[2px] after:rounded-full after:bg-[#EC277A] after:shadow-[0_1px_6px_rgba(236,39,122,0.35)] after:transition-transform after:duration-200 after:origin-center ${
                      location.pathname.startsWith('/san-pham') ||
                      location.pathname.startsWith('/danh-muc')
                        ? 'text-[#EC277A] after:scale-x-100'
                        : 'text-[#2A1F27] hover:text-[#EC277A] after:scale-x-0 hover:after:scale-x-100'
                    }`}
                    aria-expanded={catMenuOpen}
                    aria-haspopup="menu"
                  >
                    <span>Sản phẩm</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        catMenuOpen ? 'rotate-180' : ''
                      }`}
                      strokeWidth={1.85}
                      aria-hidden="true"
                    />
                  </button>

                  {catMenuOpen && (
                    <div
                      role="menu"
                      onKeyDown={handleCatMenuKeyDown}
                      className="absolute left-0 top-full pt-2 w-64 z-50"
                    >
                      <div className="hn-liquid-popover rounded-2xl py-2">
                        <Link
                          role="menuitem"
                          to="/san-pham"
                          onClick={() => setCatMenuOpen(false)}
                          className={`flex items-center min-h-[44px] px-4 py-2 text-sm font-medium transition-colors duration-150 ${
                            location.pathname === '/san-pham'
                              ? 'text-[#EC277A] bg-white/75'
                              : 'text-[#172B35] hover:bg-white/75 hover:text-[#EC277A]'
                          }`}
                        >
                          Tất cả sản phẩm
                        </Link>
                        <div className="my-1 border-t border-[#172B35]/8" />
                        {categories.map((cat) => (
                          <Link
                            role="menuitem"
                            key={cat.slug}
                            to={`/danh-muc/${cat.slug}`}
                            onClick={() => setCatMenuOpen(false)}
                            className={`flex items-center min-h-[44px] px-4 py-2 text-sm transition-colors duration-150 ${
                              location.pathname === `/danh-muc/${cat.slug}`
                                ? 'text-[#EC277A] bg-white/75 font-medium'
                                : 'text-[#382B34] hover:bg-white/75 hover:text-[#EC277A]'
                            }`}
                          >
                            {cat.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  to="/bo-suu-tap"
                  aria-current={location.pathname.startsWith('/bo-suu-tap') ? 'page' : undefined}
                  className={`relative py-2 transition-colors duration-200 whitespace-nowrap shrink-0 after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#EC277A] after:shadow-[0_1px_6px_rgba(236,39,122,0.35)] after:transition-transform after:duration-200 after:origin-center ${
                    location.pathname.startsWith('/bo-suu-tap')
                      ? 'text-[#EC277A] after:scale-x-100'
                      : 'text-[#382B34] hover:text-[#EC277A] after:scale-x-0 hover:after:scale-x-100'
                  }`}
                >
                  Theo dịp
                </Link>

                <Link
                  to="/trang-tri-su-kien"
                  aria-current={
                    location.pathname.startsWith('/trang-tri-su-kien') ? 'page' : undefined
                  }
                  className={`relative py-2 transition-colors duration-200 whitespace-nowrap shrink-0 after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#EC277A] after:shadow-[0_1px_6px_rgba(236,39,122,0.35)] after:transition-transform after:duration-200 after:origin-center ${
                    location.pathname.startsWith('/trang-tri-su-kien')
                      ? 'text-[#EC277A] after:scale-x-100'
                      : 'text-[#382B34] hover:text-[#EC277A] after:scale-x-0 hover:after:scale-x-100'
                  }`}
                >
                  Trang trí sự kiện
                </Link>

                <Link
                  to="/thu-vien"
                  aria-current={location.pathname.startsWith('/thu-vien') ? 'page' : undefined}
                  className={`relative py-2 transition-colors duration-200 whitespace-nowrap shrink-0 after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#EC277A] after:shadow-[0_1px_6px_rgba(236,39,122,0.35)] after:transition-transform after:duration-200 after:origin-center ${
                    location.pathname.startsWith('/thu-vien')
                      ? 'text-[#EC277A] after:scale-x-100'
                      : 'text-[#382B34] hover:text-[#EC277A] after:scale-x-0 hover:after:scale-x-100'
                  }`}
                >
                  Thư viện
                </Link>

                <Link
                  to="/gioi-thieu"
                  aria-current={location.pathname.startsWith('/gioi-thieu') ? 'page' : undefined}
                  className={`relative py-2 transition-colors duration-200 whitespace-nowrap shrink-0 after:content-[''] after:absolute after:inset-x-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[#EC277A] after:shadow-[0_1px_6px_rgba(236,39,122,0.35)] after:transition-transform after:duration-200 after:origin-center ${
                    location.pathname.startsWith('/gioi-thieu')
                      ? 'text-[#EC277A] after:scale-x-100'
                      : 'text-[#382B34] hover:text-[#EC277A] after:scale-x-0 hover:after:scale-x-100'
                  }`}
                >
                  Về Hoa Nelly
                </Link>
              </nav>

              {/* Zone 3: Right Actions (Glass Search Orb, Glass Cart Orb & Glossy Pink CTA) */}
              <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                <button
                  ref={searchBtnRef}
                  type="button"
                  onClick={toggleSearchPopover}
                  className="hidden min-[420px]:inline-flex items-center justify-center w-11 h-11 rounded-full text-[#172B35] hover:text-[#EC277A] hn-liquid-icon-btn cursor-pointer"
                  aria-label="Tìm kiếm"
                  aria-expanded={searchOpen}
                  aria-controls="hn-header-search"
                >
                  <Search className="w-[17px] h-[17px]" strokeWidth={1.8} />
                </button>

                <button
                  ref={cartBtnRef}
                  type="button"
                  onClick={openCartDrawer}
                  className="relative inline-flex items-center justify-center w-11 h-11 rounded-full text-[#172B35] hover:text-[#EC277A] hn-liquid-icon-btn cursor-pointer"
                  aria-label={cartCount > 0 ? `Giỏ hàng (${cartCount} sản phẩm)` : 'Giỏ hàng'}
                  aria-expanded={cartDrawerOpen}
                  aria-controls="hn-cart-drawer"
                >
                  <ShoppingBag className="w-[17px] h-[17px]" strokeWidth={1.8} />
                  {cartCount > 0 && (
                    <span
                      ref={cartBadgeRef}
                      className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#D91162] text-white text-[10.5px] font-semibold flex items-center justify-center tabular-nums shadow-sm"
                    >
                      {cartCount}
                    </span>
                  )}
                </button>

                <Link
                  to="/dat-thiet-ke-rieng"
                  className="group hidden md:inline-flex items-center justify-center gap-2 min-h-[44px] h-[44px] px-5 min-[1360px]:px-6 rounded-full hn-liquid-cta text-[#5B1B35] text-[14px] min-[1360px]:text-[15px] font-semibold whitespace-nowrap shrink-0"
                >
                  <span className="relative z-10">Đặt mẫu theo yêu cầu</span>
                  <ArrowRight
                    className="relative z-10 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>

          {/* Floating Liquid-Glass Search Popover (keeps navbar capsule intact) */}
          {searchOpen && (
            <div
              id="hn-header-search"
              ref={searchPanelRef}
              className="absolute left-0 right-0 top-full mt-2.5 z-50 max-w-2xl mx-auto"
            >
              <form
                onSubmit={handleSearchSubmit}
                className="hn-liquid-popover rounded-full pl-4 pr-1.5 sm:pl-5 sm:pr-2 py-1.5 flex items-center gap-2"
              >
                <Search className="w-4 h-4 text-[#382B34]/75 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm bó tulip, cúc họa mi, tạo hình cử nhân, túi quà sinh nhật..."
                  aria-label="Nhập từ khóa tìm kiếm sản phẩm"
                  className="flex-1 min-w-0 min-h-[44px] bg-transparent text-sm text-[#172B35] placeholder:text-[#382B34]/55 py-1.5 focus:outline-none"
                />
                <button
                  type="submit"
                  className="hn-liquid-cta min-h-[44px] px-4 py-2 rounded-full text-[#5B1B35] text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer inline-flex items-center justify-center"
                >
                  <span className="relative z-10">Tìm kiếm</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    searchBtnRef.current?.focus();
                  }}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-full text-[#382B34] hover:text-[#EC277A] hover:bg-white/70 transition-colors cursor-pointer shrink-0"
                  aria-label="Đóng thanh tìm kiếm"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 bg-[#FDFBF7]">
        <RouteTransition>{children}</RouteTransition>
      </main>

      {/* Footer */}
      <footer ref={footerRef} className="bg-gradient-to-b from-[#FDFBF7] to-[#F8F5EE] border-t border-[#EFECE4] mt-12 sm:mt-16 lg:mt-20">
        <div className="hn-container py-12 sm:py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
            {/* Column 1: Brand intro */}
            <div className="hn-footer-col space-y-4">
              <BrandLogo size="md" />
              <p className="text-sm text-[#5C6F80] leading-relaxed">
                {settings?.brand_tagline ||
                  'Hoa Bóng Bay Nghệ Thuật, Tạo Hình Nhân Vật, Phụ Kiện Sinh Nhật, Trang Trí Sự Kiện & Quà Tặng.'}
              </p>
              {settings?.business_entity_info && (
                <p className="text-xs text-[#5C6F80]">{settings.business_entity_info}</p>
              )}
            </div>

            {/* Column 2: Categories */}
            <div className="hn-footer-col">
              <h3 className="font-serif text-base font-semibold text-[#14222E] mb-3 sm:mb-4">
                Danh mục chính
              </h3>
              <ul className="space-y-0 sm:space-y-2.5 text-sm text-[#5C6F80]">
                {categories.map((c) => (
                  <li key={c.slug}>
                    <Link
                      to={`/danh-muc/${c.slug}`}
                      className="inline-flex items-center min-h-[44px] sm:min-h-0 py-1 sm:py-0 hover:text-[#006A9E] transition-colors"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    to="/dat-thiet-ke-rieng"
                    className="inline-flex items-center min-h-[44px] sm:min-h-0 py-1 sm:py-0 hover:text-[#006A9E] transition-colors"
                  >
                    Đặt thiết kế theo yêu cầu
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 3: Support & Policies */}
            <div className="hn-footer-col">
              <h3 className="font-serif text-base font-semibold text-[#14222E] mb-3 sm:mb-4">
                Hỗ trợ &amp; Chính sách
              </h3>
              <ul className="space-y-0 sm:space-y-2.5 text-sm text-[#5C6F80]">
                <li>
                  <Link
                    to="/tra-cuu-don-hang"
                    className="inline-flex items-center min-h-[44px] sm:min-h-0 py-1 sm:py-0 hover:text-[#006A9E] transition-colors"
                  >
                    Tra cứu đơn hàng
                  </Link>
                </li>
                <li>
                  <Link
                    to="/huong-dan-va-hoi-dap"
                    className="inline-flex items-center min-h-[44px] sm:min-h-0 py-1 sm:py-0 hover:text-[#006A9E] transition-colors"
                  >
                    Hướng dẫn đặt hàng &amp; Hỏi đáp
                  </Link>
                </li>
                <li>
                  <Link
                    to="/chinh-sach/giao-nhan"
                    className="inline-flex items-center min-h-[44px] sm:min-h-0 py-1 sm:py-0 hover:text-[#006A9E] transition-colors"
                  >
                    Chính sách giao nhận
                  </Link>
                </li>
                <li>
                  <Link
                    to="/chinh-sach/doi-huy-don-hang"
                    className="inline-flex items-center min-h-[44px] sm:min-h-0 py-1 sm:py-0 hover:text-[#006A9E] transition-colors"
                  >
                    Đổi, hủy và xử lý đơn hàng
                  </Link>
                </li>
                <li>
                  <Link
                    to="/chinh-sach/quy-dinh-danh-gia"
                    className="inline-flex items-center min-h-[44px] sm:min-h-0 py-1 sm:py-0 hover:text-[#006A9E] transition-colors"
                  >
                    Quy định đăng đánh giá
                  </Link>
                </li>
                <li>
                  <Link
                    to="/chinh-sach"
                    className="inline-flex items-center min-h-[44px] sm:min-h-0 py-1 sm:py-0 hover:text-[#006A9E] transition-colors"
                  >
                    Xem tất cả chính sách
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Store Contact */}
            <div className="hn-footer-col">
              <h3 className="font-serif text-base font-semibold text-[#14222E] mb-3 sm:mb-4">
                Thông tin liên hệ
              </h3>
              <dl className="space-y-1 sm:space-y-2.5 text-sm text-[#5C6F80]">
                <div>
                  <dt className="inline font-medium text-[#14222E]">Điện thoại: </dt>
                  <dd className="inline">
                    <a
                      href={`tel:${(settings?.phone || '0376434207').replace(/\s+/g, '')}`}
                      className="inline-flex items-center min-h-[44px] sm:min-h-0 hover:text-[#006A9E] tabular-nums"
                    >
                      {settings?.phone || '0376434207'}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt className="inline font-medium text-[#14222E]">Email: </dt>
                  <dd className="inline">
                    <a
                      href={`mailto:${settings?.email || 'xuantruong252000@gmail.com'}`}
                      className="inline-flex items-center min-h-[44px] sm:min-h-0 hover:text-[#006A9E] break-all"
                    >
                      {settings?.email || 'xuantruong252000@gmail.com'}
                    </a>
                  </dd>
                </div>
                <div className="pt-1 sm:pt-0">
                  <dt className="inline font-medium text-[#14222E]">Giờ hoạt động: </dt>
                  <dd className="inline tabular-nums">
                    {settings?.business_hours || '7:00 - 23:00'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-10 sm:mt-12 pt-6 border-t border-[#EFECE4] flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs text-[#5C6F80]">
            <p>© {new Date().getFullYear()} Hoa Nelly. Tất cả nội dung giá hiển thị bằng VNĐ.</p>
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
              <Link to="/lien-he" className="inline-flex items-center min-h-[44px] sm:min-h-0 px-1.5 sm:px-0 hover:text-[#006A9E]">
                Liên hệ
              </Link>
              <Link to="/tra-cuu-don-hang" className="inline-flex items-center min-h-[44px] sm:min-h-0 px-1.5 sm:px-0 hover:text-[#006A9E]">
                Tra cứu đơn
              </Link>
              <Link to="/quan-tri" className="inline-flex items-center min-h-[44px] sm:min-h-0 px-1.5 sm:px-0 hover:text-[#006A9E]">
                Quản trị cửa hàng
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile & Tablet Liquid Glass Navigation Drawer (Portaled to body at z-[60]) */}
      {mobileMenuOpen &&
        createPortal(
          <div
            id="hn-mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu điều hướng"
            className="fixed inset-0 z-[60] min-[1200px]:hidden flex"
          >
            <div
              ref={mobileBackdropRef}
              className="fixed inset-0 bg-[#172B35]/38 backdrop-blur-[3px]"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div
              ref={mobilePanelRef}
              data-lenis-prevent
              className="relative z-10 w-full max-w-[320px] hn-liquid-drawer h-full flex flex-col overflow-y-auto overscroll-contain"
            >
              <div className="flex items-center justify-between px-4 h-16 border-b border-[#172B35]/10 shrink-0">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Trang chủ Hoa Nelly"
                  className="inline-flex items-center min-h-[44px] shrink-0"
                >
                  <BrandLogo size="sm" />
                </Link>
                <button
                  ref={mobileCloseBtnRef}
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-11 h-11 inline-flex items-center justify-center rounded-full text-[#172B35] hover:text-[#EC277A] hn-liquid-icon-btn cursor-pointer shrink-0"
                  aria-label="Đóng menu"
                >
                  <X className="w-4 h-4" strokeWidth={1.9} />
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4 flex-1">
                <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm sản phẩm..."
                    aria-label="Tìm sản phẩm"
                    className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2.5 text-sm bg-white/80 border border-[#172B35]/12 rounded-full text-[#172B35] placeholder:text-[#382B34]/55 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="hn-liquid-cta w-11 h-11 inline-flex items-center justify-center rounded-full text-[#5B1B35] shrink-0 cursor-pointer"
                    aria-label="Tìm kiếm"
                  >
                    <Search className="w-4 h-4 relative z-10" strokeWidth={2} />
                  </button>
                </form>

                <nav aria-label="Điều hướng di động" className="space-y-0.5">
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={location.pathname === '/' ? 'page' : undefined}
                    className={`flex items-center min-h-[44px] py-2 text-[15px] font-medium transition-colors ${
                      location.pathname === '/'
                        ? 'text-[#EC277A]'
                        : 'text-[#382B34] hover:text-[#EC277A]'
                    }`}
                  >
                    Trang chủ
                  </Link>
                  <Link
                    to="/san-pham"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={location.pathname === '/san-pham' ? 'page' : undefined}
                    className={`flex items-center min-h-[44px] py-2 text-[15px] font-medium transition-colors ${
                      location.pathname.startsWith('/san-pham') ||
                      location.pathname.startsWith('/danh-muc')
                        ? 'text-[#EC277A]'
                        : 'text-[#382B34] hover:text-[#EC277A]'
                    }`}
                  >
                    Sản phẩm
                  </Link>
                  <div className="pl-3.5 space-y-0.5 border-l border-[#172B35]/12">
                    {categories.map((c) => (
                      <Link
                        key={c.slug}
                        to={`/danh-muc/${c.slug}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center min-h-[44px] py-1.5 text-sm transition-colors ${
                          location.pathname === `/danh-muc/${c.slug}`
                            ? 'text-[#EC277A] font-medium'
                            : 'text-[#4A5C6B] hover:text-[#EC277A]'
                        }`}
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                  <Link
                    to="/bo-suu-tap"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={location.pathname.startsWith('/bo-suu-tap') ? 'page' : undefined}
                    className={`flex items-center min-h-[44px] py-2 text-[15px] font-medium transition-colors ${
                      location.pathname.startsWith('/bo-suu-tap')
                        ? 'text-[#EC277A]'
                        : 'text-[#382B34] hover:text-[#EC277A]'
                    }`}
                  >
                    Theo dịp
                  </Link>
                  <Link
                    to="/trang-tri-su-kien"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={
                      location.pathname.startsWith('/trang-tri-su-kien') ? 'page' : undefined
                    }
                    className={`flex items-center min-h-[44px] py-2 text-[15px] font-medium transition-colors ${
                      location.pathname.startsWith('/trang-tri-su-kien')
                        ? 'text-[#EC277A]'
                        : 'text-[#382B34] hover:text-[#EC277A]'
                    }`}
                  >
                    Trang trí sự kiện
                  </Link>
                  <Link
                    to="/thu-vien"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={location.pathname.startsWith('/thu-vien') ? 'page' : undefined}
                    className={`flex items-center min-h-[44px] py-2 text-[15px] font-medium transition-colors ${
                      location.pathname.startsWith('/thu-vien')
                        ? 'text-[#EC277A]'
                        : 'text-[#382B34] hover:text-[#EC277A]'
                    }`}
                  >
                    Thư viện
                  </Link>
                  <Link
                    to="/gioi-thieu"
                    onClick={() => setMobileMenuOpen(false)}
                    aria-current={location.pathname.startsWith('/gioi-thieu') ? 'page' : undefined}
                    className={`flex items-center min-h-[44px] py-2 text-[15px] font-medium transition-colors ${
                      location.pathname.startsWith('/gioi-thieu')
                        ? 'text-[#EC277A]'
                        : 'text-[#382B34] hover:text-[#EC277A]'
                    }`}
                  >
                    Về Hoa Nelly
                  </Link>

                  <div className="pt-3 mt-3 border-t border-[#172B35]/10 space-y-0.5">
                    <Link
                      to="/huong-dan-va-hoi-dap"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center min-h-[44px] py-2 text-sm text-[#4A5C6B] hover:text-[#EC277A]"
                    >
                      Hướng dẫn &amp; Hỏi đáp
                    </Link>
                    <Link
                      to="/tra-cuu-don-hang"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center min-h-[44px] py-2 text-sm text-[#4A5C6B] hover:text-[#EC277A]"
                    >
                      Tra cứu đơn hàng
                    </Link>
                    <Link
                      to="/lien-he"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center min-h-[44px] py-2 text-sm text-[#4A5C6B] hover:text-[#EC277A]"
                    >
                      Liên hệ
                    </Link>
                  </div>
                </nav>
              </div>

              <div className="p-4 sm:p-5 border-t border-[#172B35]/10 bg-white/55 shrink-0">
                <Link
                  to="/dat-thiet-ke-rieng"
                  onClick={() => setMobileMenuOpen(false)}
                  className="group hn-liquid-cta flex items-center justify-center gap-2 w-full h-12 rounded-full text-[#5B1B35] text-sm font-semibold"
                >
                  <span className="relative z-10">Đặt mẫu theo yêu cầu</span>
                  <ArrowRight
                    className="relative z-10 w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Slide-over Cart Drawer (Portaled to body at z-[60]) */}
      {cartDrawerOpen &&
        createPortal(
          <div
            id="hn-cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Giỏ hàng"
            className="fixed inset-0 z-[60] flex justify-end"
          >
            <div
              ref={cartBackdropRef}
              className="fixed inset-0 bg-[#14222E]/40 backdrop-blur-[1px]"
              onClick={() => setCartDrawerOpen(false)}
            />
            <aside
              ref={cartPanelRef}
              className="relative z-10 w-full max-w-md bg-[#FDFBF7] h-full flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-[#EFECE4] bg-[#FDFBF7] shrink-0">
                <h2 className="font-serif text-lg font-medium text-[#14222E]">
                  Giỏ hàng ({cartCount})
                </h2>
                <button
                  ref={cartCloseBtnRef}
                  type="button"
                  onClick={() => setCartDrawerOpen(false)}
                  className="w-11 h-11 inline-flex items-center justify-center rounded-xl text-[#4A1829] bg-[#F9E1E8]/75 hover:bg-[#F4B6C8] cursor-pointer"
                  aria-label="Đóng giỏ hàng"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div data-lenis-prevent className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-14 space-y-4">
                    <ShoppingBag className="w-10 h-10 mx-auto text-[#D83995]" />
                    <p className="text-sm text-[#5C6F80]">Giỏ hàng của bạn đang trống.</p>
                    <Link
                      to="/san-pham"
                      onClick={() => setCartDrawerOpen(false)}
                      className="hn-btn-primary inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 text-sm font-semibold"
                    >
                      Khám phá sản phẩm
                    </Link>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.cart_key}
                      className="flex gap-3.5 bg-[#FDFBF7] p-3.5 rounded-xl border border-[#EFECE4]"
                    >
                      <Link
                        to={`/san-pham/${item.product_slug}`}
                        onClick={() => setCartDrawerOpen(false)}
                        className="w-20 h-24 rounded-lg overflow-hidden bg-[#F8F5EE] shrink-0"
                      >
                        <SafeImage src={item.product_image} alt={item.product_name} preset="thumbnail" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <Link
                            to={`/san-pham/${item.product_slug}`}
                            onClick={() => setCartDrawerOpen(false)}
                            className="text-sm font-semibold text-[#14222E] hover:text-[#006A9E] line-clamp-2 py-1"
                          >
                            {item.product_name}
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.cart_key)}
                            className="w-11 h-11 -mr-2 -mt-2 inline-flex items-center justify-center rounded-xl text-[#5C6F80] hover:text-red-700 hover:bg-[#F9E1E8]/60 shrink-0 cursor-pointer"
                            aria-label={`Xóa ${item.product_name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {Object.values(item.selected_variants).length > 0 && (
                          <p className="text-xs text-[#5C6F80] mt-0.5">
                            {Object.values(item.selected_variants)
                              .map((v) => v.label)
                              .join(' · ')}
                          </p>
                        )}
                        {item.selected_addons.length > 0 && (
                          <p className="text-xs text-[#5C6F80] mt-0.5">
                            Kèm: {item.selected_addons.map((a) => a.label).join(', ')}
                          </p>
                        )}
                        {item.personalization.custom_text && (
                          <p className="text-xs text-[#006A9E] mt-0.5">
                            Chữ in: &ldquo;{item.personalization.custom_text}&rdquo;
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="inline-flex items-center border border-[#E093AB] rounded-xl bg-[#F9E1E8]">
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.cart_key, item.quantity - 1)}
                              className="w-11 h-11 inline-flex items-center justify-center text-[#4A1829] hover:bg-[#F4B6C8] rounded-l-xl cursor-pointer"
                              aria-label="Giảm số lượng"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-8 text-center text-xs font-semibold tabular-nums text-[#4A1829]">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.cart_key, item.quantity + 1)}
                              className="w-11 h-11 inline-flex items-center justify-center text-[#4A1829] hover:bg-[#F4B6C8] rounded-r-xl cursor-pointer"
                              aria-label="Tăng số lượng"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-sm font-semibold text-[#006A9E] tabular-nums">
                            {formatVnd(item.line_total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 border-t border-[#EFECE4] bg-[#FDFBF7] space-y-3 shrink-0">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#5C6F80]">Tạm tính sản phẩm</span>
                    <span className="text-base font-semibold text-[#14222E] tabular-nums">
                      {formatVnd(cartGrandTotal)}
                    </span>
                  </div>
                  <p className="text-xs text-[#5C6F80]">
                    Phí giao hàng sẽ được tính hoặc xác nhận rõ ở bước đặt hàng.
                  </p>
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <Link
                      to="/gio-hang"
                      onClick={() => setCartDrawerOpen(false)}
                      className="hn-btn-secondary inline-flex items-center justify-center min-h-[44px] text-center py-2.5 px-3 text-sm font-medium"
                    >
                      Xem giỏ hàng
                    </Link>
                    <Link
                      to="/dat-hang"
                      onClick={() => setCartDrawerOpen(false)}
                      className="hn-btn-primary inline-flex items-center justify-center min-h-[44px] text-center py-2.5 px-3 text-sm font-semibold"
                    >
                      Đặt hàng
                    </Link>
                  </div>
                </div>
              )}
            </aside>
          </div>,
          document.body
        )}

      {/* Smooth Back-to-Top Floating Rounded-Rectangle Button (z-30, clears mobile PDP sticky bar) */}
      {!isAdminRoute && (
        <button
          type="button"
          onClick={() => scrollToTop(false)}
          aria-label="Cuộn lên đầu trang"
          className={`fixed right-5 z-30 w-12 h-11 rounded-xl bg-[#F4B6C8]/95 text-[#4A1829] shadow-[0_12px_28px_-10px_rgba(196,94,128,0.45)] border border-[#E093AB] inline-flex items-center justify-center transition-all duration-300 hover:bg-[#EC9EB5] hover:text-[#3C1020] cursor-pointer ${
            isProductDetailRoute ? 'bottom-24 lg:bottom-6' : 'bottom-6'
          } ${
            showBackToTop && !mobileMenuOpen && !cartDrawerOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-3 pointer-events-none'
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 48 44"
            className="absolute inset-0 w-full h-full pointer-events-none"
          >
            <rect
              x="2"
              y="2"
              width="44"
              height="40"
              rx="10"
              ry="10"
              fill="none"
              stroke="rgba(74,24,41,0.16)"
              strokeWidth="2"
            />
            <rect
              ref={backTopRingRef}
              x="2"
              y="2"
              width="44"
              height="40"
              rx="10"
              ry="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={138}
              strokeDashoffset={138}
            />
          </svg>
          <ArrowUp className="w-4 h-4 relative z-10" aria-hidden="true" />
        </button>
      )}

      {/* Subtle Toast (z-[80], non-blocking pointer-events-none so it never blocks touch targets) */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-5 z-[80] pointer-events-none max-w-sm bg-[#14222E] text-white text-sm px-4 py-3 rounded-xl shadow-lg ${
            isProductDetailRoute ? 'bottom-24 lg:bottom-20' : 'bottom-20'
          }`}
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
