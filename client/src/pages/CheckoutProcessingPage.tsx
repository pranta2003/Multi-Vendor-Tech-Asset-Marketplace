import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOrderStatusPolling } from '../hooks/useOrderStatusPolling';
import { useCartStore } from '../store/cart.store';
import { useCurrencyStore } from '../store/currency.store';
import { Spinner } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';

/**
 * Where the SSLCommerz browser redirect lands (via the server's 303).
 *
 * The server's redirect handlers deliberately never fulfil an order - they only
 * bounce the browser here. This page then asks the SERVER what actually
 * happened, so a user who edits the redirect URL cannot talk themselves into a
 * success screen.
 */
export const CheckoutProcessingPage = (): JSX.Element => {
  const [params] = useSearchParams();
  const orderParam = params.get('order') ?? params.get('tran_id') ?? undefined;
  const { status, outcome, error } = useOrderStatusPolling(orderParam);
  const currency = useCurrencyStore((s) => s.currency);
  const load = useCartStore((s) => s.load);

  const displayOrderNumber = status?.orderNumber ?? orderParam;

  // The server clears the cart at fulfilment; re-sync so the header badge is
  // correct once payment lands.
  useEffect(() => {
    if (outcome === 'fulfilled') void load(currency);
  }, [outcome, currency, load]);

  if (!orderParam) {
    return (
      <div className="mx-auto max-w-lg">
        <Alert tone="error" title="Missing order reference">
          We could not identify this order. If your account was charged, please check your orders page.
        </Alert>
        <div className="mt-4 text-center">
          <Link to="/orders" className="btn-secondary">View orders</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-10 text-center shadow-sm">
        {outcome === 'pending' && (
          <>
            <Spinner className="mx-auto h-10 w-10 text-brand-600 dark:text-brand-400" />
            <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-slate-100">Confirming your payment</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              We are waiting for the payment gateway to confirm the transaction. This usually takes
              a few seconds - please do not close this page.
            </p>
          </>
        )}

        {outcome === 'fulfilled' && (
          <>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 dark:border dark:border-emerald-800/60">
              <svg className="h-7 w-7 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-5 text-xl font-bold text-slate-900 dark:text-slate-100">Payment confirmed</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Your licence keys are ready in your library.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/library" className="btn-primary">Go to my library</Link>
              {displayOrderNumber && (
                <Link to={`/orders/${displayOrderNumber}`} className="btn-secondary">View order</Link>
              )}
            </div>
          </>
        )}

        {outcome === 'failed' && (
          <>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Payment was not completed</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              The gateway reported that this transaction did not succeed. You have not been charged,
              and any reserved items have been released.
            </p>
            <Link to="/cart" className="btn-primary mt-6">Return to cart</Link>
          </>
        )}

        {(outcome === 'timeout' || outcome === 'error') && (
          <>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Still processing</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Confirmation is taking longer than usual. Your payment may still complete - please
              check your orders in a few minutes before trying again.
            </p>
            {error && <div className="mt-4 text-left"><Alert tone="warning">{error}</Alert></div>}
            <Link to="/orders" className="btn-secondary mt-6">View my orders</Link>
          </>
        )}

        <div className="mt-6 border-t border-surface-border pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <p>Order reference: <span className="font-mono font-semibold">{displayOrderNumber}</span></p>
          {status && <div className="mt-2"><StatusBadge status={status.orderStatus} /></div>}
        </div>
      </div>
    </div>
  );
};
