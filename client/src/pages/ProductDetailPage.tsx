import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { productApi } from '../lib/services';
import { formatMoney, priceFor } from '../lib/money';
import { useCurrencyStore } from '../store/currency.store';
import { useCartStore } from '../store/cart.store';
import { useAuthStore } from '../store/auth.store';
import { PageLoader, Spinner } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { ProductDetail } from '../lib/types';

export const ProductDetailPage = (): JSX.Element => {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const currency = useCurrencyStore((s) => s.currency);
  const { user } = useAuthStore();
  const { add, mutating } = useCartStore();

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [activeImage, setActiveImage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    productApi
      .detail(slug)
      .then((p) => {
        if (!cancelled) {
          setProduct(p);
          setActiveImage(p.thumbnailUrl);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const handleAdd = async (): Promise<void> => {
    if (!product) return;
    if (!user) {
      navigate('/login', { state: { from: `/products/${slug}` } });
      return;
    }
    try {
      await add(product.id, 1, currency);
      setAdded(true);
      setTimeout(() => setAdded(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add to cart');
    }
  };

  if (loading) return <PageLoader label="Loading product..." />;
  if (!product) {
    return (
      <div className="card p-12 text-center">
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Product Not Found</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          The asset you are looking for might have been moved or unpublished.
        </p>
        <Link to="/" className="btn-primary mt-6">
          Return to Catalog
        </Link>
      </div>
    );
  }

  const soldOut = product.stock !== null && product.stock <= 0;
  const isAdding = Boolean(mutating[product.id]);
  const avgRating = product.ratingCount > 0 ? (product.ratingSum / product.ratingCount).toFixed(1) : null;
  const allImages = Array.from(new Set([product.thumbnailUrl, ...(product.galleryUrls || [])]));

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-brand-600 dark:hover:text-brand-400">
          Catalog
        </Link>
        <span>/</span>
        {product.category && (
          <>
            <span className="hover:text-brand-600 dark:hover:text-brand-400">{product.category.name}</span>
            <span>/</span>
          </>
        )}
        <span className="truncate max-w-[200px] sm:max-w-xs font-medium text-slate-800 dark:text-slate-200">
          {product.title}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        {/* Left Column: Visuals & Description */}
        <div className="space-y-6">
          {/* Main Showcase Image */}
          <div className="overflow-hidden rounded-2xl border border-surface-border bg-slate-100 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <img
              src={activeImage || product.thumbnailUrl}
              alt={product.title}
              className="aspect-[16/10] w-full object-cover transition-all"
            />
          </div>

          {/* Gallery Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {allImages.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(imgUrl)}
                  className={`relative aspect-[16/10] w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    activeImage === imgUrl
                      ? 'border-brand-600 ring-2 ring-brand-500/20 dark:border-brand-400'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Header & Badges */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {product.category && (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 border border-brand-200/60 dark:bg-brand-950/80 dark:text-brand-200 dark:border-brand-800/60">
                  {product.category.name}
                </span>
              )}
              {avgRating && (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <span>★</span>
                  <span>{avgRating}</span>
                  <span className="text-[11px] font-normal opacity-80">({product.ratingCount} reviews)</span>
                </span>
              )}
              {product.downloadCount > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {product.downloadCount} purchases
                </span>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">
              {product.title}
            </h1>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-300">{product.summary}</p>
          </div>

          {/* Description Section */}
          <div className="card p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Product Details & Specs</h2>
            <div className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              {product.description}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing & Purchase Card */}
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="card p-6 shadow-md sm:p-7">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Single Digital Licence
              </span>
              {product.stock !== null && (
                <span
                  className={`badge ${
                    soldOut
                      ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {soldOut ? 'Sold out' : `${product.stock} licences left`}
                </span>
              )}
            </div>

            <p className="mt-4 text-3xl font-black text-slate-900 dark:text-white">
              {formatMoney(priceFor(product, currency), currency)}
            </p>

            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Vendor:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {product.vendor.storeName}
              </span>
            </div>

            {error && (
              <div className="mt-4">
                <Alert tone="error">{error}</Alert>
              </div>
            )}

            {added && (
              <div className="mt-4">
                <Alert tone="success">Item added to your cart!</Alert>
              </div>
            )}

            <div className="mt-6 space-y-2.5">
              <button
                type="button"
                className="btn-primary w-full py-3 text-base shadow-sm"
                onClick={handleAdd}
                disabled={soldOut || isAdding}
              >
                {isAdding && <Spinner className="h-4 w-4" />}
                {soldOut ? 'Sold out' : isAdding ? 'Adding to cart...' : 'Add to cart'}
              </button>

              <button
                type="button"
                className="btn-secondary w-full py-2.5 text-sm"
                onClick={() => navigate('/cart')}
              >
                View Cart
              </button>
            </div>

            {/* Guarantee and Details Checklist */}
            <div className="mt-6 space-y-2 border-t border-surface-border pt-6 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Instant digital download upon purchase</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Unique cryptographically verified licence key</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Free future version updates from creator</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-emerald-500">✓</span>
                <span>Commercial & personal project licence</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
