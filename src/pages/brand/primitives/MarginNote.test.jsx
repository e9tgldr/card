import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarginNote from './MarginNote';

describe('MarginNote', () => {
  it('renders the children inside an aside', () => {
    render(<MarginNote>1162—1227</MarginNote>);
    const note = screen.getByText('1162—1227');
    expect(note.tagName.toLowerCase()).toBe('aside');
  });

  it('uses the meta (mono) font and brass colour', () => {
    render(<MarginNote>note</MarginNote>);
    const note = screen.getByText('note');
    expect(note.className).toContain('font-meta');
    expect(note.className).toContain('text-brass');
  });
});
