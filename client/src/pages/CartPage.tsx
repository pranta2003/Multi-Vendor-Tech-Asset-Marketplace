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

  // Reloads when the currency changes: prices are stored per-currency on the
  // server, so the cart must be re-priced rather than converted client-side.
  useEffect(() => { void load(currency); }, [currency, load]);

  if (loading && !cart) return <PageLoader label="Loading cart" />;

  const isEmpty = !cart || cart.items.length === 0;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Your cart</h1>
      {error && <div className="mb-4"><Alert tone="error">{error}</Alert></div>}

      {isEmpty ? (
        <div className="card p-12 text-center">
          <p className="text-slate-600">Your cart is empty.</p>
          <Link to="/" className="btn-primary mt-5">Browse assets</Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-3">
            {cart.items.map((line) => {
              const busy = !!mutating[line.productId];
              const max = line.stock === null ? 20 : Math.min(20, line.stock);
              return (
                <div key={line.itemId} className="card flex gap-4 p-4">
                  <img src={line.thumbnailUrl} alt={line.title} className="h-20 w-20 rounded-lg bg-slate-100 object-cover" />
                  <div className="flex-1">
                    <Link to={`/products/${line.slug}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {line.title}
                    </Link>
                    <p className="text-xs text-slate-500">{line.vendorStoreName}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {formatMoney(line.unitAmount, cart.currency)} each
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <label className="sr-only" htmlFor={`qty-${line.itemId}`}>Quantity</label>
                      <select
                        id={`qty-${line.itemId}`}
                        className="rounded-lg border border-surface-border px-2 py-1 text-sm"
                        value={line.quantity}
                        disabled={busy}
                        onChange={(e) => void update(line.productId, Number(e.target.value), currency)}
                      >
                        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <button
                        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                        disabled={busy}
                        onClick={() => void remove(line.productId, currency)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="text-right font-semibold text-slate-900">
                    {formatMoney(line.lineTotal, cart.currency)}
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="h-fit lg:sticky lg:top-24">
            <div className="card p-6">
              <h2 className="font-semibold text-slate-900">Order summary</h2>
              <div className="mt-4 flex justify-between text-sm text-slate-600">
                <span>Items</span><span>{cart.itemCount}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-surface-border pt-3 text-base font-bold text-slate-900">
                <span>Total</span><span>{formatMoney(cart.subtotalAmount, cart.currency)}</span>
              </div>
              <Link to="/checkout" className="btn-primary mt-5 w-full">Proceed to checkout</Link>
              {/*
                The total shown here is the server's computed subtotal, not a
                client-side sum. The number the user sees is the number the
                server will charge.
              */}
              <p className="mt-3 text-center text-xs text-slate-500">
                Totals are calculated and verified server-side.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
