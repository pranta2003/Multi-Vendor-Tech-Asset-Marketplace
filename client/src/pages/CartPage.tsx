import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../store/cart.store';
import { useCurrencyStore } from '../store/currency.store';
import { formatMoney } from '../lib/money';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';

export const CartPage = (): JSX.Element => {
  const currency = useCurrencyStore((s) => s.currency);
  const { cart, loading, mutating, error, load, update, remove } = useCartStore();

  useEffect(() => {
    void load(currency);
  }, [currency, load]);

  if (loading && !cart) return <PageLoader label="Loading your cart..." />;

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
        Shopping Cart
      </h1>

      {error && (
        <Alert tone="error">
          {error}
        </Alert>
      )}

      {isEmpty ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <svg className="h-7 w-7 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.5l1.7 9.4a2 2 0 002 1.6h7.9a2 2 0 002-1.6L19 6H5.3M8 19a1 1 0 11-2 0 1 1 0 012 0zm10 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Your cart is currently empty</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Explore our curated catalog for production-grade UI kits, templates, and courses.
          </p>
          <Link to="/" className="btn-primary mt-6 inline-flex">
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-4">
            {cart.items.map((line) => {
              const busy = Boolean(mutating[line.productId]);
              const max = line.stock === null ? 20 : Math.min(20, line.stock);

              return (
                <div
                  key={line.itemId}
                  className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
                >
                  <img
                    src={line.thumbnailUrl}
                    alt={line.title}
                    className="h-20 w-28 rounded-lg bg-slate-100 object-cover dark:bg-slate-800 shrink-0"
                  />

                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/products/${line.slug}`}
                      className="font-bold text-slate-900 transition-colors hover:text-brand-600 dark:text-slate-100 dark:hover:text-brand-400 truncate block"
                    >
                      {line.title}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      by {line.vendorStoreName}
                    </p>
                    <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                      {formatMoney(line.unitAmount, cart.currency)} each
                    </p>

                    <div className="mt-3 flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400" htmlFor={`qty-${line.itemId}`}>
                          Qty:
                        </label>
                        <select
                          id={`qty-${line.itemId}`}
                          className="rounded-md border border-surface-border bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          value={line.quantity}
                          disabled={busy}
                          onChange={(e) => void update(line.productId, Number(e.target.value), currency)}
                        >
                          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        className="text-xs font-medium text-red-600 transition-colors hover:text-red-700 hover:underline disabled:opacity-50 dark:text-red-400"
                        disabled={busy}
                        onClick={() => void remove(line.productId, currency)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="text-right sm:self-center">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white">
                      {formatMoney(line.lineTotal, cart.currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cart Summary Card */}
          <aside className="h-fit lg:sticky lg:top-24">
            <div className="card p-6 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Order Summary</h2>

              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Licence Items</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{cart.itemCount}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Delivery</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Instant Digital</span>
                </div>
              </div>

              <div className="mt-4 flex justify-between border-t border-surface-border pt-4 text-base font-extrabold text-slate-900 dark:border-slate-800 dark:text-white">
                <span>Subtotal</span>
                <span>{formatMoney(cart.subtotalAmount, cart.currency)}</span>
              </div>

              <Link to="/checkout" className="btn-primary mt-6 w-full py-3 text-sm">
                Proceed to Checkout
              </Link>

              <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
                Taxes and exact amounts calculated and verified server-side.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
