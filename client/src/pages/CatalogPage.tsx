import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productApi } from '../lib/services';
import { formatMoney, priceFor } from '../lib/money';
import { useCurrencyStore } from '../store/currency.store';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { ProductListItem } from '../lib/types';

const CATEGORIES = [
  { label: 'All Assets', value: '' },
  { label: 'UI Kits', value: 'ui-kits' },
  { label: 'Boilerplates', value: 'boilerplates' },
  { label: 'Mobile', value: 'mobile-templates' },
  { label: 'DevOps', value: 'devops' },
  { label: 'Courses', value: 'courses' },
];

export const CatalogPage = (): JSX.Element => {
  const currency = useCurrencyStore((s) => s.currency);
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      productApi
        .list({
          q: query.trim() || undefined,
          categorySlug: selectedCategory || undefined,
          sort,
          limit: 18,
        })
        .then((res) => {
          if (!cancelled) {
            setItems(res.items);
            setError(null);
          }
        })
        .catch((err: Error) => {
          if (!cancelled) setError(err.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, query ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, sort, selectedCategory]);

  const handleResetFilters = (): void => {
    setQuery('');
    setSelectedCategory('');
    setSort('newest');
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 px-6 py-12 text-white shadow-md sm:px-12 sm:py-16">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-100 backdrop-blur-sm">
            Curated Developer Marketplace
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
            Premium tech assets from independent creators
          </h1>
          <p className="mt-4 text-base leading-relaxed text-brand-100 sm:text-lg">
            Production-grade UI design systems, full-stack application boilerplates, and engineering masterclasses.
            Instant digital download with verified licence keys.
          </p>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-1/3 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      </section>

      {/* Category Pills & Search Controls */}
      <div className="space-y-4">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm dark:bg-brand-500'
                    : 'border border-surface-border bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search and Sort Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-md">
            <input
              className="input pr-10"
              placeholder="Search UI kits, boilerplates, courses..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search assets"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <label htmlFor="sort" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Sort by:
            </label>
            <select
              id="sort"
              className="input h-10 w-44 py-1 text-xs"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort assets"
            >
              <option value="newest">Newest</option>
              <option value="popular">Most Popular</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <Alert tone="error" title="Could not load products">
          {error}
        </Alert>
      )}

      {/* Catalog Content */}
      {loading ? (
        <div className="py-12">
          <PageLoader label="Fetching marketplace assets..." />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <svg
              className="h-7 w-7 text-slate-400 dark:text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">No matching assets found</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Try adjusting your search query or category filter to discover more products.
          </p>
          {(query || selectedCategory) && (
            <button type="button" onClick={handleResetFilters} className="btn-secondary mt-5">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const avgRating = p.ratingCount > 0 ? (p.ratingSum / p.ratingCount).toFixed(1) : null;
            return (
              <Link
                key={p.id}
                to={`/products/${p.slug}`}
                className="card group flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={p.thumbnailUrl}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {p.category && (
                    <span className="absolute left-3 top-3 rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                      {p.category.name}
                    </span>
                  )}
                  {p.stock !== null && p.stock <= 3 && (
                    <span className="absolute right-3 top-3 rounded-md bg-amber-500/90 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm backdrop-blur-sm">
                      {p.stock === 0 ? 'Sold out' : `Only ${p.stock} left`}
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{p.vendor.storeName}</span>
                    {avgRating && (
                      <span className="flex items-center gap-1 font-semibold text-amber-500">
                        <span>★</span>
                        <span>{avgRating}</span>
                        <span className="text-slate-400 font-normal">({p.ratingCount})</span>
                      </span>
                    )}
                  </div>

                  <h2 className="mt-2 text-base font-bold text-slate-900 transition-colors group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
                    {p.title}
                  </h2>

                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {p.summary}
                  </p>

                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-surface-border dark:border-slate-800">
                    <div>
                      <span className="text-xs text-slate-400 dark:text-slate-500 block">Price</span>
                      <span className="text-base font-extrabold text-slate-900 dark:text-white">
                        {formatMoney(priceFor(p, currency), currency)}
                      </span>
                    </div>

                    <span className="rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors group-hover:bg-brand-600 group-hover:text-white dark:bg-brand-950/60 dark:text-brand-300 dark:group-hover:bg-brand-500 dark:group-hover:text-white">
                      View details →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
