export const Spinner = ({ className = 'h-5 w-5' }: { className?: string }): JSX.Element => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor"
      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

export const PageLoader = ({ label = 'Loading' }: { label?: string }): JSX.Element => (
  <div className="flex min-h-[50vh] items-center justify-center text-slate-500" role="status">
    <Spinner className="h-8 w-8 text-brand-600" />
    <span className="ml-3 text-sm">{label}...</span>
  </div>
);
