import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockInvoke = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a) => mockInvoke(...a) } },
}));

vi.mock('@/lib/i18n', () => ({
  useLang: () => ({ t: (k) => k }),
}));

// Mock the duration probe so the upload happy-path doesn't need a real decoder.
vi.mock('@/lib/videoMeta', () => ({
  probeVideoDuration: vi.fn().mockResolvedValue(30),
}));

import BackVideos from '@/components/admin/BackVideos';

const FIGURES = [
  { fig_id: 1, name: 'Чингис Хаан', cat: 'khans', ico: '👑' },
  { fig_id: 2, name: 'Өгөдэй Хаан', cat: 'khans', ico: '👑' },
];

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('BackVideos', () => {
  it('renders all figures with empty status when no videos exist', async () => {
    render(<BackVideos figures={FIGURES} videosById={{}} />);
    expect(screen.getByText('Чингис Хаан')).toBeInTheDocument();
    expect(screen.getByText('Өгөдэй Хаан')).toBeInTheDocument();
    expect(screen.getAllByText('admin.backVideos.empty')).toHaveLength(2);
  });

  it('renders uploaded status with duration for figures that have videos', async () => {
    render(<BackVideos figures={FIGURES} videosById={{ 1: { url: 'https://x/b.mp4', captionsUrl: null, durationS: 42 } }} />);
    expect(screen.getByText(/0:42/)).toBeInTheDocument();
  });

  it('rejects an over-50-MB file client-side and does not call invoke', async () => {
    const onChange = vi.fn();
    render(<BackVideos figures={FIGURES} videosById={{}} onChange={onChange} />);

    const input = screen.getAllByTestId('video-file-input')[0];
    const big = new File([new Uint8Array(60 * 1024 * 1024)], 'big.mp4', { type: 'video/mp4' });
    fireEvent.change(input, { target: { files: [big] } });

    await waitFor(() => {
      expect(screen.getByText(/admin\.backVideos\.tooBig/)).toBeInTheDocument();
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('rejects a non-VTT captions file', async () => {
    render(<BackVideos figures={FIGURES} videosById={{ 1: { url: 'https://x/b.mp4', captionsUrl: null, durationS: 30 } }} />);

    const input = screen.getByTestId('captions-file-input-1');
    const bad = new File(['just plain text'], 'bad.vtt', { type: 'text/plain' });
    Object.defineProperty(bad, 'text', { value: () => Promise.resolve('just plain text') });
    fireEvent.change(input, { target: { files: [bad] } });

    await waitFor(() => {
      expect(screen.getByText(/admin\.backVideos\.notVtt/)).toBeInTheDocument();
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('successful upload invokes the edge function', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, public_url: 'https://x/b.mp4' }, error: null });

    const onChange = vi.fn();
    render(<BackVideos figures={FIGURES} videosById={{}} onChange={onChange} />);

    const input = screen.getAllByTestId('video-file-input')[0];
    const small = new File([new Uint8Array(1024)], 'ok.mp4', { type: 'video/mp4' });
    fireEvent.change(input, { target: { files: [small] } });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('upload-figure-back-video', expect.objectContaining({
        body: expect.any(FormData),
      }));
    });
    expect(onChange).toHaveBeenCalled();
  });

  it('delete confirms then invokes with action=delete', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    window.confirm = vi.fn(() => true);

    const onChange = vi.fn();
    render(<BackVideos figures={FIGURES} videosById={{ 1: { url: 'https://x/b.mp4', captionsUrl: null, durationS: 30 } }} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /admin\.backVideos\.delete/ }));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith('upload-figure-back-video', expect.objectContaining({
        body: expect.objectContaining({ action: 'delete', fig_id: 1 }),
      }));
    });
  });
});
