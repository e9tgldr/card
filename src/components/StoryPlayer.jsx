import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Play, Pause, Square, Volume2 } from 'lucide-react';
import { useLang, storyText } from '@/lib/i18n';
import CornerTicks from '@/components/ornaments/CornerTicks';

/**
 * StoryPlayer — narrate a figure's story.
 *
 * Source priority:
 *   1. Pre-recorded audio file (figure.story_audio / story_audio_en) — plays via <audio>
 *   2. Browser SpeechSynthesis on the composed/authored story text
 *
 * Props
 *   figure    — figure record (required)
 *   variant   — 'block' (full editorial plate) or 'button' (compact pill, for Card3D)
 *   autoPlay  — begin playback on mount
 *   onDone    — optional callback when playback finishes
 */
export default function StoryPlayer({ figure, variant = 'block', autoPlay = false, onDone }) {
  const { lang } = useLang();
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [status, setStatus] = useState('idle'); // 'idle' | 'playing' | 'paused' | 'done'
  const [progress, setProgress] = useState(0);  // 0..1
  const audioRef = useRef(null);
  const utterRef = useRef(null);
  const lenRef = useRef(0);

  const audioUrl = lang === 'en' ? figure?.story_audio_en : figure?.story_audio;
  const text = useMemo(() => storyText(figure, lang), [figure, lang]);
  const mode = audioUrl ? 'audio' : 'tts';
  const canPlay = mode === 'audio' || (ttsSupported && !!text);

  // ───── Voice picker (TTS only) ─────────────────────────────────────────
  const pickVoice = useCallback(() => {
    if (!ttsSupported) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const code = lang === 'en' ? 'en' : 'mn';
    const exact = voices.find(v => v.lang?.toLowerCase().startsWith(code));
    if (exact) return exact;
    if (code === 'en') return voices.find(v => v.lang?.toLowerCase().includes('en')) || voices[0] || null;
    return voices[0] || null;
  }, [lang, ttsSupported]);

  useEffect(() => {
    if (!ttsSupported) return;
    const s = window.speechSynthesis;
    if (s.getVoices().length === 0 && typeof s.onvoiceschanged !== 'undefined') {
      const handler = () => {};
      s.addEventListener('voiceschanged', handler);
      return () => s.removeEventListener('voiceschanged', handler);
    }
  }, [ttsSupported]);

  // ───── Playback control ────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (ttsSupported) window.speechSynthesis.cancel();
    setStatus('idle');
    setProgress(0);
    utterRef.current = null;
  }, [ttsSupported]);

  const play = useCallback(() => {
    if (mode === 'audio') {
      if (!audioRef.current) return;
      audioRef.current.play().catch(() => setStatus('idle'));
      return;
    }
    // TTS path
    if (!ttsSupported || !text) return;
    if (status === 'paused') {
      window.speechSynthesis.resume();
      setStatus('playing');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new window.SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = lang === 'en' ? 'en-US' : 'mn-MN';
    u.rate = 0.96;
    u.pitch = 1.0;
    u.volume = 1.0;
    lenRef.current = text.length || 1;
    u.onstart = () => setStatus('playing');
    u.onend = () => {
      setStatus('done');
      setProgress(1);
      utterRef.current = null;
      if (onDone) onDone();
    };
    u.onerror = () => {
      setStatus('idle');
      utterRef.current = null;
    };
    u.onboundary = (ev) => {
      if (ev && typeof ev.charIndex === 'number' && lenRef.current > 0) {
        setProgress(Math.max(0, Math.min(1, ev.charIndex / lenRef.current)));
      }
    };
    utterRef.current = u;
    window.speechSynthesis.speak(u);
  }, [mode, ttsSupported, text, status, pickVoice, lang, onDone]);

  const pause = useCallback(() => {
    if (mode === 'audio') {
      audioRef.current?.pause();
      return;
    }
    if (ttsSupported) {
      window.speechSynthesis.pause();
      setStatus('paused');
    }
  }, [mode, ttsSupported]);

  // Auto-play / cleanup on figure change
  useEffect(() => {
    if (autoPlay) play();
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
      if (audioRef.current) audioRef.current.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [figure?.fig_id]);

  // Stop on locale change (voice/audio source becomes stale)
  useEffect(() => {
    stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ───── HTML <audio> element handlers ───────────────────────────────────
  useEffect(() => {
    if (mode !== 'audio' || !audioRef.current) return;
    const el = audioRef.current;
    const onPlay = () => setStatus('playing');
    const onPause = () => setStatus(prev => (prev === 'done' ? 'done' : 'paused'));
    const onEnded = () => {
      setStatus('done');
      setProgress(1);
      if (onDone) onDone();
    };
    const onTime = () => {
      if (el.duration && isFinite(el.duration)) {
        setProgress(Math.max(0, Math.min(1, el.currentTime / el.duration)));
      }
    };
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    el.addEventListener('timeupdate', onTime);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('timeupdate', onTime);
    };
  }, [mode, audioUrl, onDone]);

  if (!canPlay) return null;

  // ───── Compact "button" variant — used inside Card3D controls ──────────
  if (variant === 'button') {
    const isPlaying = status === 'playing';
    return (
      <>
        {mode === 'audio' && (
          <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
        )}
        <button
          onClick={() => (isPlaying ? pause() : play())}
          title={
            mode === 'audio'
              ? (lang === 'en' ? 'Listen to recording' : 'Бичлэг сонсох')
              : (ttsSupported
                  ? (lang === 'en' ? 'Listen to the story' : 'Түүхийг сонсох')
                  : (lang === 'en' ? 'Speech not supported' : 'Яригч дэмжигдэхгүй'))
          }
          className="px-3 py-1.5 bg-gold/90 hover:bg-gold text-background rounded-full text-xs font-body inline-flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {isPlaying
            ? (lang === 'en' ? 'Pause' : 'Зогсоох')
            : (mode === 'audio'
                ? (lang === 'en' ? 'Listen' : 'Сонсох')
                : (lang === 'en' ? 'Story' : 'Түүх'))}
        </button>
      </>
    );
  }

  // ───── Full editorial "block" — used on FigureDetail ───────────────────
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const pct = Math.round(progress * 100);

  return (
    <section className="relative bg-ink/50 border border-brass/35 overflow-hidden">
      <CornerTicks size={12} inset={6} thickness={1} opacity={0.9} />

      {mode === 'audio' && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
      )}

      <div className="flex items-center gap-5 px-5 py-4 md:px-6 md:py-5">
        {/* Seal-style play / pause */}
        <button
          onClick={() => (isPlaying ? pause() : play())}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="relative flex-shrink-0 w-14 h-14 rounded-full border-2 border-brass hover:border-ivory text-brass hover:text-ivory flex items-center justify-center transition-colors group"
          style={{ background: 'radial-gradient(circle, hsl(var(--seal)/0.3) 0%, transparent 70%)' }}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-[1px]" />}
          {isPlaying && (
            <span className="absolute inset-0 rounded-full border-2 border-brass/40 animate-ping pointer-events-none" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-meta text-[9px] tracking-[0.32em] uppercase text-brass/80">
                {lang === 'en' ? 'Narration' : 'Түүхэн Яриа'}
              </span>
              <span className="font-meta text-[9px] tracking-[0.22em] text-brass/55">
                {mode === 'audio'
                  ? (lang === 'en' ? '• Recorded voice' : '• Бичсэн яриа')
                  : (lang === 'en' ? '• Click to listen' : '• Дарж сонс')}
              </span>
            </div>
            {status !== 'idle' && (
              <span className="font-meta text-[9px] tracking-[0.22em] text-ivory/60">
                {isPaused ? (lang === 'en' ? 'PAUSED' : 'ТҮР ЗОГССОН') : `${pct}%`}
              </span>
            )}
          </div>

          {mode === 'tts' && (
            <div
              className="font-display text-[17px] md:text-[19px] text-ivory/90 mt-1 line-clamp-2"
              style={{ fontVariationSettings: '"opsz" 40, "SOFT" 50' }}
            >
              {text}
            </div>
          )}
          {mode === 'audio' && (
            <div
              className="font-display text-[15px] text-ivory/70 italic mt-1"
              style={{ fontVariationSettings: '"opsz" 30, "SOFT" 50' }}
            >
              {lang === 'en' ? 'Listen to the storyteller’s voice' : 'Үлгэрчийн яриаг сонсоорой'}
            </div>
          )}

          {/* Brass progress hairline */}
          <div className="mt-3 h-[2px] bg-brass/15 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-seal to-brass transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {status !== 'idle' && (
          <button
            onClick={stop}
            aria-label="Stop"
            className="hidden sm:inline-flex flex-shrink-0 w-10 h-10 items-center justify-center border border-brass/40 hover:border-brass text-brass/80 hover:text-ivory transition-colors"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {mode === 'tts' && !ttsSupported && (
        <p className="font-meta text-[10px] tracking-[0.22em] uppercase text-brass/60 px-5 pb-3">
          {lang === 'en'
            ? 'Speech synthesis is not available in this browser.'
            : 'Энэ хөтөч дээр текст-яригч идэвхгүй байна.'}
        </p>
      )}
    </section>
  );
}
