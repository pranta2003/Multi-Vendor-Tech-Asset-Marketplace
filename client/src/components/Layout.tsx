import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useCartStore } from '../store/cart.store';
import { useCurrencyStore } from '../store/currency.store';
import { ThemeToggle } from './ThemeToggle';
import type { Currency } from '../lib/types';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `text-sm font-medium transition-colors ${
    isActive
      ? 'text-brand-600 font-semibold dark:text-brand-400'
      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `block rounded-lg px-3 py-2 text-base font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 font-semibold'
      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
  }`;

export const Layout = (): JSX.Element => {
  const { user, logout } = useAuthStore();
  const cart = useCartStore((s) => s.cart);
  const resetCart = useCartStore((s) => s.reset);
  const { currency, setCurrency } = useCurrencyStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async (): Promise<void> => {
    await logout();
    resetCart();
    setMobileMenuOpen(false);
    navigate('/');
  };

  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted text-slate-800 transition-colors duration-150 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-surface-border bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-6 sm:py-3.5">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white shadow-sm">
              AH
            </span>
            <span>
              Asset<span className="text-brand-600 dark:text-brand-400">Hub</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-6 md:flex">
            <NavLink to="/" className={navLinkClass} end>
              Browse
            </NavLink>
            {user && (
              <NavLink to="/library" className={navLinkClass}>
                My library
              </NavLink>
            )}
            {user && (
              <NavLink to="/orders" className={navLinkClass}>
                Orders
              </NavLink>
            )}
            {user?.role === 'VENDOR' && (
              <NavLink to="/vendor" className={navLinkClass}>
                Vendor Portal
              </NavLink>
            )}
          </nav>

          {/* Header Actions */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Currency selector */}
            <div className="relative">
              <label className="sr-only" htmlFor="currency">
                Currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                className="h-9 rounded-lg border border-surface-border bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="BDT">BDT (৳)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Cart Icon */}
            <Link
              to="/cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label="Cart"
            >
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 3h1.5l1.7 9.4a2 2 0 002 1.6h7.9a2 2 0 002-1.6L19 6H5.3M8 19a1 1 0 11-2 0 1 1 0 012 0zm10 0a1 1 0 11-2 0 1 1 0 012 0z"
                />
              </svg>
              {Boolean(cart?.itemCount) && (
                <span className="absolute -right-1 -top-1 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white shadow-sm">
                  {cart?.itemCount}
                </span>
              )}
            </Link>

            {/* User Session or Login (Desktop) */}
            <div className="hidden items-center gap-2 sm:flex">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName}
                        className="h-8 w-8 rounded-full border border-brand-500/30 object-cover"
                      />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                        {getInitials(user.fullName)}
                      </span>
                    )}
                    <span className="max-w-[120px] truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                      {user.fullName}
                    </span>
                  </div>
                  <button onClick={handleLogout} className="btn-secondary h-9 px-3 text-xs">
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className="btn-secondary h-9 px-3 text-xs">
                    Sign in
                  </Link>
                  <Link to="/register" className="btn-primary h-9 px-3 text-xs">
                    Get started
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border bg-white text-slate-700 shadow-sm md:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="border-b border-surface-border bg-white px-4 py-4 md:hidden dark:border-slate-800 dark:bg-slate-900">
            <nav className="space-y-1">
              <NavLink to="/" className={mobileNavLinkClass} end onClick={() => setMobileMenuOpen(false)}>
                Browse Catalog
              </NavLink>
              {user && (
                <NavLink to="/library" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  My Library
                </NavLink>
              )}
              {user && (
                <NavLink to="/orders" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  Orders
                </NavLink>
              )}
              {user?.role === 'VENDOR' && (
                <NavLink to="/vendor" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  Vendor Dashboard
                </NavLink>
              )}
            </nav>

            <div className="mt-4 border-t border-surface-border pt-4 dark:border-slate-800">
              {user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName}
                        className="h-9 w-9 rounded-full border border-brand-500/30 object-cover"
                      />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                        {getInitials(user.fullName)}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user.fullName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="btn-secondary w-full py-2 text-sm">
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-secondary w-full py-2 text-center text-sm"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-primary w-full py-2 text-center text-sm"
                  >
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-surface-border bg-white py-8 transition-colors duration-150 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-brand-600 text-xs text-white">
                  AH
                </span>
                <span>
                  Asset<span className="text-brand-600 dark:text-brand-400">Hub</span>
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Premium multi-vendor marketplace for UI kits, templates, code boilerplates, and developer courses.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 dark:text-slate-400">
              <Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400">
                Browse
              </Link>
              <Link to="/login" className="hover:text-brand-600 dark:hover:text-brand-400">
                Sign In
              </Link>
              <Link to="/register" className="hover:text-brand-600 dark:hover:text-brand-400">
                Sell Assets
              </Link>
              <span>Instant Digital Delivery</span>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6 text-center text-xs text-slate-400 dark:border-slate-800/80 dark:text-slate-500">
            &copy; {new Date().getFullYear()} AssetHub Marketplace. Built with React, Express, Prisma & Tailwind CSS.
          </div>
        </div>
      </footer>
    </div>
  );
};
