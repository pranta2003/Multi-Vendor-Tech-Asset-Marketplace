import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';

export const RegisterPage = (): JSX.Element => {
  const navigate = useNavigate();
  const { register, loading, error, clearError } = useAuthStore();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', role: 'CUSTOMER' as 'CUSTOMER' | 'VENDOR',
  });

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    clearError();
    try {
      await register(form);
      navigate('/', { replace: true });
    } catch { /* store holds the message */ }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="card p-8">
        <h1 className="text-xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600">Buy assets, or sell your own.</p>

        {error && <div className="mt-5"><Alert tone="error">{error}</Alert></div>}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="fullName">Full name</label>
            <input id="fullName" required minLength={2} className="input" value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" required className="input" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="new-password" required minLength={8}
              className="input" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {/* Mirrors the server's Zod rule so the user is told before submitting. */}
            <p className="mt-1 text-xs text-slate-500">
              At least 8 characters, including upper case, lower case and a number.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="role">I want to</label>
            <select id="role" className="input" value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'CUSTOMER' | 'VENDOR' })}>
              <option value="CUSTOMER">Buy assets</option>
              <option value="VENDOR">Sell assets</option>
            </select>
            {form.role === 'VENDOR' && (
              <p className="mt-1 text-xs text-slate-500">
                Vendor accounts are reviewed before products can be published.
              </p>
            )}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? 'Creating account' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already registered? <Link to="/login" className="font-semibold text-brand-700">Sign in</Link>
        </p>
      </div>
    </div>
  );
};
