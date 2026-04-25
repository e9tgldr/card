import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AsyncStatus } from '../AsyncStatus';
import { LangProvider } from '@/lib/i18n';

const wrap = (ui) => <LangProvider>{ui}</LangProvider>;

describe('AsyncStatus', () => {
  it('renders children when not loading, not errored, not empty', () => {
    render(wrap(
      <AsyncStatus loading={false} error={null} empty={false}>
        <div>content</div>
      </AsyncStatus>,
    ));
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('renders loadingFallback when loading=true', () => {
    render(wrap(
      <AsyncStatus loading={true} loadingFallback={<div>spinner</div>}>
        <div>content</div>
      </AsyncStatus>,
    ));
    expect(screen.getByText('spinner')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('renders errorFallback with retry when error present', () => {
    const retry = vi.fn();
    render(wrap(
      <AsyncStatus loading={false} error={new Error('boom')} retry={retry}>
        <div>content</div>
      </AsyncStatus>,
    ));
    fireEvent.click(screen.getByRole('button', { name: /retry|дахин/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('renders emptyFallback when empty=true and no loading/error', () => {
    render(wrap(
      <AsyncStatus loading={false} error={null} empty={true} emptyFallback={<div>empty</div>}>
        <div>content</div>
      </AsyncStatus>,
    ));
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('precedence: loading > error > empty > children', () => {
    const { rerender } = render(wrap(
      <AsyncStatus
        loading={true} error={new Error('e')} empty={true}
        loadingFallback={<div>L</div>}
        errorFallback={<div>E</div>}
        emptyFallback={<div>Em</div>}
      ><div>C</div></AsyncStatus>,
    ));
    expect(screen.getByText('L')).toBeInTheDocument();
    rerender(wrap(
      <AsyncStatus
        loading={false} error={new Error('e')} empty={true}
        loadingFallback={<div>L</div>}
        errorFallback={<div>E</div>}
        emptyFallback={<div>Em</div>}
      ><div>C</div></AsyncStatus>,
    ));
    expect(screen.getByText('E')).toBeInTheDocument();
    rerender(wrap(
      <AsyncStatus
        loading={false} error={null} empty={true}
        loadingFallback={<div>L</div>}
        errorFallback={<div>E</div>}
        emptyFallback={<div>Em</div>}
      ><div>C</div></AsyncStatus>,
    ));
    expect(screen.getByText('Em')).toBeInTheDocument();
  });

  it('uses default Skeleton.Card when no loadingFallback provided', () => {
    const { container } = render(wrap(
      <AsyncStatus loading={true}><div>C</div></AsyncStatus>,
    ));
    expect(container.querySelector('[data-skeleton-cell]')).toBeInTheDocument();
  });
});
