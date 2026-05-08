import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PullQuote from './PullQuote';

describe('PullQuote', () => {
  it('renders the quote text inside a blockquote', () => {
    render(<PullQuote text="Түүхийг бид мартахгүй байж л өвлөнө." attribution="— Founder" />);
    expect(screen.getByText(/Түүхийг бид мартахгүй/)).toBeTruthy();
    const bq = screen.getByText(/Түүхийг бид мартахгүй/).closest('blockquote');
    expect(bq).toBeTruthy();
  });

  it('renders the attribution', () => {
    render(<PullQuote text="X" attribution="— Founder" />);
    expect(screen.getByText('— Founder')).toBeTruthy();
  });

  it('omits attribution when none is supplied', () => {
    render(<PullQuote text="X" />);
    expect(screen.queryByText(/—/)).toBeNull();
  });
});
