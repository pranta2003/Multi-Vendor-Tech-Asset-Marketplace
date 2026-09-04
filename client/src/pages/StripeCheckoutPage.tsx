import { useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';

/**
 * loadStripe is called ONCE at module scope, not inside the component.
 *
 * It injects Stripe.js into the page; calling it on every render would repeat
 * that work and discard the instance each time. Only the PUBLISHABLE key is
 * used here - it is designed to be public. The secret key exists solely on the
 * server and is never referenced by any VITE_* variable, because everything
 * prefixed with VITE_ is inlined into the bundle shipped to the browser.
 */
const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const PaymentForm = ({ orderNumber }: { orderNumber: string }): JSX.Element => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Stripe redirects here for authentication flows (3D Secure). Our
        // processing page then polls the SERVER, because confirmPayment
        // resolving successfully still does not mean our backend has processed
        // the webhook - the webhook remains the only source of truth.
        return_url: `${window.location.origin}/checkout/processing?order=${encodeURIComponent(orderNumber)}`,
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Your card could not be charged.');
      setSubmitting(false);
      return;
    }

    // No redirect was required (e.g. a non-3DS card). Payment is submitted, but
    // fulfilment still depends on the webhook, so hand off to the poller.
    navigate(`/checkout/processing?order=${encodeURIComponent(orderNumber)}`, { replace: true });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <h2 className="mb-4 font-semibold text-slate-900">Card details</h2>
      <PaymentElement />
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
      <button type="submit" className="btn-primary mt-5 w-full" disabled={!stripe || submitting}>
        {submitting && <Spinner className="h-4 w-4" />}
        {submitting ? 'Processing' : 'Pay now'}
      </button>
      <p className="mt-3 text-center text-xs text-slate-500">
        Card details are sent directly to Stripe and never reach our servers.
      </p>
    </form>
  );
};

export const StripeCheckoutPage = (): JSX.Element => {
  const { orderNumber = '' } = useParams();
  const location = useLocation();
  const clientSecret = (location.state as { clientSecret?: string } | null)?.clientSecret;

  const options = useMemo(
    () => (clientSecret ? { clientSecret, appearance: { theme: 'stripe' as const } } : null),
    [clientSecret],
  );

  if (!clientSecret || !options) {
    // Reached by a refresh (router state is lost) or by navigating here
    // directly. Restarting checkout is correct - we must not invent a secret.
    return <Navigate to="/cart" replace />;
  }

  if (!stripePromise) {
    return (
      <Alert tone="error" title="Stripe is not configured">
        VITE_STRIPE_PUBLISHABLE_KEY is missing from the frontend environment.
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Complete your payment</h1>
      <Elements stripe={stripePromise} options={options}>
        <PaymentForm orderNumber={orderNumber} />
      </Elements>
      <p className="mt-4 text-center text-xs text-slate-500">
        Order <span className="font-mono">{orderNumber}</span>
      </p>
    </div>
  );
};
