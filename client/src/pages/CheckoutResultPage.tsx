import { Link, useSearchParams } from 'react-router-dom';

interface Props { variant: 'failed' | 'cancelled' }

/**
 * Landing pages for the gateway's failure and cancellation redirects. These are
 * intentionally dumb: they make no claim about money, because the browser
 * redirect is not authoritative. Anything requiring certainty links to the
 * order, whose status comes from the validated server-side callback.
 */
export const CheckoutResultPage = ({ variant }: Props): JSX.Element => {
  const [params] = useSearchParams();
  const orderNumber = params.get('order') ?? params.get('tran_id') ?? undefined;

  const isCancelled = variant === 'cancelled';
  const copy = isCancelled
    ? {
        title: 'Payment Cancelled',
        body: 'You cancelled the checkout session before completing payment. Nothing has been charged, and your cart items remain intact.',
      }
    : {
        title: 'Payment Not Completed',
        body: 'The transaction could not be completed by the payment gateway. You have not been charged, and any items reserved for this order have been released.',
      };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="card p-8 text-center shadow-sm">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
            isCancelled
              ? 'bg-amber-100 dark:bg-amber-950/60 dark:border dark:border-amber-800/60'
              : 'bg-rose-100 dark:bg-rose-950/60 dark:border dark:border-rose-800/60'
          }`}
        >
          {isCancelled ? (
            <svg
              className="h-7 w-7 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
              />
            </svg>
          ) : (
            <svg
              className="h-7 w-7 text-rose-600 dark:text-rose-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">{copy.title}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{copy.body}</p>

        {orderNumber && (
          <div className="mt-4 rounded-lg bg-surface-muted p-2.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Order Reference: <span className="font-mono font-semibold">{orderNumber}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/cart" className="btn-primary">
            Return to Cart
          </Link>
          {orderNumber && (
            <Link to={`/orders/${orderNumber}`} className="btn-secondary">
              View Order
            </Link>
          )}
          <Link to="/" className="btn-secondary">
            Browse Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};
