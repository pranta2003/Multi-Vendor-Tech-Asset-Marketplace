import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productApi } from '../lib/services';
import { formatMoney, priceFor } from '../lib/money';
import { useCurrencyStore } from '../store/currency.store';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { ProductListItem } from '../lib/types';

export const CatalogPage = (): JSX.Element => {
  const currency = useCurrencyStore((s) => s.currency);
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    /**
     * `cancelled` guards against a classic race: if the user types quickly,
     * an earlier request can resolve AFTER a later one and overwrite fresh
     * results with stale ones. The cleanup makes only the newest effect win.
     */
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      productApi
        .list({ q: query.trim() || undefined, sort, limit: 12 })
        .then((res) => { if (!cancelled) { setItems(res.items); setError(null); } })
        .catch((err: Error) => { if (!cancelled) setError(err.message); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, query ? 300 : 0); // debounce typing, but load instantly on first paint

    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, sort]);

  return (
    <div>
      <section className="mb-8 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-500 px-6 py-10 text-white sm:px-10">
        <h1 className="max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">
          Premium tech assets from independent creators
        </h1>
        <p className="mt-3 max-w-xl text-brand-50">
          UI kits, production-ready code templates and in-depth courses. Instant delivery,
          licence key included.
        </p>
      </section>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-sm"
          placeholder="Search assets..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search assets"
        />
        <select className="input sm:w-48" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="popular">Most popular</option>
        </select>
      </div>

      {error && <Alert tone="error" title="Could not load products">{error}</Alert>}
      {loading ? (
        <PageLoader label="Loading assets" />
      ) : items.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">No assets match your search.</div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Link key={p.id} to={`/products/${p.slug}`} className="card group overflow-hidden transition-shadow hover:shadow-md">
              <img
                src={p.thumbnailUrl}
                alt={p.title}
                className="h-40 w-full bg-slate-100 object-cover"
                loading="lazy"
              />
              <div className="p-4">
                <p className="text-xs font-medium text-slate-500">{p.vendor.storeName}</p>
                <h2 className="mt-1 font-semibold text-slate-900 group-hover:text-brand-700">{p.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{p.summary}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-bold text-slate-900">{formatMoney(priceFor(p, currency), currency)}</span>
                  {p.stock !== null && p.stock <= 3 && (
                    <span className="badge bg-amber-100 text-amber-800">
                      {p.stock === 0 ? 'Sold out' : `Only ${p.stock} left`}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
