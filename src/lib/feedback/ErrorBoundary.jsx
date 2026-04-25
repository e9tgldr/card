import { Component } from 'react';
import { notify } from './Toast';

function DefaultFallback({ error, retry }) {
  return (
    <div role="alert" className="p-4 border border-red-500/30 bg-red-950/20 text-ivory rounded-md">
      <p className="font-prose mb-2">Something went wrong.</p>
      {error?.message && <p className="text-xs text-ivory/60 mb-3 font-mono">{error.message}</p>}
      <button onClick={retry} className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass hover:text-ivory">
        Retry
      </button>
    </div>
  );
}

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.retry = this.retry.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env?.DEV) {
      console.error('[ErrorBoundary caught]', error, info);
    }
    if (this.props.notify !== false) {
      notify.error(error, { fallbackKey: this.props.fallbackKey ?? 'toast.generic.unknownError' });
    }
  }

  retry() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      const Fallback = this.props.fallback ?? DefaultFallback;
      return <Fallback error={this.state.error} retry={this.retry} />;
    }
    return this.props.children;
  }
}
