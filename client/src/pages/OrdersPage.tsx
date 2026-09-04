import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../lib/services';
import { formatMoney } from '../lib/money';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import { StatusBadge } from '../components/StatusBadge';
import type { OrderSummary } from '../lib/types';

export const OrdersPage = (): JSX.Element => {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    orderApi.listMine({ limit: 20 })
      .then((r) => { if (!cancelled) setOrders(r.items); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <PageLoader label="Loading orders" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Your orders</h1>
      {error && <Alert tone="error">{error}</Alert>}
      {orders.length === 0 ? (
        <div className="card p-12 text-center text-slate-600">
          You have not placed any orders yet.
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} to={`/orders/${o.orderNumber}`} className="card flex items-center gap-4 p-4 hover:shadow-md">
              <div className="flex-1">
                <p className="font-mono text-sm font-semibold text-slate-900">{o.orderNumber}</p>
                <p className="text-xs text-slate-500">
                  {new Date(o.createdAt).toLocaleString()} · {o.items.length} item(s)
                </p>
              </div>
              <StatusBadge status={o.status} />
              <div className="w-28 text-right font-semibold">{formatMoney(o.totalAmount, o.currency)}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
