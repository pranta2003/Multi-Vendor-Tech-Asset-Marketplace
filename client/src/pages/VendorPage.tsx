import { useEffect, useState } from 'react';
import { productApi } from '../lib/services';
import { formatMoney } from '../lib/money';
import { useCurrencyStore } from '../store/currency.store';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { ProductStatus, VendorProduct } from '../lib/types';

const STATUS_STYLE: Record<ProductStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'bg-amber-100 text-amber-800',
  PUBLISHED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-100 text-red-800',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

export const VendorPage = (): JSX.Element => {
  const currency = useCurrencyStore((s) => s.currency);
  const [products, setProducts] = useState<VendorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    productApi.mine()
      .then((p) => { if (!cancelled) setProducts(p); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <PageLoader label="Loading your products" />;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Vendor dashboard</h1>
      <p className="mb-6 text-sm text-slate-600">
        New and edited products enter review before they can be published.
      </p>
      {error && <Alert tone="error">{error}</Alert>}

      {products.length === 0 ? (
        <div className="card p-12 text-center text-slate-600">You have not created any products yet.</div>
      ) : (
        <div className="card divide-y divide-surface-border">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4">
              <img src={p.thumbnailUrl} alt={p.title} className="h-12 w-12 rounded-lg bg-slate-100 object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{p.title}</p>
                <p className="text-xs text-slate-500">
                  {p.stock === null ? 'Unlimited licences' : `${p.stock} in stock`}
                </p>
              </div>
              <span className={`badge ${STATUS_STYLE[p.status]}`}>{p.status}</span>
              <span className="w-24 text-right font-semibold">
                {formatMoney(currency === 'USD' ? p.priceUsdCents : p.priceBdtPoisha, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
