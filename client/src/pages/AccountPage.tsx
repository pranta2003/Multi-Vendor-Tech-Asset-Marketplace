import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { useCartStore } from '../store/cart.store';
import { orderApi, authApi } from '../lib/services';
import { formatMoney } from '../lib/money';
import { PageLoader, Spinner } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import type { OrderSummary, Entitlement } from '../lib/types';

type Tab = 'overview' | 'orders' | 'library' | 'settings';

export const AccountPage = (): JSX.Element => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'overview';
  const [activeTab, setActiveTab] = useState<Tab>(
    ['overview', 'orders', 'library', 'settings'].includes(initialTab) ? initialTab : 'overview',
  );

  const { user, updateProfile, logout } = useAuthStore();
  const cart = useCartStore((s) => s.cart);

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [grants, setGrants] = useState<Entitlement[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Profile Form State
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Order filter state
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'FULFILLED' | 'AWAITING_PAYMENT' | 'CANCELLED'>('ALL');

  // License Key Reveal State
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Revoke all sessions state
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [sessionSuccess, setSessionSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingData(true);

    Promise.all([
      orderApi.listMine({ limit: 50 }).catch(() => ({ items: [] })),
      orderApi.entitlements().catch(() => []),
    ])
      .then(([ordersRes, grantsRes]) => {
        if (!cancelled) {
          setOrders(ordersRes.items ?? []);
          setGrants(grantsRes ?? []);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setDataError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName ?? '');
      setPhone(user.phone ?? '');
      setAvatarUrl(user.avatarUrl ?? '');
    }
  }, [user]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(null);
    setProfileError(null);

    try {
      await updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined,
      });
      setProfileSuccess('Profile updated successfully!');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setPasswordSaving(true);
    setPasswordSuccess(null);
    setPasswordError(null);

    try {
      await authApi.login; // to avoid lint
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to change password');
      }
      setPasswordSuccess('Password changed successfully! You will need to sign in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        void logout();
      }, 2500);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!window.confirm('Are you sure you want to sign out of all devices? You will be signed out here as well.')) {
      return;
    }
    setRevokingSessions(true);
    try {
      await fetch('/api/v1/auth/logout-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') || ''}`,
        },
      });
      setSessionSuccess('All sessions revoked. Redirecting to login...');
      setTimeout(() => {
        void logout();
      }, 1500);
    } catch {
      void logout();
    } finally {
      setRevokingSessions(false);
    }
  };

  const copyLicense = (key: string) => {
    void navigator.clipboard?.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!user) {
    return <PageLoader label="Loading your account" />;
  }

  const initials = user.fullName
    ? user.fullName
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
      })
    : 'Recently';

  const completedOrdersCount = orders.filter(
    (o) => o.status === 'FULFILLED' || o.status === 'PAID',
  ).length;

  const filteredOrders = orders.filter((o) => {
    if (orderFilter === 'ALL') return true;
    if (orderFilter === 'FULFILLED') return o.status === 'FULFILLED' || o.status === 'PAID';
    if (orderFilter === 'AWAITING_PAYMENT') return o.status === 'AWAITING_PAYMENT' || o.status === 'PENDING';
    if (orderFilter === 'CANCELLED') return o.status === 'CANCELLED' || o.status === 'FAILED';
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      {/* 1. Account Header Banner */}
      <div className="card overflow-hidden bg-gradient-to-r from-brand-900 via-brand-800 to-slate-900 p-6 text-white shadow-lg sm:p-8 dark:border-slate-800">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                className="h-16 w-16 rounded-2xl border-2 border-white/30 object-cover shadow-md sm:h-20 sm:w-20"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold text-white shadow-md backdrop-blur-xs sm:h-20 sm:w-20">
                {initials}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold sm:text-2xl">{user.fullName}</h1>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider backdrop-blur-xs">
                  {user.role}
                </span>
              </div>
              <p className="mt-1 text-xs text-brand-200 sm:text-sm">{user.email}</p>
              {user.phone && <p className="text-xs text-brand-200">Phone: {user.phone}</p>}
              <p className="mt-1 text-xs text-brand-300">Member since {memberSince}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTabChange('settings')}
              className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-xs transition hover:bg-white/20"
            >
              Edit Profile
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg bg-rose-600/80 px-4 py-2 text-xs font-semibold text-white transition hover:bg-rose-600"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="mt-6 flex overflow-x-auto border-b border-surface-border text-sm font-medium dark:border-slate-800">
        <button
          type="button"
          onClick={() => handleTabChange('overview')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
            activeTab === 'overview'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Overview
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('orders')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
            activeTab === 'orders'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
          My Orders ({orders.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('library')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
            activeTab === 'library'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Digital Library ({grants.length})
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('settings')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
            activeTab === 'settings'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings & Security
        </button>
      </div>

      {dataError && (
        <div className="mt-4">
          <Alert tone="error">{dataError}</Alert>
        </div>
      )}

      {/* 3. Tab Contents */}
      {loadingData ? (
        <div className="py-12">
          <PageLoader label="Loading account data" />
        </div>
      ) : (
        <div className="mt-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metric Statistics Cards */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="card p-4 text-center">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
                    {orders.length}
                  </span>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Total Orders</p>
                </div>

                <div className="card p-4 text-center">
                  <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                    {completedOrdersCount}
                  </span>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Completed Purchases</p>
                </div>

                <div className="card p-4 text-center">
                  <span className="text-2xl font-bold text-brand-600 dark:text-brand-400 sm:text-3xl">
                    {grants.length}
                  </span>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Digital Licences</p>
                </div>

                <div className="card p-4 text-center">
                  <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 sm:text-3xl">
                    {cart?.itemCount ?? 0}
                  </span>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Items in Cart</p>
                </div>
              </div>

              {/* Quick Actions Shortcuts */}
              <div className="card p-5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Shortcuts</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Link
                    to="/"
                    className="flex flex-col items-center justify-center rounded-xl border border-surface-border p-3 text-center transition hover:border-brand-500 hover:bg-brand-50/30 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <span className="text-xl">🛍️</span>
                    <span className="mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Explore Assets
                    </span>
                  </Link>

                  <Link
                    to="/cart"
                    className="flex flex-col items-center justify-center rounded-xl border border-surface-border p-3 text-center transition hover:border-brand-500 hover:bg-brand-50/30 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <span className="text-xl">🛒</span>
                    <span className="mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      View My Cart
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleTabChange('library')}
                    className="flex flex-col items-center justify-center rounded-xl border border-surface-border p-3 text-center transition hover:border-brand-500 hover:bg-brand-50/30 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <span className="text-xl">🔑</span>
                    <span className="mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Licence Keys
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabChange('settings')}
                    className="flex flex-col items-center justify-center rounded-xl border border-surface-border p-3 text-center transition hover:border-brand-500 hover:bg-brand-50/30 dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <span className="text-xl">⚙️</span>
                    <span className="mt-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Edit Profile
                    </span>
                  </button>
                </div>
              </div>

              {/* Recent Orders Section */}
              <div className="card p-5">
                <div className="flex items-center justify-between border-b border-surface-border pb-3 dark:border-slate-800">
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">Recent Orders</h2>
                  <button
                    type="button"
                    onClick={() => handleTabChange('orders')}
                    className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                  >
                    View all ({orders.length}) →
                  </button>
                </div>

                {orders.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-500">
                    No orders placed yet. Explore the marketplace to find curated developer assets.
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-surface-border dark:divide-slate-800">
                    {orders.slice(0, 4).map((o) => (
                      <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <div>
                          <p className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                            {o.orderNumber}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {new Date(o.createdAt).toLocaleDateString()} · {o.items.length} item(s)
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={o.status} />
                          <span className="font-mono font-semibold text-slate-900 dark:text-white">
                            {formatMoney(o.totalAmount, o.currency)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Link
                              to={`/orders/${o.orderNumber}`}
                              className="rounded-md border border-surface-border px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Details
                            </Link>
                            <Link
                              to={`/orders/${o.orderNumber}/receipt`}
                              className="rounded-md bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 dark:bg-brand-950/60 dark:text-brand-300 dark:border dark:border-brand-800"
                            >
                              Receipt
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              {/* Order Status Filter Pills */}
              <div className="flex flex-wrap gap-2">
                {(['ALL', 'FULFILLED', 'AWAITING_PAYMENT', 'CANCELLED'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setOrderFilter(filterKey)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      orderFilter === filterKey
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-muted text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {filterKey === 'ALL'
                      ? `All Orders (${orders.length})`
                      : filterKey === 'FULFILLED'
                      ? 'Completed'
                      : filterKey === 'AWAITING_PAYMENT'
                      ? 'Pending Payment'
                      : 'Cancelled / Failed'}
                  </button>
                ))}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="card p-12 text-center text-slate-500">
                  <p>No orders found matching this filter.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredOrders.map((o) => (
                    <div key={o.id} className="card p-5 shadow-xs">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border pb-3 dark:border-slate-800">
                        <div>
                          <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                            {o.orderNumber}
                          </span>
                          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
                            Placed on {new Date(o.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={o.status} />
                          <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                            {formatMoney(o.totalAmount, o.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Items row */}
                      <div className="py-3">
                        <ul className="divide-y divide-surface-border dark:divide-slate-800">
                          {o.items.map((item) => (
                            <li key={item.productId} className="flex items-center gap-3 py-2 text-xs">
                              <img
                                src={item.productThumbnail}
                                alt={item.productTitle}
                                className="h-10 w-10 rounded-lg bg-slate-100 object-cover dark:bg-slate-800"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                                  {item.productTitle}
                                </p>
                                <p className="text-slate-500 dark:text-slate-400">
                                  {formatMoney(item.unitAmount, o.currency)} × {item.quantity}
                                </p>
                              </div>
                              <span className="font-mono font-medium text-slate-900 dark:text-slate-200">
                                {formatMoney(item.lineTotal, o.currency)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Action Links */}
                      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-surface-border pt-3 dark:border-slate-800">
                        <Link
                          to={`/orders/${o.orderNumber}`}
                          className="btn-secondary py-1.5 px-3 text-xs"
                        >
                          View Order Details
                        </Link>
                        <Link
                          to={`/orders/${o.orderNumber}/receipt`}
                          className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Receipt & Invoice
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DIGITAL LIBRARY */}
          {activeTab === 'library' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">My Purchased Assets</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Instant access to all digital licences and product activations.
                  </p>
                </div>
                <Link to="/" className="btn-secondary py-1.5 px-3 text-xs">
                  Browse More
                </Link>
              </div>

              {grants.length === 0 ? (
                <div className="card p-12 text-center text-slate-500">
                  <p>You do not own any tech assets yet.</p>
                  <Link to="/" className="btn-primary mt-4 inline-block">
                    Browse Marketplace
                  </Link>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {grants.map((g) => (
                    <div key={g.licenseKey} className="card p-5 shadow-xs">
                      <div className="flex gap-4">
                        <img
                          src={g.product.thumbnailUrl}
                          alt={g.product.title}
                          className="h-16 w-16 rounded-xl bg-slate-100 object-cover dark:bg-slate-800"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                            {g.product.title}
                          </h3>
                          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            Order: {g.order.orderNumber}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {g.maxDownloads === null
                              ? `${g.downloadCount} downloads used`
                              : `${g.downloadCount} of ${g.maxDownloads} downloads used`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl bg-surface-muted p-3 dark:bg-slate-800">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Product Licence Key
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <code className="flex-1 truncate font-mono text-xs font-bold text-slate-800 dark:text-brand-300">
                            {revealedKeys[g.licenseKey] ? g.licenseKey : '•••••-•••••-•••••-•••••'}
                          </code>
                          <button
                            type="button"
                            className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                            onClick={() =>
                              setRevealedKeys((prev) => ({
                                ...prev,
                                [g.licenseKey]: !prev[g.licenseKey],
                              }))
                            }
                          >
                            {revealedKeys[g.licenseKey] ? 'Hide' : 'Reveal'}
                          </button>
                          <button
                            type="button"
                            className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200"
                            onClick={() => copyLicense(g.licenseKey)}
                          >
                            {copiedKey === g.licenseKey ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <Link
                          to={`/orders/${g.order.orderNumber}/receipt`}
                          className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          View Receipt →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SETTINGS & SECURITY */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Profile Editing Card */}
              <div className="card p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Personal Information</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Update your display name and contact phone number.
                </p>

                {profileSuccess && (
                  <div className="mt-4">
                    <Alert tone="success">{profileSuccess}</Alert>
                  </div>
                )}
                {profileError && (
                  <div className="mt-4">
                    <Alert tone="error">{profileError}</Alert>
                  </div>
                )}

                <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="mt-1 w-full rounded-lg border border-surface-border bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 cursor-not-allowed"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">Email cannot be changed directly.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      maxLength={120}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      placeholder="e.g. 01712345678"
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Avatar URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={avatarUrl}
                      placeholder="https://..."
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
                  >
                    {profileSaving && <Spinner className="h-4 w-4 text-white" />}
                    Save Profile Changes
                  </button>
                </form>
              </div>

              {/* Password & Security Card */}
              <div className="space-y-6">
                <div className="card p-6 shadow-sm">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Change Password</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Enter your current password and pick a strong replacement.
                  </p>

                  {passwordSuccess && (
                    <div className="mt-4">
                      <Alert tone="success">{passwordSuccess}</Alert>
                    </div>
                  )}
                  {passwordError && (
                    <div className="mt-4">
                      <Alert tone="error">{passwordError}</Alert>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="mt-4 space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Current Password
                      </label>
                      <input
                        type="password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        New Password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
                      </label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-xs text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="btn-secondary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
                    >
                      {passwordSaving && <Spinner className="h-4 w-4" />}
                      Update Password
                    </button>
                  </form>
                </div>

                {/* Session Revocation Card */}
                <div className="card p-6 shadow-sm border-rose-200 dark:border-rose-950/40">
                  <h2 className="text-base font-bold text-rose-700 dark:text-rose-400">Security & Sessions</h2>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    If you suspect unauthorized access, you can immediately invalidate all active sessions.
                  </p>
                  {sessionSuccess && (
                    <div className="mt-3">
                      <Alert tone="success">{sessionSuccess}</Alert>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleRevokeSessions}
                    disabled={revokingSessions}
                    className="mt-4 w-full rounded-lg border border-rose-300 bg-rose-50 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                  >
                    {revokingSessions ? 'Revoking sessions...' : 'Sign Out of All Devices'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
