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
    billingPhone: '01711000000',
    billingAddress: 'House 1, Road 2',
    billingCity: 'Dhaka',
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
        <p className="text-slate-600 dark:text-slate-300">Your cart is empty.</p>
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
        // Cache client secret in sessionStorage so refreshes preserve checkout state
        try {
          sessionStorage.setItem(`stripe_cs_${result.order.orderNumber}`, result.payment.clientSecret);
        } catch {
          // Ignore storage errors
        }

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
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Checkout</h1>

        {/* Safe Developer Test-Mode Banner */}
        <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/70 p-4 text-xs dark:border-brand-900/60 dark:bg-brand-950/40">
          <div className="flex items-center justify-between font-bold text-brand-900 dark:text-brand-200">
            <span className="flex items-center gap-1.5 text-sm">
              <span>🛠️</span>
              {provider === 'SSLCOMMERZ' ? 'SSLCommerz Sandbox Mode Active' : 'Stripe Test Mode Active'}
            </span>
            <span className="rounded-full bg-brand-200/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-300">
              {currency} Settlement
            </span>
          </div>

          <div className="mt-2.5 space-y-1.5 text-slate-700 dark:text-slate-300 leading-relaxed">
            {provider === 'SSLCOMMERZ' ? (
              <>
                <p>
                  • <strong>Gateway:</strong> Directs to official <code className="rounded bg-brand-100/70 px-1 py-0.5 font-mono text-brand-800 dark:bg-brand-900/70 dark:text-brand-300">sandbox.sslcommerz.com</code>.
                </p>
                <p>
                  • <strong>Test Card:</strong> <code className="rounded bg-brand-100/70 px-1 py-0.5 font-mono font-bold text-brand-800 dark:bg-brand-900/70 dark:text-brand-300">4012 0010 3014 1234</code> &bull; Exp: <code className="font-mono">12/28</code> &bull; CVV: <code className="font-mono">123</code> &bull; Name: Test Buyer.
                </p>
                <p>
                  • <strong>Gateway Pay Button:</strong> The SSLCommerz sandbox "Pay Now" button activates automatically once test card details are entered or a mobile banking channel (bKash/Nagad) is chosen.
                </p>
                <p>
                  • <strong>Sandbox OTP:</strong> Choose <em>Success</em>, <em>Success with risk</em>, or <em>Failed</em> to test the complete lifecycle.
                </p>
              </>
            ) : (
              <>
                <p>
                  • <strong>Gateway:</strong> Uses Stripe Elements in official test mode.
                </p>
                <p>
                  • <strong>Test Card:</strong> <code className="rounded bg-brand-100/70 px-1 py-0.5 font-mono font-bold text-brand-800 dark:bg-brand-900/70 dark:text-brand-300">4242 4242 4242 4242</code> &bull; Exp: Any future date &bull; CVC: <code className="font-mono">123</code>.
                </p>
              </>
            )}
            <p className="pt-1 text-[11px] text-slate-500 dark:text-slate-400">
              💡 Change the currency in the top navigation bar to switch between <strong>SSLCommerz (BDT)</strong> and <strong>Stripe (USD)</strong>.
            </p>
          </div>
        </div>

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

        <form onSubmit={handleSubmit} className="card space-y-4 p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Billing details</h2>
          <div>
            <label className="label" htmlFor="billingName">Full name</label>
            <input id="billingName" required minLength={2} maxLength={120} className="input"
              value={form.billingName} onChange={(e) => setForm({ ...form, billingName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="billingEmail">Email</label>
            <input id="billingEmail" type="email" required className="input"
              value={form.billingEmail} onChange={(e) => setForm({ ...form, billingEmail: e.target.value })} />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your licence keys are delivered here.</p>
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

          <button type="submit" className="btn-primary w-full py-3 text-base shadow-sm" disabled={submitting}>
            {submitting && <Spinner className="h-4 w-4" />}
            {submitting
              ? 'Starting secure payment...'
              : `Pay ${formatMoney(cart.subtotalAmount, cart.currency)}`}
          </button>
        </form>
      </div>

      <aside className="h-fit lg:sticky lg:top-24">
        <div className="card p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {cart.items.map((l) => (
              <li key={l.itemId} className="flex justify-between gap-3 text-sm">
                <span className="text-slate-600 dark:text-slate-300">{l.title} × {l.quantity}</span>
                <span className="shrink-0 font-medium text-slate-800 dark:text-slate-200">{formatMoney(l.lineTotal, cart.currency)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-surface-border pt-4 text-base font-extrabold text-slate-900 dark:border-slate-800 dark:text-white">
            <span>Total</span><span>{formatMoney(cart.subtotalAmount, cart.currency)}</span>
          </div>
          <div className="mt-4 rounded-lg bg-surface-muted p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Paying with <strong>{provider === 'STRIPE' ? 'Card (Stripe)' : 'SSLCommerz'}</strong>, settled in{' '}
            <strong>{currency}</strong>. Change the currency in the header to switch method.
          </div>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Payment credentials are entered directly on the gateway and never touch our servers.
          </p>
        </div>
      </aside>
    </div>
  );
};
