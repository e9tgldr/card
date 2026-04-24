# Story Phase A — Chapter Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the chapter-based Story player (`/story/:chapter`) with inline + fullscreen modes, Ken-Burns portrait + map visual layer, persistent controls, session-only resume, keyboard shortcuts, and an entry-point CTA in the existing `ChaptersSection`. All narration stays on browser TTS for Phase A — Phases B and C extend this without revisiting structure.

**Architecture:** A single `StoryChapter.jsx` page owns playlist + playback state; visual components under `src/components/story/` are pure props-in, JSX-out; narration is handled by a new `useNarration` hook extracted from the existing `StoryPlayer.jsx` so Phase B can swap its audio source in one place. Era intros reuse the already-existing `era.intro` / `era.intro_en` fields on `ERAS`.

**Tech stack:** React 18 + Vite + React Router v6 + framer-motion (already installed) + react-leaflet (already installed) + Vitest + Testing Library (already installed). No new npm dependencies.

---

## Spec

See `docs/superpowers/specs/2026-04-24-story-phase-a-chapter-player-design.md`.

## File Structure

### New files
- `src/lib/storyPlaylist.js` — pure `buildChapterPlaylist` function, `ACTS` constant, `nextEra` helper.
- `src/hooks/useNarration.js` — TTS/audio engine extracted from `StoryPlayer.jsx`.
- `src/components/story/Subtitles.jsx` — subtitle card chunking + fade.
- `src/components/story/KenBurnsPortrait.jsx` — framer-motion pan/zoom.
- `src/components/story/StoryMapPanel.jsx` — minimal react-leaflet map with focus prop.
- `src/components/story/StoryControls.jsx` — persistent control bar.
- `src/components/story/StoryStage.jsx` — composes portrait + map + subtitles.
- `src/components/story/StoryEnding.jsx` — chapter-complete card.
- `src/pages/StoryChapter.jsx` — route page, playback owner.
- `src/lib/storyPlaylist.test.js`
- `src/components/story/Subtitles.test.jsx`
- `src/pages/StoryChapter.test.jsx`

### Modified files
- `src/App.jsx` — register `/story/:chapter` and a redirect for bare `/story`.
- `src/components/ChaptersSection.jsx` — add "Play this chapter" CTA per era.
- `src/lib/mapData.js` — add `FIGURE_GEO` and `ERA_GEO_DEFAULT`.
- `src/lib/i18n.jsx` — add `story.*` and `chapters.play` keys.
- `src/components/StoryPlayer.jsx` — refactor to delegate to `useNarration`.

---

## Task 1: Add i18n keys for the Story player

**Files:** Modify `src/lib/i18n.jsx`

- [ ] **Step 1: Insert new i18n keys**

Open `src/lib/i18n.jsx`. Find the `live.abandoned` line (near the end of the STRINGS object) and insert below it, before the closing `};`:

```js
  // Story Phase A
  'story.play':             { mn: 'Эхлүүлэх',              en: 'Play' },
  'story.pause':            { mn: 'Түр зогсоох',           en: 'Pause' },
  'story.prev':             { mn: 'Өмнөх',                 en: 'Previous' },
  'story.next':             { mn: 'Дараагийн',             en: 'Next' },
  'story.fullscreen':       { mn: 'Дэлгэц дүүрэн',         en: 'Fullscreen' },
  'story.exitFullscreen':   { mn: 'Дэлгэц буцаах',         en: 'Exit fullscreen' },
  'story.chapter':          { mn: 'Бүлэг',                 en: 'Chapter' },
  'story.slideOf':          { mn: '{n} / {total}',         en: '{n} / {total}' },
  'story.intro.label':      { mn: 'Эхлэл',                 en: 'Prologue' },
  'story.outro.label':      { mn: 'Төгсгөл',               en: 'Epilogue' },
  'story.ending.title':     { mn: 'Бүлэг дуусав',          en: 'Chapter complete' },
  'story.ending.continue':  { mn: 'Үргэлжлүүлэх',          en: 'Continue' },
  'story.ending.done':      { mn: 'Кодекс дуусав. Баярлалаа.', en: 'The codex is complete. Thank you.' },
  'story.empty':            { mn: 'Бүлэг хоосон байна.',   en: 'This chapter is empty.' },
  'story.notFound':         { mn: 'Бүлэг олдсонгүй.',      en: 'Chapter not found.' },
  'chapters.play':          { mn: 'Энэ бүлгийн түүхийг үзэх', en: 'Play this chapter' },
```

- [ ] **Step 2: Commit**

```
git add src/lib/i18n.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "i18n: add Story Phase A strings (mn/en)"
```

---

## Task 2: Add figure geography to `mapData.js`

**Files:** Modify `src/lib/mapData.js`

- [ ] **Step 1: Append FIGURE_GEO and ERA_GEO_DEFAULT**

Open `src/lib/mapData.js` and append at the end:

```js
// Approximate {lat, lng, zoom} per figure for the Story map panel.
export const FIGURE_GEO = {
  1:  { lat: 47.92, lng: 106.92, zoom: 5 }, // Chinggis
  5:  { lat: 47.92, lng: 106.92, zoom: 5 }, // Tolui
  10: { lat: 47.92, lng: 106.92, zoom: 5 }, // Jochi
  9:  { lat: 43.25, lng:  76.95, zoom: 4 }, // Chagatai
  14: { lat: 47.92, lng: 106.92, zoom: 5 }, // Borte
  17: { lat: 47.92, lng: 106.92, zoom: 5 }, // Alan Gua
  21: { lat: 47.92, lng: 106.92, zoom: 5 }, // Oelun
  2:  { lat: 47.20, lng: 102.85, zoom: 5 }, // Ogedei — Karakorum
  6:  { lat: 47.20, lng: 102.85, zoom: 5 }, // Guyuk
  4:  { lat: 47.20, lng: 102.85, zoom: 5 }, // Mongke
  8:  { lat: 48.70, lng:  44.50, zoom: 4 }, // Batu — Sarai
  19: { lat: 47.20, lng: 102.85, zoom: 5 }, // Toregene
  15: { lat: 47.20, lng: 102.85, zoom: 5 }, // Sorkhaghtani
  3:  { lat: 39.90, lng: 116.40, zoom: 4 }, // Kublai — Dadu
  7:  { lat: 37.40, lng:  46.20, zoom: 4 }, // Hulagu — Maragheh
  11: { lat: 41.30, lng:  76.40, zoom: 4 }, // Qaidu
  18: { lat: 41.30, lng:  76.40, zoom: 4 }, // Khutulun
  20: { lat: 39.90, lng: 116.40, zoom: 4 }, // Chabi
  12: { lat: 46.80, lng: 105.00, zoom: 5 }, // Dayan Khan
  16: { lat: 46.80, lng: 105.00, zoom: 5 }, // Mandukhai
  22: { lat: 47.92, lng: 106.92, zoom: 5 }, // Yesui
  24: { lat: 41.80, lng: 123.40, zoom: 4 }, // Abahai
  13: { lat: 47.92, lng: 106.92, zoom: 6 }, // Bogd Khan
};

// Fallback center per era when no FIGURE_GEO entry exists.
export const ERA_GEO_DEFAULT = {
  founding:  { lat: 47.92, lng: 106.92, zoom: 4 },
  expansion: { lat: 47.00, lng:  80.00, zoom: 3 },
  yuan:      { lat: 42.00, lng:  90.00, zoom: 3 },
  northern:  { lat: 46.80, lng: 105.00, zoom: 5 },
  qing:      { lat: 45.00, lng: 115.00, zoom: 4 },
  modern:    { lat: 47.92, lng: 106.92, zoom: 5 },
};
```

`resolveFocus()` lives in `StoryMapPanel.jsx` (Task 8) to keep `mapData.js` free of circular imports with `figuresData.js`.

- [ ] **Step 2: Commit**

```
git add src/lib/mapData.js
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): add FIGURE_GEO + ERA_GEO_DEFAULT for map panel"
```

---

## Task 3: `storyPlaylist.js` — playlist builder + tests

**Files:**
- Create `src/lib/storyPlaylist.js`
- Create `src/lib/storyPlaylist.test.js`

- [ ] **Step 1: Write the failing test first**

Create `src/lib/storyPlaylist.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { buildChapterPlaylist, nextEra, ACTS } from '@/lib/storyPlaylist';
import { ERA_KEYS } from '@/lib/figuresData';

describe('buildChapterPlaylist', () => {
  it('returns [intro, ...figures, outro] in fig_id order', () => {
    const pl = buildChapterPlaylist('founding');
    expect(pl[0].kind).toBe('intro');
    expect(pl[0].era).toBe('founding');
    expect(pl[pl.length - 1].kind).toBe('outro');
    const ids = pl.filter((s) => s.kind === 'figure').map((s) => s.figure.fig_id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('returns [intro, outro] for unknown era', () => {
    const pl = buildChapterPlaylist('__nope__');
    expect(pl).toHaveLength(2);
    expect(pl[0].kind).toBe('intro');
    expect(pl[1].kind).toBe('outro');
  });

  it('applies act labels from ACTS when present', () => {
    const pl = buildChapterPlaylist('founding');
    const chinggis = pl.find((s) => s.kind === 'figure' && s.figure.fig_id === 1);
    expect(chinggis.act).toBeTruthy();
  });
});

describe('nextEra', () => {
  it('returns the next era key', () => {
    expect(nextEra('founding')).toBe('expansion');
  });
  it('returns null past the last era', () => {
    expect(nextEra(ERA_KEYS[ERA_KEYS.length - 1])).toBeNull();
  });
});

describe('ACTS', () => {
  it('has an entry for each era key', () => {
    for (const key of ERA_KEYS) expect(ACTS[key]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test — expect fail**

```
npm run test -- --run src/lib/storyPlaylist.test.js
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/storyPlaylist.js`**

```js
import { FIGURES, ERA_KEYS, getEra } from '@/lib/figuresData';

export const ACTS = {
  founding: {
    1:  'Нэгтгэгч', 5:  'Нэгтгэгч', 10: 'Нэгтгэгч', 14: 'Нэгтгэгч',
    17: 'Домгийн эх', 21: 'Домгийн эх', 9:  'Дайчлал',
  },
  expansion: {
    2:  'Хархорум', 6:  'Хархорум', 4:  'Хархорум',
    8:  'Алтан орд', 19: 'Хатдын засаг', 15: 'Хатдын засаг',
  },
  yuan: {
    3:  'Дадугийн хаан', 20: 'Дадугийн хаан',
    7:  'Багдадын уналт', 11: 'Төв Ази', 18: 'Төв Ази',
  },
  northern: { 12: 'Сэргэн мандалт', 16: 'Сэргэн мандалт' },
  qing:     { 22: 'Манж холбоо', 24: 'Манж холбоо' },
  modern:   { 13: 'Тусгаар тогтнол' },
};

export function buildChapterPlaylist(chapterKey) {
  const figures = FIGURES
    .filter((f) => getEra(f) === chapterKey)
    .sort((a, b) => a.fig_id - b.fig_id);
  const acts = ACTS[chapterKey] ?? {};
  const figureSlides = figures.map((f) => ({
    kind: 'figure',
    figure: f,
    act: acts[f.fig_id],
  }));
  return [
    { kind: 'intro', era: chapterKey },
    ...figureSlides,
    { kind: 'outro', era: chapterKey },
  ];
}

export function nextEra(chapterKey) {
  const idx = ERA_KEYS.indexOf(chapterKey);
  if (idx < 0 || idx >= ERA_KEYS.length - 1) return null;
  return ERA_KEYS[idx + 1];
}
```

- [ ] **Step 4: Run test — expect pass**

```
npm run test -- --run src/lib/storyPlaylist.test.js
```

- [ ] **Step 5: Commit**

```
git add src/lib/storyPlaylist.js src/lib/storyPlaylist.test.js
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): buildChapterPlaylist + ACTS labels"
```

---

## Task 4: Extract `useNarration` hook

**Files:** Create `src/hooks/useNarration.js`

- [ ] **Step 1: Create the hook file**

```js
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export function useNarration({ text, audioUrl, lang = 'mn', autoPlay = false, onDone } = {}) {
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const audioRef = useRef(null);
  const utterRef = useRef(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const mode = audioUrl ? 'audio' : 'tts';

  const pickVoice = useCallback(() => {
    if (!ttsSupported) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const code = lang === 'en' ? 'en' : 'mn';
    return voices.find((v) => v.lang?.toLowerCase().startsWith(code))
        ?? voices.find((v) => v.lang?.toLowerCase().includes(code))
        ?? voices[0] ?? null;
  }, [lang, ttsSupported]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (ttsSupported) window.speechSynthesis.cancel();
    utterRef.current = null;
    setStatus('idle');
    setProgress(0);
    setCharIndex(0);
  }, [ttsSupported]);

  const play = useCallback(() => {
    if (mode === 'audio') {
      audioRef.current?.play().catch(() => setStatus('idle'));
      return;
    }
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
    u.onstart = () => setStatus('playing');
    u.onend = () => {
      setStatus('done');
      setProgress(1);
      utterRef.current = null;
      onDoneRef.current?.();
    };
    u.onerror = () => { setStatus('idle'); utterRef.current = null; };
    u.onboundary = (ev) => {
      if (typeof ev.charIndex === 'number' && text.length > 0) {
        setCharIndex(ev.charIndex);
        setProgress(Math.min(1, ev.charIndex / text.length));
      }
    };
    utterRef.current = u;
    window.speechSynthesis.speak(u);
  }, [mode, ttsSupported, text, status, pickVoice, lang]);

  const pause = useCallback(() => {
    if (mode === 'audio') { audioRef.current?.pause(); return; }
    if (ttsSupported) { window.speechSynthesis.pause(); setStatus('paused'); }
  }, [mode, ttsSupported]);

  useEffect(() => {
    stop();
    if (autoPlay) {
      const id = setTimeout(() => play(), 0);
      return () => clearTimeout(id);
    }
  }, [text, audioUrl, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== 'audio' || !audioRef.current) return;
    const el = audioRef.current;
    const onPlay = () => setStatus('playing');
    const onPause = () => setStatus((s) => (s === 'done' ? 'done' : 'paused'));
    const onEnded = () => { setStatus('done'); setProgress(1); onDoneRef.current?.(); };
    const onTime = () => {
      if (el.duration && isFinite(el.duration)) setProgress(Math.min(1, el.currentTime / el.duration));
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
  }, [mode, audioUrl]);

  const audioProps = useMemo(
    () => ({ ref: audioRef, src: audioUrl, preload: 'metadata', className: 'hidden' }),
    [audioUrl],
  );

  return { status, progress, charIndex, play, pause, stop, audioProps, mode };
}
```

- [ ] **Step 2: Commit**

```
git add src/hooks/useNarration.js
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): extract useNarration hook"
```

---

## Task 5: Refactor `StoryPlayer.jsx` to delegate to `useNarration`

**Files:** Modify `src/components/StoryPlayer.jsx`

- [ ] **Step 1: Replace the body of the file**

```jsx
import { useMemo } from 'react';
import { Play, Pause, Square, Volume2 } from 'lucide-react';
import { useLang, storyText } from '@/lib/i18n';
import { useNarration } from '@/hooks/useNarration';
import CornerTicks from '@/components/ornaments/CornerTicks';

export default function StoryPlayer({ figure, variant = 'block', autoPlay = false, onDone }) {
  const { lang } = useLang();
  const audioUrl = lang === 'en' ? figure?.story_audio_en : figure?.story_audio;
  const text = useMemo(() => storyText(figure, lang), [figure, lang]);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canPlay = Boolean(audioUrl) || (ttsSupported && text);

  const { status, progress, play, pause, stop, audioProps, mode } = useNarration({
    text, audioUrl, lang, autoPlay, onDone,
  });

  if (!canPlay) return null;
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const pct = Math.round(progress * 100);

  if (variant === 'button') {
    return (
      <>
        {mode === 'audio' && <audio {...audioProps} />}
        <button
          onClick={() => (isPlaying ? pause() : play())}
          title={mode === 'audio'
            ? (lang === 'en' ? 'Listen to recording' : 'Бичлэг сонсох')
            : (lang === 'en' ? 'Listen to the story' : 'Түүхийг сонсох')}
          className="px-3 py-1.5 bg-gold/90 hover:bg-gold text-background rounded-full text-xs font-body inline-flex items-center gap-1.5 transition-all"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          {isPlaying
            ? (lang === 'en' ? 'Pause' : 'Зогсоох')
            : mode === 'audio'
              ? (lang === 'en' ? 'Listen' : 'Сонсох')
              : (lang === 'en' ? 'Story' : 'Түүх')}
        </button>
      </>
    );
  }

  return (
    <section className="relative bg-ink/50 border border-brass/35 overflow-hidden">
      <CornerTicks size={12} inset={6} thickness={1} opacity={0.9} />
      {mode === 'audio' && <audio {...audioProps} />}
      <div className="flex items-center gap-5 px-5 py-4 md:px-6 md:py-5">
        <button
          onClick={() => (isPlaying ? pause() : play())}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className="relative flex-shrink-0 w-14 h-14 rounded-full border-2 border-brass hover:border-ivory text-brass hover:text-ivory flex items-center justify-center transition-colors"
          style={{ background: 'radial-gradient(circle, hsl(var(--seal)/0.3) 0%, transparent 70%)' }}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 translate-x-[1px]" />}
          {isPlaying && (
            <span className="absolute inset-0 rounded-full border-2 border-brass/40 animate-ping pointer-events-none" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-meta text-[9px] tracking-[0.32em] uppercase text-brass/80">
              {lang === 'en' ? 'Narration' : 'Түүхэн Яриа'}
            </span>
            {status !== 'idle' && (
              <span className="font-meta text-[9px] tracking-[0.22em] text-ivory/60">
                {isPaused ? (lang === 'en' ? 'PAUSED' : 'ТҮР ЗОГССОН') : `${pct}%`}
              </span>
            )}
          </div>
          <div className="font-display text-[17px] md:text-[19px] text-ivory/90 mt-1 line-clamp-2">
            {text}
          </div>
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
    </section>
  );
}
```

- [ ] **Step 2: Run the full test suite**

```
npm run test -- --run
```

Expected: all existing tests pass — the refactor must not break FigureDetail or StoryTour.

- [ ] **Step 3: Commit**

```
git add src/components/StoryPlayer.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "refactor(story): delegate StoryPlayer narration to useNarration"
```

---

## Task 6: `Subtitles` component + test

**Files:**
- Create `src/components/story/Subtitles.jsx`
- Create `src/components/story/Subtitles.test.jsx`

- [ ] **Step 1: Write the failing test first**

```jsx
// src/components/story/Subtitles.test.jsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Subtitles, { chunkText } from '@/components/story/Subtitles';

describe('chunkText', () => {
  it('splits on sentence boundaries', () => {
    const chunks = chunkText('First sentence. Second sentence. Third sentence.');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]).toMatch(/First sentence\./);
  });

  it('handles empty input', () => {
    expect(chunkText('')).toEqual([]);
  });
});

describe('Subtitles', () => {
  it('renders the first chunk at charIndex 0', () => {
    render(<Subtitles text="First sentence. Second sentence." charIndex={0} />);
    expect(screen.getByText(/First sentence/)).toBeInTheDocument();
  });

  it('advances to a later chunk as charIndex grows', () => {
    render(<Subtitles text="First sentence. Second sentence." charIndex={20} />);
    expect(screen.getByText(/Second sentence/)).toBeInTheDocument();
  });

  it('renders full text when static is true', () => {
    render(<Subtitles text="One sentence." charIndex={0} static />);
    expect(screen.getByText(/One sentence/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement `Subtitles.jsx`**

```jsx
import { useMemo } from 'react';

export function chunkText(text) {
  if (!text) return [];
  const out = [];
  const re = /[^.!?᠃]+[.!?᠃]*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const piece = m[0].trim();
    if (piece) out.push(piece);
  }
  return out;
}

export default function Subtitles({ text, charIndex = 0, static: isStatic = false, className = '' }) {
  const chunks = useMemo(() => chunkText(text), [text]);
  if (chunks.length === 0) return null;

  if (isStatic) {
    return (
      <p className={`font-display text-[17px] md:text-[19px] text-ivory/90 leading-relaxed ${className}`}>
        {text}
      </p>
    );
  }

  let cumulative = 0;
  let active = 0;
  for (let i = 0; i < chunks.length; i++) {
    cumulative += chunks[i].length + 1;
    if (charIndex < cumulative) { active = i; break; }
    active = Math.min(i + 1, chunks.length - 1);
  }

  return (
    <div className={`font-display text-[17px] md:text-[19px] text-ivory/90 leading-relaxed min-h-[3.5em] ${className}`}>
      <p key={active} className="animate-[fadein_400ms_ease-out]">
        {chunks[active]}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Run test, commit**

```
npm run test -- --run src/components/story/Subtitles.test.jsx
git add src/components/story/Subtitles.jsx src/components/story/Subtitles.test.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): Subtitles with sentence chunking"
```

---

## Task 7: `KenBurnsPortrait` component

**Files:** Create `src/components/story/KenBurnsPortrait.jsx`

- [ ] **Step 1: Write the component**

```jsx
import { motion, AnimatePresence } from 'framer-motion';

export default function KenBurnsPortrait({ figure, className = '' }) {
  const src = figure?.front_img || '';
  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={figure?.fig_id || 'empty'}
          initial={{ opacity: 0, scale: 1.0, x: 0, y: 0 }}
          animate={{
            opacity: 1,
            scale: [1.0, 1.08, 1.0],
            x: ['0%', '-3%', '0%'],
            y: ['0%', '-2%', '0%'],
          }}
          exit={{ opacity: 0 }}
          transition={{
            opacity: { duration: 0.6 },
            scale: { duration: 20, repeat: Infinity, ease: 'easeInOut' },
            x:     { duration: 20, repeat: Infinity, ease: 'easeInOut' },
            y:     { duration: 20, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="absolute inset-0"
          style={{
            backgroundImage: src ? `url(${src})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'sepia(0.2) contrast(1.05)',
          }}
        />
      </AnimatePresence>
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 120px 40px rgba(20,14,6,0.7)' }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/story/KenBurnsPortrait.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): KenBurnsPortrait with slow pan + sepia vignette"
```

---

## Task 8: `StoryMapPanel` component

**Files:** Create `src/components/story/StoryMapPanel.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { FIGURE_GEO, ERA_GEO_DEFAULT } from '@/lib/mapData';
import { getEra } from '@/lib/figuresData';

function FocusController({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    map.flyTo([focus.lat, focus.lng], focus.zoom, { duration: 1.5 });
  }, [map, focus?.lat, focus?.lng, focus?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function resolveFocus(figure) {
  if (!figure) return ERA_GEO_DEFAULT.founding;
  const direct = FIGURE_GEO[figure.fig_id];
  if (direct) return direct;
  const era = getEra(figure);
  return ERA_GEO_DEFAULT[era] ?? ERA_GEO_DEFAULT.founding;
}

export default function StoryMapPanel({ figure, era, className = '' }) {
  const focus = figure
    ? resolveFocus(figure)
    : (era ? ERA_GEO_DEFAULT[era] ?? ERA_GEO_DEFAULT.founding : ERA_GEO_DEFAULT.founding);

  return (
    <div className={`relative overflow-hidden bg-[#1a140c] ${className}`}>
      <MapContainer
        center={[focus.lat, focus.lng]}
        zoom={focus.zoom}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        style={{ width: '100%', height: '100%', background: '#1a140c' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          opacity={0.55}
        />
        <CircleMarker
          center={[focus.lat, focus.lng]}
          radius={8}
          pathOptions={{ color: '#C8992A', fillColor: '#C8992A', fillOpacity: 0.75, weight: 2 }}
        />
        <FocusController focus={focus} />
      </MapContainer>
    </div>
  );
}
```

- [ ] **Step 2: Verify build is clean**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/components/story/StoryMapPanel.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): StoryMapPanel with focus controller"
```

---

## Task 9: `StoryControls` component

**Files:** Create `src/components/story/StoryControls.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { Play, Pause, SkipBack, SkipForward, Maximize2, Minimize2 } from 'lucide-react';
import { useLang } from '@/lib/i18n';

export default function StoryControls({
  status, progress, slideIdx, totalSlides, currentAct,
  chapterRoman, chapterLabel, isFullscreen,
  onPlay, onPause, onPrev, onNext, onToggleFullscreen,
}) {
  const { t } = useLang();
  const isPlaying = status === 'playing';
  const pct = Math.round((progress ?? 0) * 100);

  return (
    <div className="border-t border-brass/25 bg-ink/95 backdrop-blur px-4 md:px-6 py-3 flex items-center gap-3">
      <div className="hidden md:flex flex-col leading-tight min-w-0 mr-2">
        <span className="font-meta text-[9px] tracking-[0.28em] uppercase text-brass/70">
          {t('story.chapter')} {chapterRoman} · {chapterLabel}
        </span>
        {currentAct && (
          <span className="font-display text-[11px] text-ivory/70 truncate mt-0.5">
            {currentAct}
          </span>
        )}
      </div>
      <button onClick={onPrev} aria-label={t('story.prev')}
              className="w-8 h-8 flex items-center justify-center text-brass/80 hover:text-ivory">
        <SkipBack className="w-4 h-4" />
      </button>
      <button
        onClick={isPlaying ? onPause : onPlay}
        aria-label={isPlaying ? t('story.pause') : t('story.play')}
        className="w-10 h-10 rounded-full border-2 border-brass hover:border-ivory text-brass hover:text-ivory flex items-center justify-center"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-[1px]" />}
      </button>
      <button onClick={onNext} aria-label={t('story.next')}
              className="w-8 h-8 flex items-center justify-center text-brass/80 hover:text-ivory">
        <SkipForward className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0 mx-2">
        <div className="h-[2px] bg-brass/15 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-seal to-brass transition-[width] duration-200"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="font-meta text-[10px] tracking-[0.22em] text-ivory/60 tabular-nums">
        {String(slideIdx + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
      </span>
      <button
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? t('story.exitFullscreen') : t('story.fullscreen')}
        className="w-8 h-8 flex items-center justify-center text-brass/80 hover:text-ivory"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```
git add src/components/story/StoryControls.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): StoryControls persistent transport bar"
```

---

## Task 10: `StoryStage` + `StoryEnding`

**Files:**
- Create `src/components/story/StoryStage.jsx`
- Create `src/components/story/StoryEnding.jsx`

- [ ] **Step 1: Create `StoryStage.jsx`**

```jsx
import { useMemo } from 'react';
import { FIGURES, ERAS } from '@/lib/figuresData';
import { useLang, figureName, storyText } from '@/lib/i18n';
import KenBurnsPortrait from './KenBurnsPortrait';
import StoryMapPanel from './StoryMapPanel';
import Subtitles from './Subtitles';

export default function StoryStage({ slide, charIndex = 0, className = '' }) {
  const { lang } = useLang();

  const { text, caption, figure, era } = useMemo(() => {
    if (!slide) return {};
    if (slide.kind === 'figure') {
      const f = slide.figure;
      return { text: storyText(f, lang), caption: `${figureName(f, lang)} · ${f.yrs}`, figure: f, era: null };
    }
    const eraDef = ERAS[slide.era] || {};
    if (slide.kind === 'intro') {
      const years = lang === 'en' ? (eraDef.years_en || eraDef.years) : eraDef.years;
      const intro = lang === 'en' ? (eraDef.intro_en || eraDef.intro) : eraDef.intro;
      return {
        text: `${eraDef.label} · ${years}. ${intro ?? ''}`,
        caption: `${eraDef.roman} · ${lang === 'en' ? (eraDef.label_en || eraDef.label) : eraDef.label}`,
        figure: null, era: slide.era,
      };
    }
    const done = lang === 'en' ? `Chapter ${eraDef.roman} complete.` : `Бүлэг ${eraDef.roman} дуусав.`;
    return { text: done, caption: done, figure: null, era: slide.era };
  }, [slide, lang]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      <KenBurnsPortrait figure={figure || FIGURES[0]} className="aspect-[4/5] md:aspect-auto md:min-h-[26rem]" />
      <StoryMapPanel figure={figure} era={era ?? slide?.era} className="aspect-[4/5] md:aspect-auto md:min-h-[26rem]" />
      <div className="md:col-span-2 space-y-2">
        <p className="font-meta text-[10px] tracking-[0.3em] uppercase text-brass/80">{caption}</p>
        <Subtitles text={text} charIndex={charIndex} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `StoryEnding.jsx`**

```jsx
import { Link } from 'react-router-dom';
import { useLang } from '@/lib/i18n';
import { ERAS } from '@/lib/figuresData';
import { nextEra } from '@/lib/storyPlaylist';
import Fleuron from '@/components/ornaments/Fleuron';

export default function StoryEnding({ currentEra }) {
  const { t, lang } = useLang();
  const next = nextEra(currentEra);
  const nextDef = next ? ERAS[next] : null;

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-6 text-center px-6 py-14">
      <Fleuron size={48} className="opacity-80" />
      <h2 className="font-display text-3xl md:text-4xl text-ivory">{t('story.ending.title')}</h2>
      {next ? (
        <Link
          to={`/story/${next}`}
          className="inline-flex items-center gap-3 px-6 py-3 border-2 border-brass text-brass hover:text-ivory hover:border-ivory font-display tracking-wide transition-colors"
        >
          <span className="font-meta text-[10px] tracking-[0.3em] uppercase">{t('story.ending.continue')}</span>
          <span>{nextDef.roman} · {lang === 'en' ? (nextDef.label_en || nextDef.label) : nextDef.label}</span>
          <span>→</span>
        </Link>
      ) : (
        <p className="font-prose italic text-ivory/70 max-w-md">{t('story.ending.done')}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/components/story/StoryStage.jsx src/components/story/StoryEnding.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): StoryStage + StoryEnding"
```

---

## Task 11: `StoryChapter` page + route wiring

**Files:**
- Create `src/pages/StoryChapter.jsx`
- Modify `src/App.jsx`

- [ ] **Step 1: Create `StoryChapter.jsx`**

```jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useLang, storyText } from '@/lib/i18n';
import { ERAS, ERA_KEYS } from '@/lib/figuresData';
import { buildChapterPlaylist } from '@/lib/storyPlaylist';
import { useNarration } from '@/hooks/useNarration';
import StoryStage from '@/components/story/StoryStage';
import StoryControls from '@/components/story/StoryControls';
import StoryEnding from '@/components/story/StoryEnding';

const RESUME_KEY = 'story:resume';

export default function StoryChapter() {
  const { chapter } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t, lang } = useLang();

  useEffect(() => {
    if (!ERA_KEYS.includes(chapter)) {
      toast.error(t('story.notFound'));
      navigate('/#chapters', { replace: true });
    }
  }, [chapter, navigate, t]);

  const playlist = useMemo(
    () => (ERA_KEYS.includes(chapter) ? buildChapterPlaylist(chapter) : []),
    [chapter],
  );
  const eraDef = ERAS[chapter] || {};

  const initialIdx = useMemo(() => {
    const q = parseInt(params.get('s') ?? '', 10);
    if (!Number.isNaN(q) && q >= 0 && q < playlist.length) return q;
    try {
      const raw = sessionStorage.getItem(RESUME_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.chapter === chapter && Number.isInteger(saved.slideIdx)) {
          return Math.min(Math.max(0, saved.slideIdx), playlist.length - 1);
        }
      }
    } catch { /* ignore */ }
    return 0;
  }, [chapter, params, playlist.length]);

  const [slideIdx, setSlideIdx] = useState(initialIdx);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ chapter, slideIdx })); } catch { /* ignore */ }
    const onBeforeUnload = () => {
      try { sessionStorage.setItem(RESUME_KEY, JSON.stringify({ chapter, slideIdx })); } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [chapter, slideIdx]);

  const slide = playlist[slideIdx];
  const isDone = slideIdx >= playlist.length;

  const narrationText = useMemo(() => {
    if (!slide) return '';
    if (slide.kind === 'figure') return storyText(slide.figure, lang);
    if (slide.kind === 'intro') {
      const years = lang === 'en' ? (eraDef.years_en || eraDef.years) : eraDef.years;
      const intro = lang === 'en' ? (eraDef.intro_en || eraDef.intro) : eraDef.intro;
      return `${eraDef.label}. ${years}. ${intro ?? ''}`;
    }
    return lang === 'en' ? `Chapter ${eraDef.roman} complete.` : `Бүлэг ${eraDef.roman} дуусав.`;
  }, [slide, lang, eraDef]);

  const advance = useCallback(() => setSlideIdx((i) => i + 1), []);

  const { status, progress, charIndex, play, pause, stop } = useNarration({
    text: narrationText, lang, autoPlay: true, onDone: advance,
  });

  const goPrev = useCallback(() => setSlideIdx((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setSlideIdx((i) => i + 1), []);

  const toggleFullscreen = useCallback(() => {
    const el = document.getElementById('story-root');
    if (!document.fullscreenElement) {
      if (el?.requestFullscreen) {
        el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(true));
      } else {
        setIsFullscreen(true);
      }
    } else {
      document.exitFullscreen?.().finally(() => setIsFullscreen(false));
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); status === 'playing' ? pause() : play(); }
      else if (e.code === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); goNext(); }
      else if (e.code === 'KeyF')       { e.preventDefault(); toggleFullscreen(); }
      else if (e.code === 'Escape' && isFullscreen) {
        e.preventDefault();
        document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [status, play, pause, goPrev, goNext, toggleFullscreen, isFullscreen]);

  useEffect(() => () => stop(), [stop]);

  if (!ERA_KEYS.includes(chapter)) return null;
  if (playlist.length === 0) {
    return (
      <div className="min-h-screen bg-ink flex items-center justify-center px-6 text-center">
        <p className="font-prose italic text-ivory/70">{t('story.empty')}</p>
      </div>
    );
  }

  if (isDone) {
    return (
      <div id="story-root" className={`bg-ink min-h-screen ${isFullscreen ? 'fixed inset-0 z-[999]' : ''}`}>
        <StoryEnding currentEra={chapter} />
      </div>
    );
  }

  const currentAct = slide?.kind === 'figure' ? slide.act : null;

  return (
    <div id="story-root"
         className={`bg-ink ${isFullscreen ? 'fixed inset-0 z-[999] overflow-auto' : 'min-h-screen'}`}>
      <div className={`${isFullscreen ? 'h-full flex flex-col' : ''}`}>
        <div className={`flex-1 ${isFullscreen ? 'overflow-auto' : ''} px-4 md:px-8 py-6`}>
          <StoryStage slide={slide} charIndex={charIndex} />
        </div>
        <StoryControls
          status={status}
          progress={progress}
          slideIdx={slideIdx}
          totalSlides={playlist.length}
          currentAct={currentAct}
          chapterRoman={eraDef.roman}
          chapterLabel={lang === 'en' ? (eraDef.label_en || eraDef.label) : eraDef.label}
          isFullscreen={isFullscreen}
          onPlay={play}
          onPause={pause}
          onPrev={goPrev}
          onNext={goNext}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register the route in `src/App.jsx`**

Add the import next to the other page imports:

```js
import StoryChapter from '@/pages/StoryChapter';
```

Make sure `Navigate` is imported from `react-router-dom`:

```js
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
```

Add the two routes inside `<Routes>`, next to the existing `/tour` route:

```jsx
      <Route path="/story/:chapter" element={<OtpGate><StoryChapter /></OtpGate>} />
      <Route path="/story" element={<Navigate to="/#chapters" replace />} />
```

- [ ] **Step 3: Verify build**

```
npm run build
```

- [ ] **Step 4: Commit**

```
git add src/pages/StoryChapter.jsx src/App.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): /story/:chapter page with playback, resume, keyboard, fullscreen"
```

---

## Task 12: `StoryChapter` tests

**Files:** Create `src/pages/StoryChapter.test.jsx`

- [ ] **Step 1: Write the tests**

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import StoryChapter from '@/pages/StoryChapter';

vi.mock('@/hooks/useNarration', () => ({
  useNarration: vi.fn(() => ({
    status: 'idle', progress: 0, charIndex: 0,
    play: vi.fn(), pause: vi.fn(), stop: vi.fn(),
    audioProps: {}, mode: 'tts',
  })),
}));

vi.mock('@/components/story/StoryMapPanel', () => ({
  default: () => <div data-testid="map-panel" />,
}));

vi.mock('react-hot-toast', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

function renderAt(url) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/story/:chapter" element={<StoryChapter />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { sessionStorage.clear(); });

describe('StoryChapter', () => {
  it('renders the intro slide by default', async () => {
    renderAt('/story/founding');
    await waitFor(() => expect(screen.getByText(/01 \//)).toBeInTheDocument());
  });

  it('?s= deep-link jumps to the requested slide', async () => {
    renderAt('/story/founding?s=3');
    await waitFor(() => expect(screen.getByText(/04 \//)).toBeInTheDocument());
  });

  it('next button advances slideIdx', async () => {
    renderAt('/story/founding');
    await waitFor(() => expect(screen.getByText(/01 \//)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Next|Дараагийн/i));
    await waitFor(() => expect(screen.getByText(/02 \//)).toBeInTheDocument());
  });

  it('previous at slide 0 is a no-op', async () => {
    renderAt('/story/founding');
    await waitFor(() => expect(screen.getByText(/01 \//)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Previous|Өмнөх/i));
    await waitFor(() => expect(screen.getByText(/01 \//)).toBeInTheDocument());
  });

  it('ArrowRight keyboard shortcut advances', async () => {
    renderAt('/story/founding');
    await waitFor(() => expect(screen.getByText(/01 \//)).toBeInTheDocument());
    fireEvent.keyDown(window, { code: 'ArrowRight' });
    await waitFor(() => expect(screen.getByText(/02 \//)).toBeInTheDocument());
  });

  it('persists slideIdx to sessionStorage', async () => {
    renderAt('/story/founding');
    await waitFor(() => expect(screen.getByText(/01 \//)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/Next|Дараагийн/i));
    await waitFor(() => {
      const raw = sessionStorage.getItem('story:resume');
      expect(raw).toBeTruthy();
      const saved = JSON.parse(raw);
      expect(saved.chapter).toBe('founding');
      expect(saved.slideIdx).toBe(1);
    });
  });

  it('resumes from sessionStorage when no ?s= is present', async () => {
    sessionStorage.setItem('story:resume', JSON.stringify({ chapter: 'founding', slideIdx: 2 }));
    renderAt('/story/founding');
    await waitFor(() => expect(screen.getByText(/03 \//)).toBeInTheDocument());
  });

  it('?s= overrides sessionStorage resume', async () => {
    sessionStorage.setItem('story:resume', JSON.stringify({ chapter: 'founding', slideIdx: 2 }));
    renderAt('/story/founding?s=5');
    await waitFor(() => expect(screen.getByText(/06 \//)).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run the test + full suite**

```
npm run test -- --run src/pages/StoryChapter.test.jsx
npm run test -- --run
```

- [ ] **Step 3: Commit**

```
git add src/pages/StoryChapter.test.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "test(story): StoryChapter nav, deep-link, session-resume, keyboard"
```

---

## Task 13: Add the "Play this chapter" CTA to `ChaptersSection`

**Files:** Modify `src/components/ChaptersSection.jsx`

- [ ] **Step 1: Add navigate hook and Play button**

Open `src/components/ChaptersSection.jsx`. Add the `useNavigate` import:

```js
import { useNavigate } from 'react-router-dom';
```

Inside the component body, before `return`:

```js
  const navigate = useNavigate();
```

In the right-hand column of each era `<article>`, replace the block that starts with `<h3 className="display-title ...">` down through the existing `<p className="prose-body italic ...">` (the era intro paragraph) with the following — which wraps the heading + a Play button in a flex row:

```jsx
                    <div className="flex items-start justify-between gap-4">
                      <h3
                        className="display-title text-[clamp(1.75rem,3.5vw,3rem)] text-ivory leading-[1]"
                        style={{ fontVariationSettings: '"opsz" 96, "SOFT" 60, "wght" 520' }}
                      >
                        {lang === 'en' ? era.label_en : era.label}
                      </h3>
                      <button
                        onClick={() => navigate(`/story/${key}`)}
                        className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-[10px] font-meta tracking-[0.26em] uppercase text-ivory bg-seal/80 border border-seal hover:bg-seal transition-colors"
                      >
                        ▶ {t('chapters.play')}
                      </button>
                    </div>

                    <p className="prose-body italic text-[15px] leading-[1.7] text-ivory/78 mt-4 max-w-2xl">
                      {lang === 'en' ? (era.intro_en || era.intro) : era.intro}
                    </p>
```

- [ ] **Step 2: Verify build**

```
npm run build
```

- [ ] **Step 3: Commit**

```
git add src/components/ChaptersSection.jsx
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "feat(story): 'Play this chapter' CTA per era in ChaptersSection"
```

---

## Task 14: Lint + tests + build sweep

- [ ] **Step 1: Lint**

```
npm run lint
```

Pre-existing lint errors in unrelated files are acceptable. New errors in Phase A files are not — fix inline.

- [ ] **Step 2: Full test suite**

```
npm run test -- --run
```

All tests pass.

- [ ] **Step 3: Build**

```
npm run build
```

- [ ] **Step 4: Commit any lint fixes (if needed)**

```
git add src/
git -c user.email="indra@amjilt.com" -c user.name="Enkh" commit -m "chore(story): lint pass"
```

---

## Task 15: Manual QA

Start `npm run dev` and walk the scenarios.

- [ ] **Scenario A — Entry point.** Log in, scroll to Chapters section, click "▶ Play this chapter" on founding. Expected URL: `/story/founding`.

- [ ] **Scenario B — Intro slide.** Counter `01 / <total>`; portrait + map visible; controls bar renders; browser TTS starts (if autoplay not blocked).

- [ ] **Scenario C — Navigation.** `→` advances, `←` goes back, `Space` toggles play/pause; `←` at slide 0 is a no-op.

- [ ] **Scenario D — Fullscreen.** `F` enters; Esc exits. Check iOS Safari CSS-pseudo fallback path.

- [ ] **Scenario E — Deep link.** `/story/founding?s=3` opens at slide 4.

- [ ] **Scenario F — Session resume.** Advance to slide 5, reload — counter returns to `06 / <total>`. Close tab, open new tab at `/story/founding` — restarts at `01`.

- [ ] **Scenario G — Ending card.** Click through to the last slide + 1. `StoryEnding` renders with Continue link to next era. On `modern` (last era), the "codex is complete" message appears instead.

- [ ] **Scenario H — Unknown chapter.** `/story/__bogus__` → toast + redirect to `/#chapters`.

- [ ] **Scenario I — Back-compat.** `/figure/1` StoryPlayer still narrates. `/tour` StoryTour still plays. The `useNarration` refactor must not break either.

- [ ] **Scenario J — Console clean.** No errors on open / advance / fullscreen / unmount.

---

## Self-Review

**Spec coverage:**
- `/story/:chapter` route — Task 11
- Hybrid inline + fullscreen — Task 11
- Portrait Ken Burns — Task 7
- Map panel with focus — Task 8
- Subtitles from TTS boundaries — Task 6 (chunking) + Task 11 (charIndex plumbing)
- Persistent controls — Task 9
- Keyboard shortcuts — Task 11
- Session resume — Tasks 11, 12
- Deep-link `?s=` — Tasks 11, 12
- ChaptersSection Play CTA — Task 13
- Act labels — Task 3 (data) + Task 9 (display)
- Ending card — Task 10 (component) + Task 11 (isDone branch)
- Error paths (unknown chapter, empty era, TTS unavailable) — Task 11
- i18n — Task 1
- Refactor StoryPlayer through useNarration — Tasks 4, 5

**Placeholder scan:** No "TBD", every task has exact code.

**Type consistency:** Slide shape `{kind, era?, figure?, act?}` used identically across `buildChapterPlaylist`, `StoryStage`, `StoryChapter`. `useNarration` return shape `{status, progress, charIndex, play, pause, stop, audioProps, mode}` used identically by `StoryPlayer` and `StoryChapter`.

**Simplifications vs spec:**
- Reuse existing `era.intro`/`era.intro_en` — no new `ERA_OVERVIEWS` map needed.
- `FIGURE_GEO` in `mapData.js`; `resolveFocus` in `StoryMapPanel.jsx` to avoid circular imports.
- `StoryMapPanel` uses react-leaflet directly rather than wrapping `HistoricalMap`, keeping the existing map page untouched.
