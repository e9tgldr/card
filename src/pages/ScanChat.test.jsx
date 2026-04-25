import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ScanChat from './ScanChat';

const { useFigureChatMock } = vi.hoisted(() => ({
  useFigureChatMock: vi.fn(),
}));
vi.mock('@/hooks/useFigureChat', () => ({ useFigureChat: useFigureChatMock }));

const renderAt = (figId = '1') => render(
  <MemoryRouter initialEntries={[`/c/${figId}`]}>
    <Routes>
      <Route path="/c/:figId" element={<ScanChat />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  useFigureChatMock.mockReset();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ScanChat', () => {
  it('renders AI-thinking indicator when busy', () => {
    useFigureChatMock.mockReturnValue({
      messages: [], lang: 'mn', busy: true, send: vi.fn(), switchLang: vi.fn(),
    });
    renderAt();
    expect(screen.getByText(/бодож/i)).toBeInTheDocument();
  });

  it('language toggle buttons have aria-labels', () => {
    useFigureChatMock.mockReturnValue({
      messages: [], lang: 'mn', busy: false, send: vi.fn(), switchLang: vi.fn(),
    });
    renderAt();
    const langButtons = screen.getAllByRole('button').filter((b) => /Монгол|English|中文/.test(b.textContent));
    expect(langButtons.length).toBe(3);
    langButtons.forEach((b) => {
      expect(b).toHaveAttribute('aria-label');
      expect(b.getAttribute('aria-label').length).toBeGreaterThan(0);
    });
  });

  it('scrollIntoView called on new message', async () => {
    useFigureChatMock.mockReturnValue({
      messages: [{ role: 'user', text: 'hi' }],
      lang: 'mn', busy: false, send: vi.fn(), switchLang: vi.fn(),
    });
    renderAt();
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  it('sign-up banner shows new copy explaining why', () => {
    useFigureChatMock.mockReturnValue({
      messages: [], lang: 'mn', busy: false, send: vi.fn(), switchLang: vi.fn(),
    });
    renderAt();
    expect(screen.getByText(/түүх|төхөөрөмж/)).toBeInTheDocument();
  });
});
