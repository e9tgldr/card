import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

function Boom({ shouldThrow }) {
  if (shouldThrow) throw new Error('boom');
  return <div>healthy</div>;
}

describe('ErrorBoundary', () => {
  let consoleSpy;
  beforeEach(() => { consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => { consoleSpy.mockRestore(); cleanup(); });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary fallback={() => <div>fallback</div>}>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('renders fallback when child throws', () => {
    render(
      <ErrorBoundary fallback={({ error }) => <div>caught: {error.message}</div>}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('caught: boom')).toBeInTheDocument();
  });

  it('retry resets error state and re-renders children', () => {
    function ToggleableBoom() {
      const [throws, setThrows] = useState(true);
      if (throws) throw new Error('first');
      return <button onClick={() => setThrows(true)}>healthy</button>;
    }
    // Outer state: only switch to non-throw after retry click
    let allowRecover = false;
    function Wrapper() {
      const [, force] = useState(0);
      // when retry fires we expect a re-render of children
      return (
        <ErrorBoundary
          fallback={({ retry }) => (
            <button onClick={() => { allowRecover = true; force((n) => n + 1); retry(); }}>
              retry-btn
            </button>
          )}
        >
          {allowRecover ? <div>recovered</div> : <Boom shouldThrow={true} />}
        </ErrorBoundary>
      );
    }
    render(<Wrapper />);
    expect(screen.getByText('retry-btn')).toBeInTheDocument();
    fireEvent.click(screen.getByText('retry-btn'));
    expect(screen.getByText('recovered')).toBeInTheDocument();
    // unused
    void ToggleableBoom;
  });

  it('logs to console.error in dev', () => {
    render(
      <ErrorBoundary fallback={() => <div>fb</div>} notify={false}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('uses default fallback if none provided', () => {
    render(
      <ErrorBoundary notify={false}>
        <Boom shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
