interface AlertProps {
  tone?: 'error' | 'success' | 'info' | 'warning';
  title?: string;
  children: React.ReactNode;
  requestId?: string | undefined;
}

const TONES: Record<NonNullable<AlertProps['tone']>, string> = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  info: 'border-brand-200 bg-brand-50 text-brand-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

export const Alert = ({ tone = 'info', title, children, requestId }: AlertProps): JSX.Element => (
  <div className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]}`} role={tone === 'error' ? 'alert' : 'status'}>
    {title && <p className="mb-0.5 font-semibold">{title}</p>}
    <div>{children}</div>
    {/*
      Surfacing the requestId lets a user quote one string to support, and lets
      an engineer find the exact correlated server log line immediately. This is
      the payoff of threading a request id through the whole stack.
    */}
    {requestId && <p className="mt-1.5 font-mono text-[11px] opacity-70">Reference: {requestId}</p>}
  </div>
);
