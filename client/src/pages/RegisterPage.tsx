import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';

export const RegisterPage = (): JSX.Element => {
  const navigate = useNavigate();
  const { register, loginWithGoogle, loading, error, clearError } = useAuthStore();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'CUSTOMER' as 'CUSTOMER' | 'VENDOR',
    storeName: '',
  });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const hasMinLength = form.password.length >= 8;
  const hasLowercase = /[a-z]/.test(form.password);
  const hasUppercase = /[A-Z]/.test(form.password);
  const hasDigit = /[0-9]/.test(form.password);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    const trimmedName = form.fullName.trim();
    if (trimmedName.length < 2) {
      setLocalError('Full name must be at least 2 characters.');
      return;
    }

    const trimmedEmail = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }

    if (!hasMinLength) {
      setLocalError('Password must contain at least 8 characters.');
      return;
    }
    if (!hasLowercase) {
      setLocalError('Password must contain at least one lowercase letter.');
      return;
    }
    if (!hasUppercase) {
      setLocalError('Password must contain at least one uppercase letter.');
      return;
    }
    if (!hasDigit) {
      setLocalError('Password must contain at least one number.');
      return;
    }

    if (form.role === 'VENDOR' && form.storeName.trim().length < 3) {
      setLocalError('Store name must be at least 3 characters when registering as a vendor.');
      return;
    }

    try {
      await register({
        fullName: trimmedName,
        email: trimmedEmail,
        password: form.password,
        role: form.role,
        storeName: form.role === 'VENDOR' ? form.storeName.trim() : undefined,
      });
      navigate('/', { replace: true });
    } catch {
      /* store holds the message */
    }
  };

  const handleGoogleSignUp = async (): Promise<void> => {
    clearError();
    setLocalError(null);
    if (form.role === 'VENDOR' && form.storeName.trim().length < 3) {
      setLocalError('Please enter a store name (at least 3 characters) to register as a vendor.');
      return;
    }
    setGoogleLoading(true);
    try {
      await loginWithGoogle(
        form.role,
        form.role === 'VENDOR' ? form.storeName.trim() : undefined,
      );
      navigate('/', { replace: true });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Google sign-up failed');
    } finally {
      setGoogleLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="mx-auto max-w-md px-2 py-6">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Create your account</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Join the developer marketplace to buy assets or sell your own.
        </p>

        {displayError && (
          <div className="mt-5">
            <Alert tone="error">{displayError}</Alert>
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80"
          >
            {googleLoading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{googleLoading ? 'Signing up with Google...' : 'Sign up with Google'}</span>
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-surface-border dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2.5 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              Or sign up with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="fullName">
              Full name
            </label>
            <input
              id="fullName"
              required
              minLength={2}
              className="input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Alex Smith"
            />
          </div>
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="alex@example.com"
            />
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="input"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 8 characters"
            />
            <div className="mt-2 space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Password requirements:</p>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className={hasMinLength ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                  {hasMinLength ? '✓' : '•'} 8+ characters
                </span>
                <span className={hasUppercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                  {hasUppercase ? '✓' : '•'} One uppercase letter
                </span>
                <span className={hasLowercase ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                  {hasLowercase ? '✓' : '•'} One lowercase letter
                </span>
                <span className={hasDigit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                  {hasDigit ? '✓' : '•'} One number
                </span>
              </div>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="role">
              Account type
            </label>
            <select
              id="role"
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'CUSTOMER' | 'VENDOR' })}
            >
              <option value="CUSTOMER">Customer (Browse & Purchase Assets)</option>
              <option value="VENDOR">Vendor (Sell Tech Assets & Templates)</option>
            </select>
            {form.role === 'VENDOR' && (
              <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400">
                Vendor accounts are reviewed by administrators before assets are published live.
              </p>
            )}
          </div>
          {form.role === 'VENDOR' && (
            <div>
              <label className="label" htmlFor="storeName">
                Store name
              </label>
              <input
                id="storeName"
                required
                minLength={3}
                maxLength={80}
                className="input"
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                placeholder="e.g. PixelForge Studios"
              />
            </div>
          )}
          <button type="submit" className="btn-primary w-full" disabled={loading || googleLoading}>
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-500 dark:text-brand-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
