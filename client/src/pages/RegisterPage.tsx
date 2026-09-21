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
  const hasUppercase = /[A-Z]/.test(form.password);
  const hasLowercase = /[a-z]/.test(form.password);
  const hasDigit = /[0-9]/.test(form.password);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    const trimmedName = form.fullName.trim();
    const trimmedEmail = form.email.trim();

    if (trimmedName.length < 2) {
      setLocalError('Full name must be at least 2 characters.');
      return;
    }

    if (!hasMinLength) {
      setLocalError('Password must be at least 8 characters long.');
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
    <div className="relative mx-auto max-w-md px-4 py-8 sm:py-12">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="card relative p-6 sm:p-9 shadow-lg shadow-slate-200/50 dark:border-slate-800/80 dark:bg-slate-900 dark:shadow-none">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Create your account
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Join the developer marketplace to acquire premium assets or publish your own creations.
          </p>
        </div>

        {displayError && (
          <div className="mt-5">
            <Alert tone="error">{displayError}</Alert>
          </div>
        )}

        {/* Google Sign-Up Button */}
        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading || googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-xs focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700/80"
          >
            {googleLoading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <svg className="h-5 w-5 shrink-0" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
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
            <span>{googleLoading ? 'Setting up with Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200/80 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider font-semibold">
            <span className="bg-white px-3 text-slate-400 dark:bg-slate-900 dark:text-slate-500">
              Or sign up with email
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="fullName">
              Full Name
            </label>
            <input
              id="fullName"
              required
              minLength={2}
              className="input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="Pranta Kumer Pandit"
            />
          </div>

          <div>
            <label className="label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="pranta@example.com"
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
              placeholder="At least 8 characters . Think it first !"
            />
            <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800/80 dark:bg-slate-800/40">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Security Checklist:
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-xs">
                <span className={hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}>
                  {hasMinLength ? '✓' : '•'} 8+ characters
                </span>
                <span className={hasUppercase ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}>
                  {hasUppercase ? '✓' : '•'} One uppercase
                </span>
                <span className={hasLowercase ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}>
                  {hasLowercase ? '✓' : '•'} One lowercase
                </span>
                <span className={hasDigit ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400 dark:text-slate-500'}>
                  {hasDigit ? '✓' : '•'} One number
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="role">
              Account Type
            </label>
            <select
              id="role"
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as 'CUSTOMER' | 'VENDOR' })}
            >
              <option value="CUSTOMER">Customer (Browse & Purchase Assets)</option>
              <option value="VENDOR">Vendor (Publish & Sell Digital Assets)</option>
            </select>
            {form.role === 'VENDOR' && (
              <p className="mt-1.5 text-xs text-brand-600 dark:text-brand-400 font-medium">
                Vendor accounts are verified by administrators before product publications go live.
              </p>
            )}
          </div>

          {form.role === 'VENDOR' && (
            <div>
              <label className="label" htmlFor="storeName">
                Store Name
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

          <button
            type="submit"
            className="btn-primary w-full py-3 text-sm font-semibold shadow-sm mt-2"
            disabled={loading || googleLoading}
          >
            {loading && <Spinner className="h-4 w-4" />}
            {loading ? 'Creating account...' : 'Create AssetHub Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};
