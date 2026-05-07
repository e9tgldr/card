import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useNarration } from '@/hooks/useNarration';

const mockInvoke = vi.fn();
vi.mock('@/lib/supabase', () => ({
  supabase: { functions: { invoke: (...args) => mockInvoke(...args) } },
}));

beforeEach(() => {
  mockInvoke.mockReset();
  // Stub Web Speech API so the TTS branch doesn't crash on jsdom.
  if (!('speechSynthesis' in window)) {
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [],
        speak: vi.fn(),
        cancel: vi.fn(),
        pause: vi.fn(),
        resume: vi.fn(),
      },
      configurable: true,
    });
  }
  if (!('SpeechSynthesisUtterance' in window)) {
    window.SpeechSynthesisUtterance = class {
      constructor(text) { this.text = text; }
    };
  }
});

describe('useNarration cascade', () => {
  it('uses provided audioUrl directly without invoking speak', async () => {
    const { result } = renderHook(() =>
      useNarration({ text: 'hi', audioUrl: 'https://cdn/example.mp3', lang: 'mn' }),
    );
    await waitFor(() => expect(result.current.mode).toBe('audio'));
    expect(result.current.source).toBe('provided');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('resolves to audio when useSpeak returns a synth url', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, url: 'https://cdn/synth.mp3', source: 'synth' },
      error: null,
    });
    const { result } = renderHook(() =>
      useNarration({ text: 'hi', useSpeak: true, lang: 'mn' }),
    );
    await waitFor(() => expect(result.current.mode).toBe('audio'));
    expect(result.current.source).toBe('synth');
    expect(mockInvoke).toHaveBeenCalledWith('speak', {
      body: { text: 'hi', lang: 'mn' },
    });
  });

  it('falls back to TTS mode when speak returns no url', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: false, source: 'fallback', reason: 'no_key' },
      error: null,
    });
    const { result } = renderHook(() =>
      useNarration({ text: 'hi', useSpeak: true, lang: 'mn' }),
    );
    await waitFor(() => expect(result.current.mode).toBe('tts'));
    expect(result.current.source).toBe('tts');
  });

  it('retries speak without voice_id when the per-figure voice fails', async () => {
    mockInvoke
      .mockResolvedValueOnce({ data: { ok: false, source: 'fallback' }, error: null })
      .mockResolvedValueOnce({
        data: { ok: true, url: 'https://cdn/default.mp3', source: 'cache' },
        error: null,
      });
    const { result } = renderHook(() =>
      useNarration({ text: 'hi', useSpeak: true, voiceId: 'vid_X', lang: 'mn' }),
    );
    await waitFor(() => expect(result.current.mode).toBe('audio'));
    expect(result.current.source).toBe('cache');
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'speak', {
      body: { text: 'hi', lang: 'mn', voice_id: 'vid_X' },
    });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'speak', {
      body: { text: 'hi', lang: 'mn' },
    });
  });

  it('skips speak entirely when useSpeak is false', async () => {
    const { result } = renderHook(() =>
      useNarration({ text: 'hi', useSpeak: false, lang: 'mn' }),
    );
    await waitFor(() => expect(result.current.source).toBe('tts'));
    expect(result.current.mode).toBe('tts');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('treats an invoke error as fallback to TTS', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new Error('network') });
    const { result } = renderHook(() =>
      useNarration({ text: 'hi', useSpeak: true, lang: 'cn' }),
    );
    await waitFor(() => expect(result.current.mode).toBe('tts'));
    expect(result.current.source).toBe('tts');
  });
});
