import { useEffect, useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert } from '../components/Alert';
import { PageLoader, Spinner } from '../components/Spinner';
import { paymentApi } from '../lib/services';

const staticPublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

const PaymentForm = ({ orderNumber }: { orderNumber: string }): JSX.Element => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [elementsReady, setElementsReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/processing?order=${encodeURIComponent(orderNumber)}`,
      },
      redirect: 'if_required',
    });

    if (stripeError) {
      setError(stripeError.message ?? 'Your card could not be charged.');
      setSubmitting(false);
      return;
    }

    // Clear saved client secret on success handoff
    try {
      sessionStorage.removeItem(`stripe_cs_${orderNumber}`);
    } catch {
      // Ignore storage errors
    }

    navigate(`/checkout/processing?order=${encodeURIComponent(orderNumber)}`, { replace: true });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-slate-900 dark:text-slate-100">Card details</h2>

      <div className="mb-4 rounded-lg bg-blue-50/80 p-3 text-xs text-blue-900 border border-blue-200/70 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/60">
        <p className="font-bold flex items-center gap-1.5 mb-1">
          <span>💳</span> Stripe Test Mode Active
        </p>
        <p>Use test card <code className="rounded bg-blue-100 px-1 py-0.5 font-mono text-[11px] font-bold text-blue-800 dark:bg-blue-900/60 dark:text-blue-200">4242 4242 4242 4242</code></p>
        <p className="mt-0.5 text-blue-700 dark:text-blue-300">Expiry: Any future date (e.g. 12/28) &bull; CVC: 123 &bull; ZIP: 10001</p>
      </div>

      <div className="min-h-[160px]">
        <PaymentElement onReady={() => setElementsReady(true)} />
      </div>

      {error && (
        <div className="mt-4">
          <Alert tone="error">{error}</Alert>
        </div>
      )}

      <button
        type="submit"
        className="btn-primary mt-5 w-full py-3 text-base shadow-sm"
        disabled={!stripe || !elements || submitting || !elementsReady}
      >
        {submitting ? (
          <>
            <Spinner className="h-4 w-4" />
            <span>Processing payment...</span>
          </>
        ) : !stripe || !elementsReady ? (
          <>
            <Spinner className="h-4 w-4" />
            <span>Loading payment form...</span>
          </>
        ) : (
          'Pay now'
        )}
      </button>

      <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">
        Card details are sent directly to Stripe over TLS and never touch our servers.
      </p>
    </form>
  );
};

export const StripeCheckoutPage = (): JSX.Element => {
  const { orderNumber = '' } = useParams();
  const location = useLocation();

  // Try router state first, fall back to sessionStorage across refreshes
  const [clientSecret] = useState<string | null>(() => {
    const fromState = (location.state as { clientSecret?: string } | null)?.clientSecret;
    if (fromState) {
      try {
        sessionStorage.setItem(`stripe_cs_${orderNumber}`, fromState);
      } catch {
        // Ignore storage errors
      }
      return fromState;
    }
    try {
      return sessionStorage.getItem(`stripe_cs_${orderNumber}`);
    } catch {
      return null;
    }
  });

  const [publishableKey, setPublishableKey] = useState<string | null>(staticPublishableKey || null);
  const [keyLoading, setKeyLoading] = useState(!staticPublishableKey);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    if (publishableKey) return;
    let active = true;

    paymentApi
      .config()
      .then((cfg) => {
        if (!active) return;
        if (cfg.stripePublishableKey) {
          setPublishableKey(cfg.stripePublishableKey);
        } else {
          setKeyError('Stripe publishable key is not configured on the backend or frontend.');
        }
      })
      .catch((err) => {
        if (!active) return;
        setKeyError(err instanceof Error ? err.message : 'Could not fetch payment configuration.');
      })
      .finally(() => {
        if (active) setKeyLoading(false);
      });

    return () => {
      active = false;
    };
  }, [publishableKey]);

  const stripePromise = useMemo<Promise<Stripe | null> | null>(() => {
    if (!publishableKey) return null;
    return loadStripe(publishableKey);
  }, [publishableKey]);

  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const options = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            appearance: {
              theme: (isDarkMode ? 'night' : 'stripe') as 'night' | 'stripe',
            },
          }
        : null,
    [clientSecret, isDarkMode],
  );

  if (!clientSecret) {
    return <Navigate to="/cart" replace />;
  }

  if (keyLoading) {
    return <PageLoader label="Loading Stripe payment gateway..." />;
  }

  if (keyError || !stripePromise) {
    return (
      <div className="mx-auto max-w-md">
        <Alert tone="error" title="Stripe is not configured">
          {keyError ?? 'VITE_STRIPE_PUBLISHABLE_KEY is missing from the environment.'}
        </Alert>
        <div className="mt-4 text-center">
          <Link to="/cart" className="btn-secondary">Return to cart</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
        Complete your payment
      </h1>
      <Elements stripe={stripePromise} options={options!}>
        <PaymentForm orderNumber={orderNumber} />
      </Elements>
      <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        Order reference: <span className="font-mono font-semibold">{orderNumber}</span>
      </p>
    </div>
  );
};
