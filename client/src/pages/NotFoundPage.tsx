import { Link } from 'react-router-dom';

export const NotFoundPage = (): JSX.Element => (
  <div className="mx-auto max-w-md py-20 text-center">
    <p className="text-6xl font-extrabold text-brand-600">404</p>
    <h1 className="mt-3 text-xl font-bold text-slate-900">Page not found</h1>
    <p className="mt-2 text-sm text-slate-600">That page does not exist or has moved.</p>
    <Link to="/" className="btn-primary mt-6">Back to marketplace</Link>
  </div>
);
