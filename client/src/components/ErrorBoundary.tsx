import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State { error: Error | null }

/**
 * A render error in one widget must not blank the entire application.
 *
 * This has to be a class component: as of React 18 there is still no hook
 * equivalent of componentDidCatch, so a function component cannot catch render
 * errors from its children.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  public state: State = { error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    // In production this is where an error reporter (Sentry etc.) is called.
    console.error('Unhandled UI error', error, info.componentStack);
  }

  public render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          The page failed to render. Reloading usually fixes this.
        </p>
        <button className="btn-primary mt-6" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
