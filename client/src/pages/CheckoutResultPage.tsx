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
  const orderNumber = params.get('order');

  const copy = variant === 'cancelled'
    ? {
        title: 'Payment cancelled',
        body: 'You cancelled the payment before it completed. Nothing has been charged and your cart is untouched.',
      }
    : {
        title: 'Payment failed',
        body: 'The payment could not be completed. You have not been charged, and any items reserved for this order have been released.',
      };

  return (
    <div className="mx-auto max-w-lg">
      <div className="card p-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-7 w-7 text-amber-600" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          </svg>
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">{copy.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{copy.body}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/cart" className="btn-primary">Back to cart</Link>
          {orderNumber && <Link to={`/orders/${orderNumber}`} className="btn-secondary">View order</Link>}
        </div>
      </div>
    </div>
  );
};
