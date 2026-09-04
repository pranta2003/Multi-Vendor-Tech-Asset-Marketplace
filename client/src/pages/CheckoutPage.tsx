import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cart.store';
import { useCurrencyStore } from '../store/currency.store';
import { useAuthStore } from '../store/auth.store';
import { orderApi } from '../lib/services';
import { formatMoney, providerForCurrency } from '../lib/money';
import { ApiClientError } from '../lib/api';
import { Alert } from '../components/Alert';
import { PageLoader, Spinner } from '../components/Spinner';
import type { CheckoutRequest } from '../lib/types';

export const CheckoutPage = (): JSX.Element => {
  const navigate = useNavigate();
  const currency = useCurrencyStore((s) => s.currency);
  const { user } = useAuthStore();
  const { cart, loading, load } = useCartStore();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [form, setForm] = useState({
    billingName: user?.fullName ?? '',
    billingEmail: user?.email ?? '',
    billingPhone: '',
    billingAddress: '',
    billingCity: '',
    billingCountry: 'BD',
  });

  useEffect(() => { void load(currency); }, [currency, load]);

  /**
   * The gateway is DERIVED from the currency, never chosen freely, mirroring
   * the server's hard pairing (STRIPE->USD, SSLCOMMERZ->BDT). Offering a free
   * choice would let a user submit a combination the server must reject, which
   * is a guaranteed dead end presented as a valid option.
   */
  const provider = useMemo(() => providerForCurrency(currency), [currency]);

  if (loading && !cart) return <PageLoader label="Loading checkout" />;

  if (!cart || cart.items.length === 0) {
    return (
      <div className="card mx-auto max-w-md p-10 text-center">
        <p className="text-slate-600">Your cart is empty.</p>
        <button className="btn-primary mt-5" onClick={() => navigate('/')}>Browse assets</button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    /**
     * NOTE WHAT IS ABSENT: no amount, no price, no product ids, no quantities.
     *
     * The payload carries only billing details. The server rebuilds the entire
     * order from the authenticated user's cart and the locked product rows, so
     * there is no client-supplied number anywhere in the money path and price
     * tampering is structurally impossible rather than merely validated against.
     */
    const payload: CheckoutRequest = {
      provider,
      currency,
      billingName: form.billingName,
      billingEmail: form.billingEmail,
      ...(form.billingPhone ? { billingPhone: form.billingPhone } : {}),
      ...(form.billingAddress ? { billingAddress: form.billingAddress } : {}),
      ...(form.billingCity ? { billingCity: form.billingCity } : {}),
      ...(form.billingCountry ? { billingCountry: form.billingCountry } : {}),
    };

    try {
      const result = await orderApi.checkout(payload);

      if (result.payment.provider === 'SSLCOMMERZ' && result.payment.redirectUrl) {
        /**
         * A FULL PAGE NAVIGATION, not fetch/XHR. The gateway serves an HTML
         * payment page and will later redirect the browser back to us; it
         * cannot be driven from inside an AJAX call, and attempting to would
         * also be blocked by CORS.
         */
        window.location.assign(result.payment.redirectUrl);
        return;
      }

      if (result.payment.provider === 'STRIPE' && result.payment.clientSecret) {
        // Stripe confirmation happens on a dedicated page holding the Elements
        // provider. The client secret is passed via router state, never as a
        // query parameter, so it stays out of browser history and server logs.
        navigate(`/checkout/stripe/${result.order.orderNumber}`, {
          state: { clientSecret: result.payment.clientSecret },
          replace: true,
        });
        return;
      }

      throw new Error('The payment gateway did not return a usable session.');
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Checkout failed'));
      setSubmitting(false);
      // Re-sync: a failed checkout releases the reserved stock server-side, so
      // the cart view may legitimately have changed.
      void load(currency);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Checkout</h1>

        {error && (
          <div className="mb-5">
            <Alert
              tone="error"
              title="Payment could not be started"
              requestId={error instanceof ApiClientError ? error.requestId : undefined}
            >
              {error.message}
              {error instanceof ApiClientError && error.isRetryable && (
                <span className="mt-1 block">This is usually temporary - please try again.</span>
              )}
            </Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <h2 className="font-semibold text-slate-900">Billing details</h2>
          <div>
            <label className="label" htmlFor="billingName">Full name</label>
            <input id="billingName" required minLength={2} maxLength={120} className="input"
              value={form.billingName} onChange={(e) => setForm({ ...form, billingName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="billingEmail">Email</label>
            <input id="billingEmail" type="email" required className="input"
              value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} />
            <p className="mt-1 text-xs text-slate-500">Your licence keys are delivered here.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="billingPhone">Phone {provider === 'SSLCOMMERZ' && '(required)'}</label>
              <input id="billingPhone" className="input" maxLength={24}
                required={provider === 'SSLCOMMERZ'}
                placeholder="01XXXXXXXXX"
                value={form.billingPhone} onChange={(e) => setForm({ ...form, billingPhone: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="billingCity">City</label>
              <input id="billingCity" className="input" maxLength={80}
                value={form.billingCity} onChange={(e) => setForm({ ...form, billingCity: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="billingAddress">Address</label>
            <input id="billingAddress" className="input" maxLength={255}
              value={form.billingAddress} onChange={(e) => setForm({ ...form, billingAddress: e.target.value })} />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting && <Spinner className="h-4 w-4" />}
            {submitting
              ? 'Starting secure payment'
              : `Pay ${formatMoney(cart.subtotalAmount, cart.currency)}`}
          </button>
        </form>
      </div>

      <aside className="h-fit lg:sticky lg:top-24">
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {cart.items.map((l) => (
              <li key={l.itemId} className="flex justify-between gap-3 text-sm">
                <span className="text-slate-600">{l.title} × {l.quantity}</span>
                <span className="shrink-0 font-medium">{formatMoney(l.lineTotal, cart.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-surface-border pt-3 font-bold">
            <span>Total</span><span>{formatMoney(cart.subtotalAmount, cart.currency)}</span>
          </div>
          <div className="mt-4 rounded-lg bg-surface-muted p-3 text-xs text-slate-600">
            Paying with <strong>{provider === 'STRIPE' ? 'Card (Stripe)' : 'SSLCommerz'}</strong>, settled in{' '}
            <strong>{currency}</strong>. Change the currency in the header to switch method.
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Card details are entered on the gateway and never touch our servers.
          </p>
        </div>
      </aside>
    </div>
  );
};
