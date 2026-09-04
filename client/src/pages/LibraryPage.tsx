import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../lib/services';
import { PageLoader } from '../components/Spinner';
import { Alert } from '../components/Alert';
import type { Entitlement } from '../lib/types';

export const LibraryPage = (): JSX.Element => {
  const [grants, setGrants] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    orderApi.entitlements()
      .then((g) => { if (!cancelled) setGrants(g); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <PageLoader label="Loading your library" />;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">My library</h1>
      <p className="mb-6 text-sm text-slate-600">
        Every asset you own, with its licence key. Only fulfilled orders appear here.
      </p>
      {error && <Alert tone="error">{error}</Alert>}

      {grants.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-slate-600">You do not own any assets yet.</p>
          <Link to="/" className="btn-primary mt-5">Browse the marketplace</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {grants.map((g) => (
            <div key={g.licenseKey} className="card p-5">
              <div className="flex gap-4">
                <img src={g.product.thumbnailUrl} alt={g.product.title} className="h-16 w-16 rounded-lg bg-slate-100 object-cover" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold text-slate-900">{g.product.title}</h2>
                  <p className="font-mono text-xs text-slate-500">{g.order.orderNumber}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {g.maxDownloads === null
                      ? `${g.downloadCount} download(s)`
                      : `${g.downloadCount} of ${g.maxDownloads} downloads used`}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-surface-muted p-3">
                <p className="text-xs font-medium text-slate-500">Licence key</p>
                <div className="mt-1 flex items-center gap-2">
                  {/*
                    Keys are masked until requested. Guards against shoulder
                    surfing and against keys being captured in screen shares or
                    screenshots of the library page.
                  */}
                  <code className="flex-1 truncate font-mono text-sm text-slate-800">
                    {revealed[g.licenseKey] ? g.licenseKey : '•••••-•••••-•••••-•••••'}
                  </code>
                  <button
                    className="text-xs font-semibold text-brand-700 hover:underline"
                    onClick={() => setRevealed((r) => ({ ...r, [g.licenseKey]: !r[g.licenseKey] }))}
                  >
                    {revealed[g.licenseKey] ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    className="text-xs font-semibold text-brand-700 hover:underline"
                    onClick={() => void navigator.clipboard?.writeText(g.licenseKey)}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
