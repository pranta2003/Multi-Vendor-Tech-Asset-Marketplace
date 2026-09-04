import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useCartStore } from '../store/cart.store';
import { useCurrencyStore } from '../store/currency.store';
import type { Currency } from '../lib/types';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `text-sm font-medium transition-colors ${isActive ? 'text-brand-700' : 'text-slate-600 hover:text-slate-900'}`;

export const Layout = (): JSX.Element => {
  const { user, logout } = useAuthStore();
  const cart = useCartStore((s) => s.cart);
  const resetCart = useCartStore((s) => s.reset);
  const { currency, setCurrency } = useCurrencyStore();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    resetCart();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-surface-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3.5">
          <Link to="/" className="text-lg font-extrabold tracking-tight text-slate-900">
            Asset<span className="text-brand-600">Hub</span>
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            <NavLink to="/" className={navLinkClass} end>Browse</NavLink>
            {user && <NavLink to="/library" className={navLinkClass}>My library</NavLink>}
            {user && <NavLink to="/orders" className={navLinkClass}>Orders</NavLink>}
            {user?.role === 'VENDOR' && <NavLink to="/vendor" className={navLinkClass}>Vendor</NavLink>}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <label className="sr-only" htmlFor="currency">Currency</label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="rounded-lg border border-surface-border bg-white px-2 py-1.5 text-sm font-medium"
            >
              <option value="BDT">BDT</option>
              <option value="USD">USD</option>
            </select>

            <Link to="/cart" className="relative rounded-lg p-2 hover:bg-slate-100" aria-label="Cart">
              <svg className="h-5 w-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.5l1.7 9.4a2 2 0 002 1.6h7.9a2 2 0 002-1.6L19 6H5.3M8 19a1 1 0 11-2 0 1 1 0 012 0zm10 0a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
              {!!cart?.itemCount && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">
                  {cart.itemCount}
                </span>
              )}
            </Link>

            {user ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-slate-600 sm:inline">{user.fullName}</span>
                <button onClick={handleLogout} className="btn-secondary py-2">Sign out</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-secondary py-2">Sign in</Link>
                <Link to="/register" className="btn-primary py-2">Get started</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-surface-border bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 text-sm text-slate-500">
          AssetHub - a multi-vendor marketplace for UI kits, templates and courses.
        </div>
      </footer>
    </div>
  );
};
