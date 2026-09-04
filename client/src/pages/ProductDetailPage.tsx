import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { productApi } from '../lib/services';
import { formatMoney, priceFor } from '../lib/money';
import { useCurrencyStore } from '../store/currency.store';
import { useCartStore } from '../store/cart.store';
import { useAuthStore } from '../store/auth.store';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { ProductDetail } from '../lib/types';

export const ProductDetailPage = (): JSX.Element => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const currency = useCurrencyStore((s) => s.currency);
  const { user } = useAuthStore();
  const { add, mutating } = useCartStore();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productApi
      .detail(slug)
      .then((p) => { if (!cancelled) { setProduct(p); setError(null); } })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const handleAdd = async (): Promise<void> => {
    if (!product) return;
    if (!user) { navigate('/login', { state: { from: `/products/${slug}` } }); return; }
    try {
      await add(product.id, 1, currency);
      setAdded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to cart');
    }
  };

  if (loading) return <PageLoader label="Loading product" />;
  if (!product) return <Alert tone="error" title="Not found">This product is not available.</Alert>;

  const soldOut = product.stock !== null && product.stock <= 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
      <div>
        <img src={product.thumbnailUrl} alt={product.title} className="w-full rounded-xl bg-slate-100 object-cover" />
        <h1 className="mt-6 text-2xl font-bold text-slate-900">{product.title}</h1>
        <p className="mt-2 text-slate-600">{product.summary}</p>
        <div className="prose prose-slate mt-6 max-w-none whitespace-pre-line text-sm text-slate-700">
          {product.description}
        </div>
      </div>

      <aside className="h-fit lg:sticky lg:top-24">
        <div className="card p-6">
          <p className="text-sm text-slate-500">by {product.vendor.storeName}</p>
          <p className="mt-2 text-3xl font-extrabold text-slate-900">
            {formatMoney(priceFor(product, currency), currency)}
          </p>
          {product.stock !== null && (
            <p className="mt-1 text-sm text-slate-500">
              {soldOut ? 'Currently sold out' : `${product.stock} licence(s) available`}
            </p>
          )}

          {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}
          {added && <div className="mt-4"><Alert tone="success">Added to your cart.</Alert></div>}

          <button
            className="btn-primary mt-5 w-full"
            onClick={handleAdd}
            disabled={soldOut || !!mutating[product.id]}
          >
            {soldOut ? 'Sold out' : mutating[product.id] ? 'Adding...' : 'Add to cart'}
          </button>

          <button className="btn-secondary mt-2 w-full" onClick={() => navigate('/cart')}>
            View cart
          </button>
          <p className="mt-4 text-xs text-slate-500">
            Instant digital delivery. A licence key is issued the moment payment is confirmed.
          </p>
        </div>
      </aside>
    </div>
  );
};
