import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LangProvider } from '@/lib/i18n';

vi.mock('qrcode', () => ({
  default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,QR') },
}));

import DesktopFallback from '@/components/ar/DesktopFallback';

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { origin: 'https://altan-domog.example' },
    writable: true,
  });
  navigator.clipboard = { writeText: vi.fn().mockResolvedValue() };
});

describe('DesktopFallback', () => {
  it('renders QR encoding /ar/:figId on this origin', async () => {
    render(
      <LangProvider>
        <DesktopFallback figId={7} figureName="Чингис Хаан" />
      </LangProvider>,
    );
    const qrcode = await import('qrcode');
    await waitFor(() =>
      expect(qrcode.default.toDataURL).toHaveBeenCalledWith(
        'https://altan-domog.example/ar/7',
        expect.any(Object),
      ),
    );
    expect(screen.getByText('https://altan-domog.example/ar/7')).toBeInTheDocument();
  });

  it('copies link to clipboard on click', async () => {
    render(
      <LangProvider>
        <DesktopFallback figId={7} figureName="Чингис Хаан" />
      </LangProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /Хуулах|Copy/i }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'https://altan-domog.example/ar/7',
      ),
    );
  });
});
