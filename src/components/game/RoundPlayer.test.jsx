import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RoundPlayer from '@/components/game/RoundPlayer';

vi.mock('@/lib/i18n', async () => {
  const actual = await vi.importActual('@/lib/i18n');
  return { ...actual, useLang: () => ({ t: (k) => k, lang: 'en' }) };
});

const FIGURES = [
  { fig_id: 1, cat: 'khans', name: 'Chinggis' },
  { fig_id: 3, cat: 'khans', name: 'Kublai' },
  { fig_id: 17, cat: 'queens', name: 'Alan Gua' },
  { fig_id: 34, cat: 'warriors', name: 'Sukhbaatar' },
];
const mockQuestion = {
  figId: 1,
  quote: 'Би тэнгэрийн шийтгэл.',
  qattr: 'Чингис Хаан',
  optionFigIds: [3, 1, 34, 17],
};

beforeEach(() => { vi.clearAllMocks(); });

describe('RoundPlayer', () => {
  it('renders the quote and 4 option buttons', () => {
    render(<RoundPlayer question={mockQuestion} figures={FIGURES} picked={null} onPick={() => {}} />);
    expect(screen.getByText(/Би тэнгэрийн шийтгэл/)).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('calls onPick with figId when option clicked', () => {
    const onPick = vi.fn();
    render(<RoundPlayer question={mockQuestion} figures={FIGURES} picked={null} onPick={onPick} />);
    fireEvent.click(screen.getByText('Chinggis'));
    expect(onPick).toHaveBeenCalledWith(1);
  });

  it('disables buttons once picked is non-null', () => {
    render(<RoundPlayer question={mockQuestion} figures={FIGURES} picked={3} onPick={() => {}} />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toBeDisabled();
    }
  });

  it('highlights correct option when revealed', () => {
    render(<RoundPlayer question={mockQuestion} figures={FIGURES} picked={3} onPick={() => {}} revealed correctFigId={1} />);
    const correctBtn = screen.getByText('Chinggis').closest('button');
    expect(correctBtn.className).toMatch(/green/);
  });
});
