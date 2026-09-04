import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuthStore } from './store/auth.store';
import { useCartStore } from './store/cart.store';
import { useCurrencyStore } from './store/currency.store';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { StripeCheckoutPage } from './pages/StripeCheckoutPage';
import { CheckoutProcessingPage } from './pages/CheckoutProcessingPage';
import { CheckoutResultPage } from './pages/CheckoutResultPage';
import { OrdersPage } from './pages/OrdersPage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { LibraryPage } from './pages/LibraryPage';
import { VendorPage } from './pages/VendorPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App = (): JSX.Element => {
  const { user, initialising, initialise } = useAuthStore();
  const currency = useCurrencyStore((s) => s.currency);
  const loadCart = useCartStore((s) => s.load);

  // Silent refresh on cold load, so a page reload does not log the user out.
  useEffect(() => { void initialise(); }, [initialise]);

  // Prime the cart once we know who the user is, so the header badge is correct
  // on first paint. Vendors have no cart, so we skip the guaranteed 403.
  useEffect(() => {
    if (!initialising && user && user.role !== 'VENDOR') void loadCart(currency);
  }, [initialising, user, currency, loadCart]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<CatalogPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />

            {/* Redirect authenticated users away from the auth screens. */}
            <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
            <Route path="/register" element={user ? <Navigate to="/" replace /> : <RegisterPage />} />

            <Route path="/cart" element={<ProtectedRoute roles={['CUSTOMER', 'ADMIN']}><CartPage /></ProtectedRoute>} />
            <Route path="/checkout" element={<ProtectedRoute roles={['CUSTOMER', 'ADMIN']}><CheckoutPage /></ProtectedRoute>} />
            <Route path="/checkout/stripe/:orderNumber" element={<ProtectedRoute><StripeCheckoutPage /></ProtectedRoute>} />

            {/*
              These three paths are the SPA targets of the server's 303
              redirects from the SSLCommerz browser callbacks. They must match
              CLIENT_ORIGIN + /checkout/{processing,failed,cancelled} exactly.
            */}
            <Route path="/checkout/processing" element={<ProtectedRoute><CheckoutProcessingPage /></ProtectedRoute>} />
            <Route path="/checkout/failed" element={<CheckoutResultPage variant="failed" />} />
            <Route path="/checkout/cancelled" element={<CheckoutResultPage variant="cancelled" />} />

            <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
            <Route path="/orders/:orderNumber" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
            <Route path="/library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
            <Route path="/vendor" element={<ProtectedRoute roles={['VENDOR', 'ADMIN']}><VendorPage /></ProtectedRoute>} />

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
};
