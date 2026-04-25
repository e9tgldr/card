import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../EmptyState';
import { LangProvider, STRINGS } from '@/lib/i18n';

const wrap = (ui) => <LangProvider>{ui}</LangProvider>;

describe('EmptyState', () => {
  it('renders title and description as raw strings', () => {
    render(wrap(<EmptyState title="No data" description="Try later." />));
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Try later.')).toBeInTheDocument();
  });

  it('resolves i18n keys for title and description', () => {
    render(wrap(<EmptyState title="empty.collection.title" description="empty.collection.description" />));
    expect(screen.getByText(STRINGS['empty.collection.title'].mn)).toBeInTheDocument();
    expect(screen.getByText(STRINGS['empty.collection.description'].mn)).toBeInTheDocument();
  });

  it('renders icon and action when provided', () => {
    render(wrap(
      <EmptyState
        icon={<span data-testid="ico" />}
        title="t"
        action={<button>do it</button>}
      />,
    ));
    expect(screen.getByTestId('ico')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'do it' })).toBeInTheDocument();
  });

  it('omits action when not provided', () => {
    render(wrap(<EmptyState title="t" />));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
