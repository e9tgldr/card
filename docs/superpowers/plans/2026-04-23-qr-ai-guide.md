# QR-to-AI Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the anonymous QR-code scan flow (`/c/:figId`) so physical card holders land directly in a first-person AI chat with the Mongolian historical figure on their card — with a rule-based MN floor, Gemini as the richer tier, ElevenLabs for voice (cached), and graceful degradation at every step.

**Architecture:** A new public React route `/c/:figId` mounts a chat UI that orchestrates three tiers: (1) client-side rule-based responder from `figuresData.js`, (2) Supabase edge function `ask-figure` calling Gemini 2.5 Flash, (3) pre-baked in-character fallback strings. Voice is opt-in via a second edge function `speak` that caches ElevenLabs output in Supabase Storage, falling back to `window.speechSynthesis`. IP-based rate limiting on both edge functions via a new `rate_limits` table.

**Tech Stack:** React 18 + Vite, React Router v6, Supabase (Postgres + Edge Functions [Deno] + Storage), Gemini 2.5 Flash REST, ElevenLabs TTS REST, Vitest for unit tests, `sessionStorage` for client memory.

**Environment prerequisites:**
- Supabase project: `vrjpoyeonjkzhxthpvjq` (already set up, schema deployed).
- Dev server: `cd "mongol-history-hub (2)" && npm run dev` (already running on :5173 in the session).
- This project is **not** under git; tasks end with `**Checkpoint**` markers instead of commits.
- Secrets (Gemini / ElevenLabs) are operational — tasks that require them have a **"Skip for rule-based-only MVP"** note; the feature is fully usable with just the rule-based floor and browser TTS.

---

## File Structure

**New files:**
- `src/lib/figureResponder.js` — pure intent-matching logic (no React, no network)
- `src/lib/figureResponder.test.js` — Vitest unit tests for responder
- `src/hooks/useFigureChat.js` — React hook orchestrating the three AI tiers + voice + session memory
- `src/pages/ScanChat.jsx` — the public route page
- `src/components/ScanNotFound.jsx` — invalid-figId error page
- `supabase/functions/_shared/ip.ts` — IP-hashing helper
- `supabase/functions/_shared/rate-limit.ts` — upsert-based rate limit helper
- `supabase/functions/ask-figure/index.ts` — Gemini caller
- `supabase/functions/speak/index.ts` — ElevenLabs caller with cache
- `supabase/migrations/20260424000000_qr_ai_guide.sql` — rate_limits table + voice-cache bucket + policies
- `vitest.config.js` — Vitest config

**Modified files:**
- `src/App.jsx` — add `<Route path="/c/:figId" element={<ScanChat />} />` (public, outside `OtpGate`)
- `package.json` — add Vitest devDep + `test` script

**Why this split:** `figureResponder.js` is pure logic → tested in isolation. `useFigureChat.js` contains only hook+orchestration state (easy to reason about). `ScanChat.jsx` is layout only (UI props from hook). Edge functions live under `_shared/` for reuse.

---

## Task 1: Vitest setup

**Files:**
- Modify: `mongol-history-hub (2)/package.json`
- Create: `mongol-history-hub (2)/vitest.config.js`
- Create: `mongol-history-hub (2)/src/lib/smoke.test.js` (throwaway sanity check, deleted at end of task)

**Working directory for ALL shell commands in this plan:** `C:/Users/enkh/Downloads/project/mongol-history-hub (2)`

- [ ] **Step 1.1: Install vitest**

Run:
```bash
npm install -D vitest@^2.1.0
```

Expected: installs without errors. `vitest` appears in `devDependencies` of `package.json`.

- [ ] **Step 1.2: Add `test` script to package.json**

In `package.json`, in the `"scripts"` object, add after `"preview"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 1.3: Create Vitest config**

Write `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
});
```

- [ ] **Step 1.4: Smoke test**

Write `src/lib/smoke.test.js`:

```js
import { expect, test } from 'vitest';

test('vitest works', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 1.5: Run the smoke test**

Run: `npm test`

Expected: `1 passed` in green. If it fails, check the alias in vitest.config.js matches `vite.config.js`.

- [ ] **Step 1.6: Delete smoke test**

Delete `src/lib/smoke.test.js`.

- [ ] **Checkpoint 1:** Vitest installed, `npm test` runs, smoke test deleted.

---

## Task 2: Rule-based responder (pure logic + tests)

**Files:**
- Create: `mongol-history-hub (2)/src/lib/figureResponder.js`
- Create: `mongol-history-hub (2)/src/lib/figureResponder.test.js`

The responder matches MN user input to one of ~12 intents, pulls from the figure's static fields, and returns a first-person string. EN/CN input returns `null` (handled upstream by Gemini tier).

- [ ] **Step 2.1: Write the failing test file**

Write `src/lib/figureResponder.test.js`:

```js
import { describe, expect, test } from 'vitest';
import { tryAnswer } from '@/lib/figureResponder';

const chinggis = {
  fig_id: 1,
  name: 'Чингис Хаан',
  yrs: '1162–1227',
  role: 'Их Монгол Улсын Үндэслэгч',
  bio: 'Тэмүжин нэрээр төрсөн Чингис Хаан бол түүхэн дэх хамгийн агуу эзэн хаан юм.',
  achs: ['Монгол овгуудыг нэгтгэсэн', 'Их Монгол Улсыг байгуулсан'],
  fact: 'Чингис Хааны булш өнөөг хүртэл олдоогүй байна.',
  quote: 'Би бол тэнгэрийн шийтгэл.',
  qattr: 'Чингис Хаан',
};

describe('figureResponder.tryAnswer', () => {
  test('returns null for non-MN input', () => {
    expect(tryAnswer(chinggis, 'when were you born', 'en')).toBeNull();
    expect(tryAnswer(chinggis, '你好', 'cn')).toBeNull();
  });

  test('answers birth year in first person', () => {
    const out = tryAnswer(chinggis, 'Та хэзээ төрсөн бэ?', 'mn');
    expect(out).not.toBeNull();
    expect(out).toMatch(/1162/);
    expect(out).toMatch(/би|миний/i);
  });

  test('answers death year', () => {
    const out = tryAnswer(chinggis, 'Та хэзээ нас барсан бэ?', 'mn');
    expect(out).toMatch(/1227/);
  });

  test('lists achievements when asked', () => {
    const out = tryAnswer(chinggis, 'Та юу хийсэн бэ?', 'mn');
    expect(out).toMatch(/Монгол овгуудыг нэгтгэсэн/);
    expect(out).toMatch(/Их Монгол Улсыг байгуулсан/);
  });

  test('returns quote when asked about famous saying', () => {
    const out = tryAnswer(chinggis, 'Чиний нэрт үг юу вэ?', 'mn');
    expect(out).toMatch(/Би бол тэнгэрийн шийтгэл/);
  });

  test('returns bio for "who are you"', () => {
    const out = tryAnswer(chinggis, 'Чи хэн бэ?', 'mn');
    expect(out).toMatch(/Тэмүжин/);
  });

  test('returns fact when asked for a random fact', () => {
    const out = tryAnswer(chinggis, 'Сонирхолтой зүйл юу байдаг вэ?', 'mn');
    expect(out).toMatch(/булш/);
  });

  test('returns null when no intent matches', () => {
    const out = tryAnswer(chinggis, 'асдфгзхпэкуқ', 'mn');
    expect(out).toBeNull();
  });

  test('gracefully handles missing fields (e.g., no quote)', () => {
    const noQuote = { ...chinggis, quote: null, qattr: null };
    expect(tryAnswer(noQuote, 'Чиний нэрт үг юу вэ?', 'mn')).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `npm test`

Expected: all 9 tests FAIL with "tryAnswer is not a function" or module-not-found.

- [ ] **Step 2.3: Implement `figureResponder.js`**

Write `src/lib/figureResponder.js`:

```js
// Rule-based MN responder. Returns a first-person Mongolian answer string,
// or null if no intent matches (caller falls through to LLM tier).

const PATTERNS = [
  {
    id: 'birth_year',
    re: /хэзээ\s+төрс(эн|ний)|төрсөн\s+он|хэдэн\s+онд\s+төрс/i,
    needs: ['yrs'],
    render: (f) => {
      const m = f.yrs?.match(/(\d{3,4})/);
      return m ? `Би ${m[1]} онд төрсөн.` : null;
    },
  },
  {
    id: 'death_year',
    re: /хэзээ\s+нас\s+бар|нас\s+барсан\s+он|хэзээ\s+ертөнцийн\s+мөнх/i,
    needs: ['yrs'],
    render: (f) => {
      const m = f.yrs?.match(/(\d{3,4})\s*[–\-—]\s*(\d{3,4})/);
      return m ? `Би ${m[2]} онд ертөнцийн мөнх бусыг үзүүлсэн.` : null;
    },
  },
  {
    id: 'lifespan',
    re: /хэзээ\s+амьдарсан|амьдралын\s+он|он\s+жил/i,
    needs: ['yrs'],
    render: (f) => `Миний амьдралын он ${f.yrs}.`,
  },
  {
    id: 'role',
    re: /чи\s+хэн\s+(байсан|бэ|бо)|юу\s+болох\s+байс|ямар\s+хүн/i,
    needs: ['role'],
    render: (f) => `Намайг ${f.name} гэдэг. Би бол ${f.role}.`,
  },
  {
    id: 'who_are_you',
    re: /чи\s+хэн(\s+бэ|\s+вэ)?\??$|танилц|өөрийгөө/i,
    needs: ['bio'],
    render: (f) => `${f.bio}`,
  },
  {
    id: 'achievements',
    re: /юу\s+хийс(эн|эн\s+бэ)|гавьяа|амжилт|бүтээсэн/i,
    needs: ['achs'],
    render: (f) => {
      if (!f.achs?.length) return null;
      const list = f.achs.map((a) => `• ${a}`).join('\n');
      return `Миний гол үйлсээс:\n${list}`;
    },
  },
  {
    id: 'quote',
    re: /нэрт\s+үг|ишлэл|алдартай\s+үг|хэлс(эн|эн\s+үг)/i,
    needs: ['quote'],
    render: (f) => (f.quote ? `"${f.quote}" — миний үг.` : null),
  },
  {
    id: 'fact',
    re: /сонирхолтой|сонин\s+юм|мэдэхгүй\s+зүйл|нууц/i,
    needs: ['fact'],
    render: (f) => (f.fact ? f.fact : null),
  },
  {
    id: 'bio',
    re: /түүх|амьдрал|намтар/i,
    needs: ['bio'],
    render: (f) => f.bio ?? null,
  },
];

export function tryAnswer(figure, userText, lang) {
  if (lang !== 'mn') return null;
  if (!figure || !userText) return null;
  const text = userText.trim();
  if (!text) return null;

  for (const p of PATTERNS) {
    if (!p.re.test(text)) continue;
    // Field guard: only render if all needs are present (non-null, non-empty).
    const ok = p.needs.every((k) => {
      const v = figure[k];
      return Array.isArray(v) ? v.length > 0 : v != null && v !== '';
    });
    if (!ok) continue;
    const result = p.render(figure);
    if (result) return result;
  }
  return null;
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `npm test`

Expected: all 9 tests PASS.

If any fail, the usual culprits are (a) regex too strict — adjust the `re` for that intent, (b) `needs` includes a field not present in the test fixture.

- [ ] **Checkpoint 2:** Rule-based responder ships, tests green.

---

## Task 3: `ScanNotFound` error component

**Files:**
- Create: `mongol-history-hub (2)/src/components/ScanNotFound.jsx`

- [ ] **Step 3.1: Write the component**

Write `src/components/ScanNotFound.jsx`:

```jsx
import { Link } from 'react-router-dom';

export default function ScanNotFound() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(180deg, #0a0c14 0%, #100d04 50%, #0a0c14 100%)' }}
    >
      <div className="max-w-md text-center space-y-5">
        <div className="text-5xl">🏇</div>
        <h1 className="font-playfair text-3xl font-bold" style={{ color: '#e8d5a3' }}>
          Хөзрийг таних боломжгүй
        </h1>
        <p className="font-cormorant text-lg" style={{ color: '#e8d5a380' }}>
          QR код хүчингүй эсвэл 1–52-с гадуурх дугаартай байна. Өөр хөзрөө уншуулна уу.
        </p>
        <Link
          to="/"
          className="inline-block font-cormorant tracking-widest uppercase text-sm px-6 py-3 rounded-full"
          style={{ border: '1px solid rgba(201,168,76,0.4)', color: '#e8d5a3' }}
        >
          Нүүр хуудас руу буцах
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.2: Manual verification (deferred)**

This component is rendered by the route in Task 5; verification happens after that task. No dev-server check needed yet.

- [ ] **Checkpoint 3:** Error component exists.

---

## Task 4: `useFigureChat` hook (tier-1 only, stub tier-2 for now)

**Files:**
- Create: `mongol-history-hub (2)/src/hooks/useFigureChat.js`

The hook manages: messages array, language, sending a user message, auto-sending the figure's opening line, persistence to `sessionStorage`. Tier 2 (edge function) is stubbed for now; we wire it in Task 8 once the edge function exists.

- [ ] **Step 4.1: Write the hook**

Write `src/hooks/useFigureChat.js`:

```js
import { useState, useEffect, useCallback, useRef } from 'react';
import { tryAnswer } from '@/lib/figureResponder';

const MAX_TURNS_KEPT = 20;
const MAX_TURNS_SENT_TO_LLM = 8;

const OPENING = {
  mn: (name) => `Би бол ${name}. Та надаас юу асуух вэ?`,
  en: (name) => `I am ${name}. What would you like to ask me?`,
  cn: (name) => `我是${name}。你想问我什么？`,
};

const UPSTREAM_FALLBACK = {
  mn: 'Уучлаарай, миний бодол санаа одоо тогтворгүй байна. Дараа дахин асуугаарай.',
  en: 'Forgive me — my thoughts are unsettled right now. Ask me again later.',
  cn: '抱歉，此刻我的思绪不宁。请稍后再问。',
};

const RATE_LIMITED_FALLBACK = {
  mn: 'Би одоо бага зэрэг амарч байна. Хэдэн минутын дараа буцаж ирээрэй.',
  en: 'I am resting for a moment. Come back in a few minutes.',
  cn: '我先歇一会儿，稍后再来找我吧。',
};

const storageKey = (figId) => `chat:fig:${figId}`;

function loadStored(figId) {
  try {
    const raw = sessionStorage.getItem(storageKey(figId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.messages)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStored(figId, data) {
  try {
    sessionStorage.setItem(storageKey(figId), JSON.stringify(data));
  } catch { /* quota full, ignore */ }
}

export function useFigureChat(figure) {
  const [messages, setMessages] = useState([]);
  const [lang, setLang] = useState('mn');
  const [busy, setBusy] = useState(false);
  const initialised = useRef(false);

  // Restore from sessionStorage or seed opening message.
  useEffect(() => {
    if (!figure || initialised.current) return;
    initialised.current = true;

    const stored = loadStored(figure.fig_id);
    if (stored) {
      setMessages(stored.messages);
      setLang(stored.lang ?? 'mn');
    } else {
      const opening = {
        role: 'ai',
        text: OPENING.mn(figure.name),
        lang: 'mn',
        ts: Date.now(),
      };
      setMessages([opening]);
      saveStored(figure.fig_id, { messages: [opening], lang: 'mn' });
    }
  }, [figure]);

  const pushMessage = useCallback((msg) => {
    setMessages((prev) => {
      const next = [...prev, msg].slice(-MAX_TURNS_KEPT);
      saveStored(figure.fig_id, { messages: next, lang });
      return next;
    });
  }, [figure, lang]);

  const switchLang = useCallback((newLang) => {
    setLang(newLang);
    const greeting = {
      role: 'ai',
      text: OPENING[newLang](figure.name),
      lang: newLang,
      ts: Date.now(),
    };
    pushMessage(greeting);
  }, [figure, pushMessage]);

  const send = useCallback(async (text) => {
    if (!text?.trim() || busy) return;
    const userMsg = { role: 'user', text: text.trim(), lang, ts: Date.now() };
    pushMessage(userMsg);
    setBusy(true);

    // Tier 1: rule-based (MN only).
    const ruleAnswer = tryAnswer(figure, userMsg.text, lang);
    if (ruleAnswer) {
      pushMessage({ role: 'ai', text: ruleAnswer, lang, source: 'rule', ts: Date.now() });
      setBusy(false);
      return;
    }

    // Tier 2: edge function (stub for now — returns upstream fallback).
    // Will be wired in Task 8 to call /functions/v1/ask-figure.
    await new Promise((r) => setTimeout(r, 400));
    pushMessage({
      role: 'ai',
      text: UPSTREAM_FALLBACK[lang],
      lang,
      source: 'fallback',
      ts: Date.now(),
    });
    setBusy(false);
  }, [figure, lang, busy, pushMessage]);

  const clearChat = useCallback(() => {
    sessionStorage.removeItem(storageKey(figure.fig_id));
    initialised.current = false;
    setMessages([]);
  }, [figure]);

  return { messages, lang, busy, send, switchLang, clearChat };
}

// Exposed for Task 8 to reuse when wiring the edge function.
export const __internals = { MAX_TURNS_SENT_TO_LLM, UPSTREAM_FALLBACK, RATE_LIMITED_FALLBACK };
```

- [ ] **Step 4.2: Manual check — import syntax**

Run: `npm run lint`

Expected: no errors about `useFigureChat.js`. If lint complains about unused `__internals`, add `// eslint-disable-next-line no-unused-vars` above it or `export` it directly (already exported).

- [ ] **Checkpoint 4:** Hook exists, sessionStorage persistence + rule-based tier work; LLM tier is a 400ms-delayed fallback.

---

## Task 5: `ScanChat` page + public route

**Files:**
- Create: `mongol-history-hub (2)/src/pages/ScanChat.jsx`
- Modify: `mongol-history-hub (2)/src/App.jsx`

- [ ] **Step 5.1: Write the page**

Write `src/pages/ScanChat.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Send, Volume2, X } from 'lucide-react';
import { FIGURES } from '@/lib/figuresData';
import { useFigureChat } from '@/hooks/useFigureChat';
import ScanNotFound from '@/components/ScanNotFound';

const LANG_LABELS = [
  { code: 'mn', label: 'Монгол' },
  { code: 'en', label: 'English' },
  { code: 'cn', label: '中文' },
];

export default function ScanChat() {
  const { figId } = useParams();
  const figure = FIGURES.find((f) => String(f.fig_id) === String(figId));

  if (!figure) return <ScanNotFound />;

  const { messages, lang, busy, send, switchLang } = useFigureChat(figure);
  const [input, setInput] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const handleSend = (e) => {
    e.preventDefault();
    send(input);
    setInput('');
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0a0c14 0%, #100d04 50%, #0a0c14 100%)' }}
    >
      {/* Header */}
      <header
        className="flex-shrink-0 px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(201,168,76,0.25)', background: 'rgba(10,12,20,0.9)' }}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ border: '1px solid #c9a84c', background: 'rgba(201,168,76,0.1)' }}
        >
          <span className="text-xl">{figure.ico}</span>
        </div>
        <div className="min-w-0">
          <div className="font-playfair text-base font-bold truncate" style={{ color: '#e8d5a3' }}>
            {figure.name}
          </div>
          <div className="font-cormorant text-xs" style={{ color: '#c9a84c' }}>
            {figure.yrs} · AI · Онлайн
          </div>
        </div>
        <div className="ml-auto flex gap-1">
          {LANG_LABELS.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => switchLang(code)}
              className="rounded-full px-2.5 py-1 font-cormorant text-xs transition"
              style={{
                border: '1px solid rgba(201,168,76,0.4)',
                background: lang === code ? '#c9a84c' : 'transparent',
                color: lang === code ? '#0a0c14' : '#e8d5a3',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {busy && <TypingIndicator />}
      </div>

      {/* Signup banner */}
      {!bannerDismissed && (
        <div
          className="flex-shrink-0 flex items-center gap-3 px-4 py-2 text-xs font-cormorant"
          style={{ borderTop: '1px solid rgba(201,168,76,0.2)', background: 'rgba(201,168,76,0.06)', color: '#e8d5a3' }}
        >
          <span className="flex-1">Яриаг хадгалах уу?{' '}
            <Link to="/otp?next=/collection" className="underline" style={{ color: '#c9a84c' }}>
              Бүртгэл үүсгэх
            </Link>
          </span>
          <button onClick={() => setBannerDismissed(true)} aria-label="Хаах">
            <X className="w-4 h-4" style={{ color: '#e8d5a380' }} />
          </button>
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="flex-shrink-0 px-3 py-3 flex gap-2 items-end"
        style={{ borderTop: '1px solid rgba(201,168,76,0.25)', background: 'rgba(10,12,20,0.95)' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={lang === 'mn' ? 'Асуултаа бичнэ үү…' : lang === 'en' ? 'Ask me anything…' : '向我提问…'}
          className="flex-1 bg-transparent font-cormorant text-base outline-none px-3 py-2 rounded-full"
          style={{ border: '1px solid rgba(201,168,76,0.35)', color: '#e8d5a3' }}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40"
          style={{ background: '#c9a84c', color: '#0a0c14' }}
          aria-label="Илгээх"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="rounded-2xl px-4 py-2.5 max-w-[80%] font-cormorant text-base leading-relaxed whitespace-pre-wrap"
        style={{
          background: isUser ? 'rgba(201,168,76,0.15)' : 'rgba(26,26,26,0.9)',
          border: `1px solid ${isUser ? 'rgba(201,168,76,0.35)' : 'rgba(201,168,76,0.15)'}`,
          color: '#e8d5a3',
        }}
      >
        {message.text}
        {!isUser && (
          <button
            className="ml-2 inline-flex align-middle opacity-70 hover:opacity-100"
            aria-label="Дуугаар сонсох"
            onClick={() => speakClient(message.text, message.lang)}
          >
            <Volume2 className="w-4 h-4" style={{ color: '#c9a84c' }} />
          </button>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="rounded-2xl px-4 py-3 flex gap-1.5"
        style={{ background: 'rgba(26,26,26,0.9)', border: '1px solid rgba(201,168,76,0.15)' }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#c9a84c', animation: `typeBounce 1.2s ${i * 0.18}s infinite` }}
          />
        ))}
      </div>
      <style>{`
        @keyframes typeBounce { 0%,100% { transform: translateY(0); opacity:.4 } 50% { transform: translateY(-4px); opacity:1 } }
      `}</style>
    </div>
  );
}

// Stub: Task 9 replaces this with an edge-function call + caching.
function speakClient(text, lang) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = { mn: 'mn-MN', en: 'en-US', cn: 'zh-CN' }[lang] ?? 'mn-MN';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
```

- [ ] **Step 5.2: Add the public route in `App.jsx`**

Read `src/App.jsx` and find the `<Routes>` block. Add the `ScanChat` import near the top alongside the other page imports:

```jsx
import ScanChat from '@/pages/ScanChat';
```

Then add this route **outside** any `OtpGate` wrapper, as a sibling to the existing `/otp` route:

```jsx
<Route path="/c/:figId" element={<ScanChat />} />
```

After the change, the `<Routes>` block should look like:

```jsx
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/otp" element={<OtpLogin />} />
  <Route path="/c/:figId" element={<ScanChat />} />
  <Route path="/app" element={<OtpGate><Home /></OtpGate>} />
  <Route path="/figure/:figId" element={<OtpGate><FigureDetail /></OtpGate>} />
  <Route path="/collection" element={<OtpGate><MyCollection /></OtpGate>} />
  <Route path="/games/quotes" element={<OtpGate><GameQuoteGuess /></OtpGate>} />
  <Route path="/tour" element={<OtpGate><StoryTour /></OtpGate>} />
  <Route path="*" element={<PageNotFound />} />
</Routes>
```

Leave `AuthProvider` / `LangProvider` / `QueryClientProvider` wrappers intact — the ScanChat page is public but can still safely live inside them (it doesn't call useAuth).

- [ ] **Step 5.3: Manual browser verification**

With dev server running on :5173:

1. Open `http://localhost:5173/c/1` in a clean browser tab (incognito is ideal — no existing session).
2. Expected: chat UI loads instantly with a greeting message *"Би бол Чингис Хаан. Та надаас юу асуух вэ?"* from the figure.
3. Type *"Та хэзээ төрсөн бэ?"* and press send.
4. Expected: you see your message bubble on the right, then **~0ms** later a reply with `1162` in it.
5. Type random gibberish `"асдфжш"`.
6. Expected: a ~400ms delay, then the fallback *"Уучлаарай, миний бодол санаа…"* message.
7. Tap the EN pill.
8. Expected: the figure's greeting re-sends in English.
9. Tap the 🔊 icon on any AI message.
10. Expected: browser TTS speaks it (quality depends on browser voice coverage for MN).
11. Open `http://localhost:5173/c/9999`.
12. Expected: ScanNotFound page with 🏇 and "Card not recognized" message.
13. Reload `http://localhost:5173/c/1` (same tab) — messages should persist (sessionStorage).
14. Close the tab and reopen — messages should reset.

- [ ] **Checkpoint 5:** Public scan route works end-to-end with rule-based tier + browser TTS. Zero API keys required. **This is a shippable MVP on its own.**

---

## Task 6: Database migration (rate_limits + voice-cache bucket)

**Files:**
- Create: `mongol-history-hub (2)/supabase/migrations/20260424000000_qr_ai_guide.sql`

This migration adds the rate-limit table and the voice-cache storage bucket. It's applied via the Supabase MCP tool (the CLI is not set up in this project).

- [ ] **Step 6.1: Write the migration file**

Write `supabase/migrations/20260424000000_qr_ai_guide.sql`:

```sql
create table rate_limits (
  ip_hash text not null,
  bucket_hour text not null,
  endpoint text not null,
  count int not null default 0,
  primary key (ip_hash, bucket_hour, endpoint)
);

alter table rate_limits enable row level security;
-- No policies: no client access. Edge functions use service role.

-- Voice cache bucket for ElevenLabs output.
insert into storage.buckets (id, name, public)
values ('voice-cache', 'voice-cache', true)
on conflict (id) do nothing;

create policy "voice-cache public read"
  on storage.objects for select
  using (bucket_id = 'voice-cache');
-- No insert/update/delete policies for voice-cache: only service role writes.
```

- [ ] **Step 6.2: Apply the migration via Supabase MCP**

Use the `mcp__supabase__apply_migration` tool:
- `name`: `qr_ai_guide`
- `query`: the full SQL above (without the comment header is fine).

Expected: `{"success": true}`.

- [ ] **Step 6.3: Verify the table and bucket exist**

Use `mcp__supabase__execute_sql`:
```sql
select count(*) as rate_limits_exists from information_schema.tables
  where table_schema = 'public' and table_name = 'rate_limits';
select id from storage.buckets where id = 'voice-cache';
```

Expected: `rate_limits_exists = 1`, `id = 'voice-cache'`.

- [ ] **Checkpoint 6:** rate_limits table + voice-cache bucket live.

---

## Task 7: Shared edge function utilities

**Files:**
- Create: `mongol-history-hub (2)/supabase/functions/_shared/ip.ts`
- Create: `mongol-history-hub (2)/supabase/functions/_shared/rate-limit.ts`

- [ ] **Step 7.1: Write `ip.ts`**

Write `supabase/functions/_shared/ip.ts`:

```ts
// Extracts the client IP from Supabase Edge Function request headers
// and returns a SHA-256 hex hash so we never store raw IPs.

export async function ipHash(req: Request): Promise<string> {
  const raw =
    req.headers.get('cf-connecting-ip') ??
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ??
    'unknown';
  const buf = new TextEncoder().encode(raw);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function currentHourBucket(): string {
  // e.g. "2026-04-23T14"
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}`;
}
```

- [ ] **Step 7.2: Write `rate-limit.ts`**

Write `supabase/functions/_shared/rate-limit.ts`:

```ts
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export async function checkAndIncrement(
  admin: SupabaseClient,
  ipHashValue: string,
  bucketHour: string,
  endpoint: string,
  hourlyLimit: number,
): Promise<{ allowed: boolean; count: number }> {
  // Read current count (service role, RLS bypassed).
  const { data: existing } = await admin
    .from('rate_limits')
    .select('count')
    .eq('ip_hash', ipHashValue)
    .eq('bucket_hour', bucketHour)
    .eq('endpoint', endpoint)
    .maybeSingle();

  const current = existing?.count ?? 0;
  if (current >= hourlyLimit) {
    return { allowed: false, count: current };
  }

  // Increment (upsert).
  const nextCount = current + 1;
  const { error } = await admin
    .from('rate_limits')
    .upsert(
      { ip_hash: ipHashValue, bucket_hour: bucketHour, endpoint, count: nextCount },
      { onConflict: 'ip_hash,bucket_hour,endpoint' },
    );
  if (error) {
    // Fail open: if the DB write fails, don't block the user — just log.
    console.error('rate-limit upsert failed', error);
  }
  return { allowed: true, count: nextCount };
}
```

Note: the read-then-write has a small race window. Accepted for MVP — a few over-limit messages slipping through isn't a cost problem at this scale.

- [ ] **Checkpoint 7:** Shared utils ready for consumption by the next two tasks.

---

## Task 8: `ask-figure` edge function

**Files:**
- Create: `mongol-history-hub (2)/supabase/functions/ask-figure/index.ts`

- [ ] **Step 8.1: Write the function**

Write `supabase/functions/ask-figure/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { ipHash, currentHourBucket } from '../_shared/ip.ts';
import { checkAndIncrement } from '../_shared/rate-limit.ts';

const HOURLY_LIMIT = 20;

const UPSTREAM_FALLBACK: Record<string, string> = {
  mn: 'Уучлаарай, миний бодол санаа одоо тогтворгүй байна. Дараа дахин асуугаарай.',
  en: 'Forgive me — my thoughts are unsettled right now. Ask me again later.',
  cn: '抱歉，此刻我的思绪不宁。请稍后再问。',
};

const RATE_LIMITED_FALLBACK: Record<string, string> = {
  mn: 'Би одоо бага зэрэг амарч байна. Хэдэн минутын дараа буцаж ирээрэй.',
  en: 'I am resting for a moment. Come back in a few minutes.',
  cn: '我先歇一会儿，稍后再来找我吧。',
};

interface FigurePayload {
  name: string;
  yrs?: string;
  role?: string;
  bio?: string;
  achs?: string[];
  fact?: string;
  quote?: string;
  qattr?: string;
}

interface Turn { role: 'user' | 'ai'; text: string; }

function buildSystemPrompt(fig: FigurePayload, lang: string): string {
  const deathYear = fig.yrs?.match(/(\d{3,4})\s*[–\-—]\s*(\d{3,4})/)?.[2] ?? '(unknown)';
  const langName = lang === 'en' ? 'English' : lang === 'cn' ? 'Simplified Chinese' : 'Mongolian (Cyrillic)';
  return `You are ${fig.name}, a Mongolian historical figure${fig.yrs ? ` who lived ${fig.yrs}` : ''}.
Role: ${fig.role ?? '(unspecified)'}.

Your life story (ground truth — never contradict):
${fig.bio ?? '(no bio recorded)'}

Your documented achievements:
${(fig.achs ?? []).map((a) => `- ${a}`).join('\n') || '(none recorded)'}

Your famous quote: "${fig.quote ?? ''}"${fig.qattr ? ` — ${fig.qattr}` : ''}
A notable fact about you: ${fig.fact ?? '(none recorded)'}

Rules:
- Speak in FIRST PERSON as ${fig.name}, in ${langName}.
- Stay in character. Refer to your own life with "I" and "my".
- If asked about events after your death (${deathYear}) or matters outside your documented life, say so in-character, e.g., "I cannot know this — I had already passed away by then."
- Answer in at most 3 short paragraphs. Prefer concrete details from the ground truth over speculation.
- Never break character to mention you are an AI or a language model.`;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  let body: { figure?: FigurePayload; question?: string; lang?: string; history?: Turn[] };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const lang = (body.lang === 'en' || body.lang === 'cn') ? body.lang : 'mn';
  const fig = body.figure;
  const question = body.question?.trim() ?? '';
  const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

  if (!fig?.name || !question) {
    return json({ ok: false, reason: 'bad_request' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Rate limit.
  const hashVal = await ipHash(req);
  const bucket = currentHourBucket();
  const limit = await checkAndIncrement(admin, hashVal, bucket, 'ask-figure', HOURLY_LIMIT);
  if (!limit.allowed) {
    return json({ ok: true, reply: RATE_LIMITED_FALLBACK[lang], source: 'rate_limited' });
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiKey) {
    // No key set — return upstream fallback so the feature degrades gracefully.
    return json({ ok: true, reply: UPSTREAM_FALLBACK[lang], source: 'no_key' });
  }

  // Build Gemini request.
  const system = buildSystemPrompt(fig, lang);
  const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
  for (const t of history) {
    contents.push({ role: t.role === 'ai' ? 'model' : 'user', parts: [{ text: t.text }] });
  }
  contents.push({ role: 'user', parts: [{ text: question }] });

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
  let reply = UPSTREAM_FALLBACK[lang];
  let source = 'fallback';
  try {
    const resp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { role: 'system', parts: [{ text: system }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    });
    if (resp.status === 429) {
      source = 'quota_exceeded';
    } else if (!resp.ok) {
      source = `gemini_${resp.status}`;
    } else {
      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) { reply = text.trim(); source = 'gemini'; }
    }
  } catch (err) {
    console.error('gemini call failed', err);
    source = 'exception';
  }

  return json({ ok: true, reply, source });
});
```

- [ ] **Step 8.2: Deploy `ask-figure` via Supabase MCP**

Use `mcp__supabase__deploy_edge_function`:
- `name`: `ask-figure`
- `entrypoint_path`: `index.ts`
- `verify_jwt`: **`false`** (this is the anonymous endpoint)
- `files`: array with four entries — `_shared/cors.ts` (copy from existing `supabase/functions/_shared/cors.ts`), `_shared/ip.ts`, `_shared/rate-limit.ts`, `index.ts`

Expected: `status: "ACTIVE"` in response.

- [ ] **Step 8.3: Wire the hook to call it (replace the Tier 2 stub)**

Open `src/hooks/useFigureChat.js` and replace the block that currently says `// Tier 2: edge function (stub for now...)` through the end of `send`'s try-path with this:

```js
    // Tier 2: edge function.
    try {
      const history = messages
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text }));
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.functions.invoke('ask-figure', {
        body: {
          figure: {
            name: figure.name,
            yrs: figure.yrs,
            role: figure.role,
            bio: figure.bio,
            achs: figure.achs,
            fact: figure.fact,
            quote: figure.quote,
            qattr: figure.qattr,
          },
          question: userMsg.text,
          lang,
          history,
        },
      });
      const text = (!error && data?.ok && data.reply)
        ? data.reply
        : UPSTREAM_FALLBACK[lang];
      pushMessage({ role: 'ai', text, lang, source: data?.source ?? 'error', ts: Date.now() });
    } catch (err) {
      console.error('ask-figure invoke failed', err);
      pushMessage({ role: 'ai', text: UPSTREAM_FALLBACK[lang], lang, source: 'exception', ts: Date.now() });
    }
    setBusy(false);
```

Also add at the top of `useFigureChat.js` (it's already exported near `__internals` — UPSTREAM_FALLBACK is in scope in this file).

- [ ] **Step 8.4: Manual verification (no Gemini key yet)**

1. Ensure `GEMINI_API_KEY` is **NOT** set in Supabase Edge Functions secrets.
2. Reload `/c/1` and ask a non-MN-rule-matched question like *"Чиний хамгийн дуртай морь юу байсан бэ?"*
3. Expected: after ~1s the reply is the `UPSTREAM_FALLBACK.mn` string ("my thoughts are unsettled"). Source in the payload is `no_key` — you can verify this in browser DevTools Network tab by inspecting the `ask-figure` response.

- [ ] **Step 8.5: (Optional, requires Gemini key) Set key and re-test**

If the user has a Gemini API key:
1. Go to Supabase dashboard → Project Settings → Edge Functions → Environment variables.
2. Add `GEMINI_API_KEY` = their key.
3. Redeploy is **not** needed — edge functions pick up new env on next invocation.
4. Ask the same question again.
5. Expected: a substantive first-person answer from Gemini (2–4 sentences).

If no key yet, mark this step complete — the feature still works via rule-based tier and upstream fallback.

- [ ] **Checkpoint 8:** `ask-figure` deployed and wired. Gemini answers are live if key is set, otherwise polite fallback.

---

## Task 9: `speak` edge function + client voice wiring

**Files:**
- Create: `mongol-history-hub (2)/supabase/functions/speak/index.ts`
- Modify: `mongol-history-hub (2)/src/pages/ScanChat.jsx` — replace the `speakClient` stub

- [ ] **Step 9.1: Write the `speak` function**

Write `supabase/functions/speak/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';
import { ipHash, currentHourBucket } from '../_shared/ip.ts';
import { checkAndIncrement } from '../_shared/rate-limit.ts';

const HOURLY_LIMIT = 10;
const BUCKET = 'voice-cache';

const VOICE_IDS: Record<string, string | undefined> = {
  mn: Deno.env.get('ELEVENLABS_VOICE_ID_MN'),
  en: Deno.env.get('ELEVENLABS_VOICE_ID_EN'),
  cn: Deno.env.get('ELEVENLABS_VOICE_ID_CN'),
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  let body: { text?: string; lang?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const lang = (body.lang === 'en' || body.lang === 'cn') ? body.lang : 'mn';
  const text = body.text?.trim() ?? '';
  if (!text || text.length > 800) {
    return json({ ok: false, fallback: 'web-speech', reason: 'bad_text' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Rate limit.
  const hashVal = await ipHash(req);
  const bucket = currentHourBucket();
  const limit = await checkAndIncrement(admin, hashVal, bucket, 'speak', HOURLY_LIMIT);
  if (!limit.allowed) {
    return json({ ok: false, fallback: 'web-speech', reason: 'rate_limited' });
  }

  const voiceId = VOICE_IDS[lang];
  const elevenKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!voiceId || !elevenKey) {
    return json({ ok: false, fallback: 'web-speech', reason: 'no_key' });
  }

  // Cache lookup.
  const key = await sha256Hex(`${lang}|${voiceId}|${text}`);
  const path = `${key}.mp3`;
  const { data: publicData } = admin.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = publicData.publicUrl;

  // Probe whether the object actually exists by HEAD-ing it.
  try {
    const head = await fetch(publicUrl, { method: 'HEAD' });
    if (head.ok) {
      return json({ ok: true, url: publicUrl, cached: true });
    }
  } catch { /* fall through to generate */ }

  // Cache miss → call ElevenLabs.
  try {
    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenKey,
        'accept': 'audio/mpeg',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.7 },
      }),
    });
    if (resp.status === 429 || !resp.ok) {
      return json({ ok: false, fallback: 'web-speech', reason: `eleven_${resp.status}` });
    }
    const audio = new Uint8Array(await resp.arrayBuffer());
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, audio, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
    if (upErr) {
      console.error('voice-cache upload failed', upErr);
      return json({ ok: false, fallback: 'web-speech', reason: 'upload_failed' });
    }
    return json({ ok: true, url: publicUrl, cached: false });
  } catch (err) {
    console.error('elevenlabs call failed', err);
    return json({ ok: false, fallback: 'web-speech', reason: 'exception' });
  }
});
```

- [ ] **Step 9.2: Deploy `speak` via Supabase MCP**

Use `mcp__supabase__deploy_edge_function`:
- `name`: `speak`
- `entrypoint_path`: `index.ts`
- `verify_jwt`: **`false`**
- `files`: array of `_shared/cors.ts`, `_shared/ip.ts`, `_shared/rate-limit.ts`, `index.ts`

Expected: `status: "ACTIVE"`.

- [ ] **Step 9.3: Replace `speakClient` in `ScanChat.jsx`**

In `src/pages/ScanChat.jsx`, replace the `speakClient` function at the bottom of the file with this version that tries the edge function first and falls back to browser TTS:

```jsx
async function speakClient(text, lang) {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.functions.invoke('speak', {
      body: { text, lang },
    });
    if (!error && data?.ok && data.url) {
      const audio = new Audio(data.url);
      audio.play().catch(() => speakWithWebSpeech(text, lang));
      return;
    }
  } catch { /* fall through */ }
  speakWithWebSpeech(text, lang);
}

function speakWithWebSpeech(text, lang) {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = { mn: 'mn-MN', en: 'en-US', cn: 'zh-CN' }[lang] ?? 'mn-MN';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
```

- [ ] **Step 9.4: Manual verification (no ElevenLabs key yet)**

1. Ensure `ELEVENLABS_API_KEY` is NOT set in Supabase Edge Function secrets.
2. Click 🔊 on any AI message at `/c/1`.
3. Expected: the edge function returns `{ ok: false, fallback: 'web-speech', reason: 'no_key' }` in ~200ms, then browser TTS speaks the text. From the user's perspective, voice works.

- [ ] **Step 9.5: (Optional, requires ElevenLabs key) Set keys and re-test**

If the user has an ElevenLabs account:
1. Pick one voice per language from the ElevenLabs Voice Library (any voice you like — for Mongolian, use a multilingual voice since there's no MN-native ElevenLabs voice).
2. In Supabase dashboard → Edge Functions secrets, set:
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_VOICE_ID_MN`
   - `ELEVENLABS_VOICE_ID_EN`
   - `ELEVENLABS_VOICE_ID_CN`
3. Click 🔊 on a message.
4. Expected: slight delay (~1–3s first time), then high-quality voice playback. Click 🔊 again on the same message — cache hit, faster playback, no ElevenLabs char spent.

Verify the cache by running `select count(*) from storage.objects where bucket_id = 'voice-cache';` via SQL. Should be ≥ 1 after a successful generation.

- [ ] **Checkpoint 9:** Voice works via ElevenLabs (if key set) or browser TTS (otherwise). Cache active.

---

## Task 10: End-to-end smoke test + cleanup

- [ ] **Step 10.1: Run all automated tests**

Run: `npm test`

Expected: all tests pass (should still just be the `figureResponder.test.js` from Task 2).

- [ ] **Step 10.2: Run lint**

Run: `npm run lint`

Expected: no errors in new files.

- [ ] **Step 10.3: Manual full-path verification**

In a clean incognito window:

1. Visit `http://localhost:5173/c/1` → chat loads with Chinggis greeting.
2. Ask *"Та юу хийсэн бэ?"* → rule-based reply lists achievements.
3. Ask *"Та хамгийн дуртай морь юу байсан бэ?"* → Gemini (if key) or fallback message.
4. Switch to EN → English greeting appears.
5. Ask *"Tell me about Börte"* in English → Gemini (if key) or English fallback.
6. Switch to CN → Chinese greeting.
7. Tap 🔊 on any message → voice plays.
8. Dismiss the signup banner → doesn't reappear on this tab.
9. Reload — messages persist (sessionStorage).
10. Visit `http://localhost:5173/c/52` → works with the 52nd figure.
11. Visit `http://localhost:5173/c/100` → ScanNotFound page.

- [ ] **Step 10.4: Rate-limit smoke test**

Only if you want to verify rate limiting: send 21 rapid messages from the same tab. The 21st reply should be the `RATE_LIMITED_FALLBACK.mn` message ("I am resting"). (Requires Gemini key; without, all replies are the same upstream fallback and you can't visually distinguish them — check the DB: `select count from rate_limits where endpoint='ask-figure' order by count desc limit 1` should be ≥ 20.)

- [ ] **Step 10.5: Mobile responsive check**

Open DevTools device mode (Ctrl+Shift+M) and test `/c/1` at:
- iPhone SE (375×667) — header shouldn't truncate, composer input sized, language pills wrap or stay inline.
- iPad (768×1024) — bubbles feel roomy, not too wide.

Fix any cramped layout inline.

- [ ] **Checkpoint 10:** Full flow shipped and verified.

---

## Out of Scope (Deferred)

These items are intentionally NOT part of this plan — bring them up in a follow-up plan if they become priorities:

- Saving the scan session to an authenticated user's collection after signup.
- Analytics/telemetry on scan counts per card.
- Offline-first PWA with cached rule-based responses.
- Pre-recorded human-voice audio per figure (higher-fidelity upgrade from ElevenLabs).
- Cross-figure memory (asking Chinggis about Börte and having him remember the question when you later scan Börte's card).
- Admin UI to view/clear the rate_limits table.
- Replacing the `HeroSection.jsx` mockup with a live iframe to `/c/1`.

---

## Spec ↔ Plan Coverage

| Spec Section | Covered By |
|---|---|
| §2 User Flow | Tasks 4, 5 |
| §3 Routes | Task 5 |
| §4 Tier 1 rule-based | Task 2 |
| §4 Tier 2 Gemini | Task 8 |
| §4 Tier 3 fallback strings | Tasks 4, 8 |
| §5 Voice + cache + fallback | Task 9 |
| §6 Rate limiting | Tasks 6, 7 (shared util) + 8, 9 (enforcement) |
| §7 Multi-turn sessionStorage | Task 4 |
| §8 Frontend work | Tasks 3, 4, 5 |
| §9 Backend work | Tasks 6, 7, 8, 9 |
| §10 Degradation matrix | Tasks 4, 8, 9 (error paths) + Task 10 verification |
| §11 Landing alignment | No-op (deferred polish) |
| §12 Acceptance criteria | Task 10 verifies each bullet |

All spec requirements map to at least one task. No orphans.

---

## Execution log

### 2026-04-24 — shipped

All 10 tasks landed on feature branch `feat/qr-ai-guide`. 78 vitest green; vite build exits clean. Two edge functions deployed ACTIVE (verify_jwt: false for anonymous access). One migration applied (rate_limits + voice-cache bucket).

**Deviations:**
- **Task 1 skipped.** Vitest was already configured in Phase 0+1 work with `jsdom` + React plugin (different from plan's `node` environment). Kept existing config.
- **Regex tightened in Task 2.** Plan's `/төрс(эн|ний)/` expects "төрсэн" or "төрсний"; the test input "төрсөн" uses ө not е. Loosened to `/төрс/` stem. Also reordered `who_are_you` before `role` so "Чи хэн бэ?" returns bio not role summary.
- **Styling pass in Tasks 3-5.** Plan used inline `style={{…}}` with hardcoded colour hex codes. Rewrote to Tailwind tokens (`bg-ink`, `text-ivory`, `border-brass/40`, ornament borders) to match the rest of the Codex UI.

**Runtime degradation matrix observed at ship time:**

| Secret missing | Behaviour |
|---|---|
| `GEMINI_API_KEY` | `ask-figure` returns `{ source: 'no_key' }` + UPSTREAM_FALLBACK string. UI renders it in-character. |
| `ELEVENLABS_API_KEY` (or voice ids) | `speak` returns `{ fallback: 'web-speech' }`. Client auto-swaps to `window.speechSynthesis`. User hears voice via browser TTS. |
| Both set | Full feature: Gemini answers, ElevenLabs cached voice on first tap, instant on subsequent taps. |

User needs to set these in Supabase dashboard → Project Settings → Edge Functions → Environment variables. No redeploy required after setting; functions pick up env on next invocation.

**Manual smoke (for the user's browser):**
1. Open http://localhost:5173/c/1 in a clean tab. Chinggis greets in MN. ✓ rule-based
2. Ask "Та хэзээ төрсөн бэ?" — instant `1162` answer. ✓ rule-based tier
3. Ask "Чиний хамгийн дуртай морь юу байсан бэ?" — 1–2 s delay, then UPSTREAM_FALLBACK (until Gemini key is set). ✓ graceful degrade
4. Tap 🔊 — browser TTS speaks it (no ElevenLabs key set). ✓ voice degrade
5. http://localhost:5173/c/999 → ScanNotFound page. ✓ 404
6. Reload `/c/1` — chat persists (sessionStorage). Close tab and reopen — chat resets.

**Known follow-ups:**
- Landing hero PhoneMockup still shows hardcoded teaser messages; low-priority iframe replacement later.
- Rate-limit implementation has a small read-then-write race window. Acceptable at MVP scale.
- No admin UI for `rate_limits` table. Manual `select` via SQL if needed.
