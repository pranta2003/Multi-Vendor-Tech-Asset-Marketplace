import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useCartStore } from '../store/cart.store';
import { useCurrencyStore } from '../store/currency.store';
import { ThemeToggle } from './ThemeToggle';
import type { Currency } from '../lib/types';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
    isActive
      ? 'bg-brand-50 text-brand-700 font-semibold shadow-2xs dark:bg-brand-950/80 dark:text-brand-300 dark:border dark:border-brand-800/60'
      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }): string =>
  `block rounded-xl px-3.5 py-2.5 text-base font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/80 dark:text-brand-200 dark:border dark:border-brand-800/60 font-semibold'
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
    <div className="flex min-h-screen flex-col bg-slate-50/70 text-slate-800 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-100 print:bg-white print:text-slate-900 print:min-h-0">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/85 print:hidden shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:shadow-none">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-6 sm:py-3.5">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 text-lg font-black tracking-tight text-slate-900 dark:text-white group">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-600 text-sm font-black text-white shadow-sm shadow-brand-600/30 ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
              AH
            </span>
            <span className="tracking-tight">
              Asset<span className="text-brand-600 dark:text-brand-400">Hub</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-1.5 md:flex">
            <NavLink to="/" className={navLinkClass} end>
              Browse Catalog
            </NavLink>
            <NavLink to="/contact" className={navLinkClass}>
              Support
            </NavLink>
            {user && (

              <NavLink to="/account" className={navLinkClass}>
                My Account
              </NavLink>
            )}
            {user && (
              <NavLink to="/library" className={navLinkClass}>
                Digital Library
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

          {/* Right Action Controls */}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Currency Selector */}
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as Currency)}
                aria-label="Select currency"
                className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:border-slate-300 focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="USD">USD ($)</option>
                <option value="BDT">BDT (৳)</option>
              </select>
            </div>

            {/* Dark/Light Mode Theme Toggle */}
            <ThemeToggle />

            {/* Cart Button */}
            <Link
              to="/cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              aria-label={`Cart with ${cart?.itemCount ?? 0} items`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              {cart && cart.itemCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-900">
                  {cart.itemCount}
                </span>
              )}
            </Link>

            {/* User Profile / Auth Action Buttons */}
            <div className="hidden md:flex md:items-center md:gap-2">
              {user ? (
                <div className="flex items-center gap-2">
                  <Link
                    to="/account"
                    title="Open Account Dashboard"
                    className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white/60 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName}
                        className="h-6 w-6 rounded-full border border-brand-500/30 object-cover"
                      />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                        {getInitials(user.fullName)}
                      </span>
                    )}
                    <span className="max-w-[120px] truncate font-semibold">
                      {user.fullName}
                    </span>
                  </Link>
                  <button onClick={handleLogout} className="btn-secondary h-9 px-3 text-xs">
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className="btn-secondary h-9 px-3 text-xs font-semibold">
                    Sign in
                  </Link>
                  <Link to="/register" className="btn-primary h-9 px-3 text-xs font-semibold">
                    Get started
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-50 md:hidden dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
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
          <div className="border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur-md md:hidden dark:border-slate-800 dark:bg-slate-900/95 shadow-md">
            <nav className="space-y-1">
              <NavLink to="/" className={mobileNavLinkClass} end onClick={() => setMobileMenuOpen(false)}>
                Browse Catalog
              </NavLink>
              <NavLink to="/contact" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                Support & Contact
              </NavLink>
              {user && (

                <NavLink to="/account" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  My Account
                </NavLink>
              )}
              {user && (
                <NavLink to="/library" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  Digital Library
                </NavLink>
              )}
              {user && (
                <NavLink to="/orders" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  Orders
                </NavLink>
              )}
              {user?.role === 'VENDOR' && (
                <NavLink to="/vendor" className={mobileNavLinkClass} onClick={() => setMobileMenuOpen(false)}>
                  Vendor Portal
                </NavLink>
              )}
            </nav>

            <div className="mt-4 border-t border-slate-200/80 pt-4 dark:border-slate-800">
              {user ? (
                <div className="space-y-3">
                  <Link
                    to="/account"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    {user.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.fullName}
                        className="h-10 w-10 rounded-full border border-brand-500/30 object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                        {getInitials(user.fullName)}
                      </span>
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.fullName}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                    </div>
                  </Link>
                  <button onClick={handleLogout} className="btn-secondary w-full py-2.5 text-sm font-semibold">
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-secondary w-full py-2.5 text-center text-sm font-semibold"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-primary w-full py-2.5 text-center text-sm font-semibold"
                  >
                    Get started
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:py-10 print:p-0 print:m-0 print:max-w-none print:w-full">
        <Outlet />
      </main>

      {/* Professional Footer */}
      <footer className="mt-auto border-t border-slate-200/80 bg-white/80 py-10 transition-colors duration-200 dark:border-slate-800/80 dark:bg-slate-900/80 print:hidden shadow-[0_-1px_3px_rgba(0,0,0,0.02)]">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-center">
            <div className="max-w-md">
              <div className="flex items-center gap-2.5 text-base font-black tracking-tight text-slate-900 dark:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 text-xs font-black text-white shadow-sm shadow-brand-600/20">
                  AH
                </span>
                <span>
                  Asset<span className="text-brand-600 dark:text-brand-400">Hub</span>
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The multi-vendor marketplace for verified developer boilerplates, UI component systems, mobile templates, DevOps automation, and engineering masterclasses.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                <span className="inline-flex items-center gap-1">⚡ Instant Digital Download</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">🔒 Secure Escrow Payments</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">✨ Verified Creator Licences</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <Link to="/" className="transition hover:text-brand-600 dark:hover:text-brand-400">
                Browse
              </Link>
              <Link to="/contact" className="transition hover:text-brand-600 dark:hover:text-brand-400">
                Contact Us
              </Link>
              <Link to="/login" className="transition hover:text-brand-600 dark:hover:text-brand-400">

                Sign In
              </Link>
              <Link to="/register" className="transition hover:text-brand-600 dark:hover:text-brand-400">
                Sell Assets
              </Link>
              {user && (
                <Link to="/account" className="transition hover:text-brand-600 dark:hover:text-brand-400">
                  My Account
                </Link>
              )}
              {user && (
                <Link to="/library" className="transition hover:text-brand-600 dark:hover:text-brand-400">
                  Digital Library
                </Link>
              )}
            </div>
          </div>

          {/* TASK 1: Professional Copyright Notice */}
          <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs font-medium text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
            &copy; 2025 Pranta Kumer Pandit. All rights reserved. | AssetHub Marketplace
          </div>
        </div>
      </footer>
    </div>
  );
};
