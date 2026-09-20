import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productApi } from '../lib/services';
import { formatMoney, priceFor } from '../lib/money';
import { useCurrencyStore } from '../store/currency.store';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { PaginationMeta, ProductListItem } from '../lib/types';

const CATEGORIES = [
  { label: 'All Assets', value: '' },
  { label: 'UI Kits', value: 'ui-kits' },
  { label: 'Frontend Templates', value: 'frontend-templates' },
  { label: 'Boilerplates', value: 'boilerplates' },
  { label: 'Mobile Apps', value: 'mobile-templates' },
  { label: 'Cloud & DevOps', value: 'devops' },
  { label: 'AI & ML Tools', value: 'ai-tools' },
  { label: 'Masterclasses', value: 'courses' },
];

export const CatalogPage = (): JSX.Element => {
  const currency = useCurrencyStore((s) => s.currency);
  const [items, setItems] = useState<ProductListItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState('newest');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(() => {
      productApi
        .list({
          page,
          limit: 12,
          q: query.trim() || undefined,
          categorySlug: selectedCategory || undefined,
          sort,
        })
        .then((res) => {
          if (!cancelled) {
            setItems(res.items);
            setMeta(res.meta);
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
  }, [page, query, sort, selectedCategory]);

  const handleCategoryChange = (val: string): void => {
    setSelectedCategory(val);
    setPage(1);
  };

  const handleQueryChange = (val: string): void => {
    setQuery(val);
    setPage(1);
  };

  const handleSortChange = (val: string): void => {
    setSort(val);
    setPage(1);
  };

  const handleResetFilters = (): void => {
    setQuery('');
    setSelectedCategory('');
    setSort('newest');
    setPage(1);
  };

  return (
    <div className="space-y-8">
      {/* Hero Banner with Modern Light/Dark Polish */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-indigo-600 to-violet-800 px-6 py-12 text-white shadow-xl shadow-brand-700/15 sm:px-12 sm:py-16">
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-md ring-1 ring-white/30">
              ✨ Curated Tech Marketplace
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-100 backdrop-blur-sm">
              24+ Verified Assets
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl leading-tight text-white drop-shadow-xs">
            Premium tech assets from independent creators
          </h1>
          <p className="mt-4 text-base leading-relaxed text-brand-100/90 sm:text-lg max-w-2xl">
            Production-grade UI design systems, full-stack application boilerplates, cloud automation Helm charts, and engineering masterclasses. Instant download with verified license keys.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-semibold text-white/90">
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <svg className="h-4 w-4 text-amber-300" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>4.9 / 5.0 Average Quality Rating</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
              <span>⚡ Instant ZIP & License Key</span>
            </div>
          </div>
        </div>

        {/* Decorative background glow */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-80 w-80 rounded-full bg-violet-400/20 blur-3xl" />
      </section>

      {/* Category Pills & Search Controls Bar */}
      <div className="space-y-4">
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleCategoryChange(cat.value)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/10 dark:bg-brand-500 dark:text-white dark:ring-brand-400/20'
                    : 'border border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search and Sort Toolbar Card */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800/80 dark:bg-slate-900">
          <div className="relative flex-1 sm:max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              className="input pl-9 pr-10"
              placeholder="Search UI kits, boilerplates, DevOps, courses..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              aria-label="Search assets"
            />
            {query && (
              <button
                type="button"
                onClick={() => handleQueryChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:ml-auto">
            <label htmlFor="sort" className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
              Sort by:
            </label>
            <select
              id="sort"
              className="input h-10 w-44 py-1 text-xs font-medium"
              value={sort}
              onChange={(e) => handleSortChange(e.target.value)}
              aria-label="Sort assets"
            >
              <option value="newest">Newest Releases</option>
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

      {/* Catalog Content Grid */}
      {loading ? (
        <div className="py-16">
          <PageLoader label="Fetching marketplace assets..." />
        </div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500">
            <svg
              className="h-7 w-7"
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
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((p) => {
              const avgRating = p.ratingCount > 0 ? (p.ratingSum / p.ratingCount).toFixed(1) : null;
              return (
                <Link
                  key={p.id}
                  to={`/products/${p.slug}`}
                  className="card-hover group flex flex-col overflow-hidden"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <img
                      src={p.thumbnailUrl}
                      alt={p.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {p.category && (
                      <span className="absolute left-3 top-3 rounded-lg bg-slate-900/85 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs backdrop-blur-md">
                        {p.category.name}
                      </span>
                    )}
                    {p.stock !== null && p.stock <= 3 && (
                      <span className="absolute right-3 top-3 rounded-lg bg-amber-500/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm backdrop-blur-md">
                        {p.stock === 0 ? 'Sold out' : `Only ${p.stock} left`}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{p.vendor.storeName}</span>
                      {avgRating && (
                        <span className="flex items-center gap-1 font-bold text-amber-500">
                          <span>★</span>
                          <span>{avgRating}</span>
                          <span className="text-slate-400 font-normal text-[11px]">({p.ratingCount})</span>
                        </span>
                      )}
                    </div>

                    <h2 className="mt-2 text-base font-bold tracking-tight text-slate-900 transition-colors group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400 line-clamp-1">
                      {p.title}
                    </h2>

                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                      {p.summary}
                    </p>

                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80">
                      <div>
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                          Price
                        </span>
                        <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                          {formatMoney(priceFor(p, currency), currency)}
                        </span>
                      </div>

                      <span className="rounded-xl bg-brand-50 px-3.5 py-1.5 text-xs font-bold text-brand-700 border border-brand-200/80 shadow-2xs transition-all group-hover:bg-brand-600 group-hover:text-white group-hover:border-transparent group-hover:shadow-sm dark:bg-brand-950/80 dark:text-brand-300 dark:border-brand-800/80 dark:group-hover:bg-brand-600 dark:group-hover:text-white dark:group-hover:border-transparent">
                        View details →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-6 sm:flex-row dark:border-slate-800">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Showing <span className="font-bold text-slate-900 dark:text-slate-100">{(meta.page - 1) * meta.limit + 1}</span> to{' '}
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  {Math.min(meta.page * meta.limit, meta.total)}
                </span>{' '}
                of <span className="font-bold text-slate-900 dark:text-slate-100">{meta.total}</span> assets
              </p>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!meta.hasPrev}
                  onClick={() => {
                    setPage((p) => Math.max(p - 1, 1));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="btn-secondary h-9 px-3.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ← Previous
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((pNum) => (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => {
                        setPage(pNum);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`h-9 w-9 rounded-xl text-xs font-bold transition-all ${
                        pNum === meta.page
                          ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/30 dark:bg-brand-500'
                          : 'border border-slate-200/90 bg-white text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {pNum}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={!meta.hasNext}
                  onClick={() => {
                    setPage((p) => Math.min(p + 1, meta.totalPages));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="btn-secondary h-9 px-3.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
