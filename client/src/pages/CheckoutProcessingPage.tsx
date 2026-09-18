import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOrderStatusPolling } from '../hooks/useOrderStatusPolling';
import { useCartStore } from '../store/cart.store';
import { useCurrencyStore } from '../store/currency.store';
import { orderApi } from '../lib/services';
import { formatMoney } from '../lib/money';
import { Spinner } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import type { OrderSummary } from '../lib/types';

export const CheckoutProcessingPage = (): JSX.Element => {
  const [params] = useSearchParams();
  const orderParam = params.get('order') ?? params.get('tran_id') ?? undefined;
  const statusParam = params.get('status')?.toLowerCase();
  const { status, outcome, error } = useOrderStatusPolling(orderParam);
  const currency = useCurrencyStore((s) => s.currency);
  const load = useCartStore((s) => s.load);

  const [orderDetail, setOrderDetail] = useState<OrderSummary | null>(null);

  const displayOrderNumber = status?.orderNumber ?? orderDetail?.orderNumber ?? orderParam;

  // The server clears the cart at fulfilment; re-sync so the header badge is correct
  useEffect(() => {
    if (outcome === 'fulfilled') void load(currency);
  }, [outcome, currency, load]);

  // Load detailed order info once fulfilled or if orderParam exists
  useEffect(() => {
    if (!displayOrderNumber) return;
    let cancelled = false;

    if (outcome === 'fulfilled' || status?.orderStatus === 'FULFILLED' || status?.orderStatus === 'PAID') {
      orderApi
        .detail(displayOrderNumber)
        .then((order) => {
          if (!cancelled) setOrderDetail(order);
        })
        .catch(() => {
          // Non-blocking: polling status still shows success
        });
    }

    return () => {
      cancelled = true;
    };
  }, [outcome, status?.orderStatus, displayOrderNumber]);

  if (!orderParam) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8">
        <Alert tone="error" title="Missing order reference">
          We could not identify this order. If your account was charged, please check your orders page.
        </Alert>
        <div className="mt-4 text-center">
          <Link to="/orders" className="btn-secondary">
            View orders
          </Link>
        </div>
      </div>
    );
  }

  // Handle explicit cancelled status from query params if gateway directed here
  if (statusParam === 'cancelled' || status?.orderStatus === 'CANCELLED') {
    return (
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 dark:border dark:border-amber-800/60">
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
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">Payment Cancelled</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            You cancelled the checkout session before completing the transaction. Nothing was charged and your cart is
            preserved.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/cart" className="btn-primary">
              Return to Cart
            </Link>
            <Link to="/" className="btn-secondary">
              Browse Marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const paymentRecord = orderDetail?.payments?.[0];
  const paymentMethodLabel = paymentRecord?.methodLabel ?? paymentRecord?.provider ?? 'Online Gateway';
  const transactionId = paymentRecord?.providerTxnId ?? paymentRecord?.providerRef ?? orderParam;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* 1. Pending / Confirming State */}
      {outcome === 'pending' && (
        <div className="card p-10 text-center shadow-sm">
          <Spinner className="mx-auto h-12 w-12 text-brand-600 dark:text-brand-400" />
          <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">Confirming your payment</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            We are verifying your transaction with the payment gateway. This usually takes only a few seconds — please
            do not close or refresh this tab.
          </p>
          <div className="mt-6 rounded-lg bg-surface-muted p-4 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            <p>
              Order Reference: <span className="font-mono font-semibold">{displayOrderNumber}</span>
            </p>
            {status && (
              <div className="mt-2 flex justify-center">
                <StatusBadge status={status.orderStatus} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Fulfilled / Success State */}
      {outcome === 'fulfilled' && (
        <div className="card overflow-hidden p-6 shadow-md sm:p-8">
          {/* Header Banner */}
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 dark:border dark:border-emerald-800/80">
              <svg
                className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
              Payment Successful!
            </h1>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              Thank you for your purchase. Your payment has been verified and your digital assets are ready.
            </p>
          </div>

          {/* Payment & Order Summary Box */}
          <div className="mt-6 rounded-xl border border-surface-border bg-surface-muted/50 p-5 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <span className="text-slate-400">Order Number</span>
                <p className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">{displayOrderNumber}</p>
              </div>
              <div>
                <span className="text-slate-400">Transaction Reference</span>
                <p className="font-mono font-medium text-slate-800 dark:text-slate-200 truncate">{transactionId}</p>
              </div>
              <div>
                <span className="text-slate-400">Payment Gateway</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200">{paymentMethodLabel}</p>
              </div>
              <div>
                <span className="text-slate-400">Order Status</span>
                <div className="mt-0.5">
                  <StatusBadge status={status?.orderStatus ?? 'FULFILLED'} />
                </div>
              </div>
            </div>

            {orderDetail && (
              <div className="mt-4 border-t border-surface-border pt-3 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
                <span className="text-slate-400">Customer: </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {orderDetail.billingName} ({orderDetail.billingEmail})
                </span>
              </div>
            )}
          </div>

          {/* Purchased Items List */}
          {orderDetail && orderDetail.items && orderDetail.items.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Items Purchased</h2>
              <ul className="divide-y divide-surface-border rounded-xl border border-surface-border p-3 dark:divide-slate-800 dark:border-slate-800">
                {orderDetail.items.map((item) => (
                  <li key={item.productId} className="flex items-center gap-3 py-2.5">
                    <img
                      src={item.productThumbnail}
                      alt={item.productTitle}
                      className="h-12 w-12 rounded-lg bg-slate-100 object-cover dark:bg-slate-800"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.productTitle}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatMoney(item.lineTotal, orderDetail.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between px-1 text-sm font-bold text-slate-900 dark:text-white">
                <span>Total Paid</span>
                <span className="font-mono text-brand-600 dark:text-brand-400">
                  {formatMoney(orderDetail.totalAmount, orderDetail.currency)}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/library" className="btn-primary text-center py-2.5 text-sm">
              Go to My Library
            </Link>
            {displayOrderNumber && (
              <Link
                to={`/orders/${displayOrderNumber}/receipt`}
                className="btn-secondary text-center py-2.5 text-sm flex items-center justify-center gap-1.5"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                View & Print Receipt
              </Link>
            )}
            {displayOrderNumber && (
              <Link to={`/orders/${displayOrderNumber}`} className="btn-secondary text-center py-2.5 text-sm">
                Order Details
              </Link>
            )}
            <Link to="/" className="btn-secondary text-center py-2.5 text-sm">
              Browse More
            </Link>
          </div>
        </div>
      )}

      {/* 3. Failed State */}
      {outcome === 'failed' && (
        <div className="card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-950/60 dark:border dark:border-rose-800/60">
            <svg
              className="h-7 w-7 text-rose-600 dark:text-rose-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">Payment Failed</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            The payment gateway reported that this transaction could not be completed. Your card has not been charged,
            and any reserved inventory has been safely restored.
          </p>
          <div className="mt-4 rounded-lg bg-surface-muted p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Order Reference: <span className="font-mono font-semibold">{displayOrderNumber}</span>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/cart" className="btn-primary">
              Return to Cart & Retry
            </Link>
            <Link to="/" className="btn-secondary">
              Back to Marketplace
            </Link>
          </div>
        </div>
      )}

      {/* 4. Timeout / Delayed State */}
      {(outcome === 'timeout' || outcome === 'error') && (
        <div className="card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 dark:border dark:border-amber-800/60">
            <svg
              className="h-7 w-7 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">Confirmation In Progress</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            The payment gateway confirmation is taking a little longer than usual. Your payment may still be processing
            in the background — please check your orders page in a moment.
          </p>
          {error && (
            <div className="mt-4 text-left">
              <Alert tone="warning">{error}</Alert>
            </div>
          )}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => window.location.reload()} className="btn-primary">
              Re-check Status
            </button>
            <Link to="/orders" className="btn-secondary">
              View My Orders
            </Link>
            <Link to="/" className="btn-secondary">
              Return Home
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};
