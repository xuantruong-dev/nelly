import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext.tsx';
import { Layout } from './components/Layout.tsx';
import { HomePage } from './pages/HomePage.tsx';

const CatalogPage = lazy(() =>
  import('./pages/CatalogPage.tsx').then((m) => ({ default: m.CatalogPage }))
);
const ProductDetailPage = lazy(() =>
  import('./pages/ProductDetailPage.tsx').then((m) => ({ default: m.ProductDetailPage }))
);
const CustomDesignPage = lazy(() =>
  import('./pages/CustomDesignPage.tsx').then((m) => ({ default: m.CustomDesignPage }))
);
const EventDecorationPage = lazy(() =>
  import('./pages/EventDecorationPage.tsx').then((m) => ({ default: m.EventDecorationPage }))
);
const GalleryPage = lazy(() =>
  import('./pages/GalleryPage.tsx').then((m) => ({ default: m.GalleryPage }))
);
const AboutPage = lazy(() =>
  import('./pages/AboutPage.tsx').then((m) => ({ default: m.AboutPage }))
);
const GuideFaqPage = lazy(() =>
  import('./pages/GuideFaqPage.tsx').then((m) => ({ default: m.GuideFaqPage }))
);
const ContactPage = lazy(() =>
  import('./pages/ContactPage.tsx').then((m) => ({ default: m.ContactPage }))
);
const CartPage = lazy(() =>
  import('./pages/CartPage.tsx').then((m) => ({ default: m.CartPage }))
);
const CheckoutPage = lazy(() =>
  import('./pages/CheckoutPage.tsx').then((m) => ({ default: m.CheckoutPage }))
);
const OrderTrackingPage = lazy(() =>
  import('./pages/OrderTrackingPage.tsx').then((m) => ({ default: m.OrderTrackingPage }))
);
const PoliciesPage = lazy(() =>
  import('./pages/PoliciesPage.tsx').then((m) => ({ default: m.PoliciesPage }))
);
const AdminPage = lazy(() =>
  import('./pages/AdminPage.tsx').then((m) => ({ default: m.AdminPage }))
);
const NotFoundPage = lazy(() =>
  import('./pages/NotFoundPage.tsx').then((m) => ({ default: m.NotFoundPage }))
);

function RouteLoadingFallback() {
  return (
    <div className="hn-container py-20 min-h-[52vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#EBC6D4] border-t-[#D83995] animate-spin" aria-label="Đang tải trang" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Layout>
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/san-pham" element={<CatalogPage mode="all" />} />
              <Route path="/danh-muc/:slug" element={<CatalogPage mode="category" />} />
              <Route path="/san-pham/:slug" element={<ProductDetailPage />} />
              <Route path="/bo-suu-tap" element={<CatalogPage mode="occasion" />} />
              <Route path="/bo-suu-tap/:occasionSlug" element={<CatalogPage mode="occasion" />} />
              <Route path="/dat-thiet-ke-rieng" element={<CustomDesignPage />} />
              <Route path="/trang-tri-su-kien" element={<EventDecorationPage />} />
              <Route path="/thu-vien" element={<GalleryPage />} />
              <Route path="/gioi-thieu" element={<AboutPage />} />
              <Route path="/huong-dan-va-hoi-dap" element={<GuideFaqPage />} />
              <Route path="/lien-he" element={<ContactPage />} />
              <Route path="/gio-hang" element={<CartPage />} />
              <Route path="/dat-hang" element={<CheckoutPage />} />
              <Route path="/tra-cuu-don-hang" element={<OrderTrackingPage />} />
              <Route path="/don-hang/:orderCode" element={<OrderTrackingPage />} />
              <Route path="/chinh-sach" element={<PoliciesPage />} />
              <Route path="/chinh-sach/:slug" element={<PoliciesPage />} />
              <Route path="/quan-tri" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </StoreProvider>
    </BrowserRouter>
  );
}
