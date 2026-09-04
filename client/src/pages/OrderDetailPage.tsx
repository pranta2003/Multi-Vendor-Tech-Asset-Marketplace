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
      <Link to="/orders" className="text-sm font-medium text-brand-700 hover:underline">← All orders</Link>
      <div className="card mt-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-lg font-bold text-slate-900">{order.orderNumber}</h1>
            <p className="text-sm text-slate-500">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        <ul className="mt-6 divide-y divide-surface-border">
          {order.items.map((item) => (
            /* productId is unique per order (schema has @@unique([orderId, productId])), so it is a stable key. */
            <li key={item.productId} className="flex items-center gap-4 py-3">
              <img src={item.productThumbnail} alt={item.productTitle} className="h-14 w-14 rounded-lg bg-slate-100 object-cover" />
              <div className="flex-1">
                {/*
                  Rendering the ORDER ITEM SNAPSHOT (title/price captured at
                  purchase), not the live product. If the vendor later renames
                  the product or changes its price, this receipt still shows
                  what was actually bought and paid.
                */}
                <p className="font-medium text-slate-900">{item.productTitle}</p>
                <p className="text-xs text-slate-500">
                  {formatMoney(item.unitAmount, order.currency)} × {item.quantity}
                </p>
              </div>
              <span className="font-semibold">{formatMoney(item.lineTotal, order.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex justify-between border-t border-surface-border pt-4 text-lg font-bold">
          <span>Total</span><span>{formatMoney(order.totalAmount, order.currency)}</span>
        </div>

        {order.status === 'FULFILLED' && (
          <Link to="/library" className="btn-primary mt-6">Open my library</Link>
        )}
      </div>
    </div>
  );
};
