import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';

export const LoginPage = (): JSX.Element => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    clearError();
    try {
      await login(email, password);
      // `replace` so the back button does not return to the login form after
      // a successful sign-in.
      navigate(from, { replace: true });
    } catch {
      /* the store already holds the message; nothing to do here */
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to continue to your library.</p>

        {error && <div className="mt-5"><Alert tone="error">{error}</Alert></div>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required className="input"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required className="input"
              value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? 'Signing in' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          No account? <Link to="/register" className="font-semibold text-brand-700">Create one</Link>
        </p>
      </div>
    </div>
  );
};
