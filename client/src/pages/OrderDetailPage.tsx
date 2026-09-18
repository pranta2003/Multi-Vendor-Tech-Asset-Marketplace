import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { orderApi } from '../lib/services';
import { formatMoney } from '../lib/money';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import type { OrderSummary } from '../lib/types';

export const OrderDetailPage = (): JSX.Element => {
  const { orderNumber = '' } = useParams();
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    orderApi.detail(orderNumber)
      .then((o) => { if (!cancelled) setOrder(o); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderNumber]);

  if (loading) return <PageLoader label="Loading order" />;
  if (error || !order) {
    return (
      <Alert tone="error" title="Order not available">
        {/*
          The server returns 404 for both "does not exist" and "belongs to
          someone else", so this message must not distinguish between them
          either - restating the server's message keeps that guarantee intact.
        */}
        {error ?? 'This order could not be found.'}
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/orders" className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">← All orders</Link>
      <div className="card mt-4 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100">{order.orderNumber}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <ul className="mt-6 divide-y divide-surface-border dark:divide-slate-800">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-4 py-3">
              <img src={item.productThumbnail} alt={item.productTitle} className="h-14 w-14 rounded-lg bg-slate-100 object-cover dark:bg-slate-800" />
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">{item.productTitle}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatMoney(item.unitAmount, order.currency)} × {item.quantity}
                </p>
              </div>
              <span className="font-semibold text-slate-900 dark:text-white">{formatMoney(item.lineTotal, order.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between border-t border-surface-border pt-4 text-lg font-bold text-slate-900 dark:border-slate-800 dark:text-white">
          <span>Total</span><span>{formatMoney(order.totalAmount, order.currency)}</span>
        </div>

        {/* Payment and Transaction Details */}
        {order.payments && order.payments.length > 0 && order.payments[0] && (() => {
          const payment = order.payments[0];
          return (
            <div className="mt-6 rounded-xl border border-surface-border bg-surface-muted/50 p-4 text-xs dark:border-slate-800 dark:bg-slate-800/50">
              <h2 className="font-bold text-slate-700 dark:text-slate-300">Payment Details</h2>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 dark:text-slate-400">
                <p>Gateway: <span className="font-semibold text-slate-900 dark:text-slate-100">{payment.provider}</span></p>
                {payment.providerTxnId && (
                  <p>Transaction ID: <span className="font-mono text-slate-900 dark:text-slate-100">{payment.providerTxnId}</span></p>
                )}
                {payment.methodLabel && (
                  <p>Method: <span className="text-slate-900 dark:text-slate-100">{payment.methodLabel}</span></p>
                )}
                <p>Payment Status: <span className="font-semibold text-slate-900 dark:text-slate-100">{payment.status}</span></p>
              </div>
            </div>
          );
        })()}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            to={`/orders/${order.orderNumber}/receipt`}
            className="btn-primary flex items-center gap-1.5 py-2 text-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            View & Print Receipt
          </Link>
          {order.status === 'FULFILLED' && (
            <Link to="/library" className="btn-secondary py-2 text-sm">
              Open my library
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};
