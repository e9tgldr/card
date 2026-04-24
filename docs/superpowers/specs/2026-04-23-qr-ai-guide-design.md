# QR-to-AI Guide — Design

**Date:** 2026-04-23
**Status:** Approved
**Scope:** Anonymous QR-code scan flow from physical playing cards into a live, first-person AI chat with the figure on the card.

---

## 1. Goal and Principles

Deliver the "scan the card, talk to history" experience the landing page advertises:
- **Zero friction on scan.** No login, no app install, no consent wall.
- **Free to operate at MVP scale.** Use rule-based responses as the floor and free-tier LLM/TTS on top.
- **Always answer.** Never surface a raw error; degrade gracefully.
- **In-character.** The figure speaks in first-person, in the language the user asked in.

Non-goals (explicitly out of scope for MVP):
- Saving to a personal collection from the scan flow (link out to signup instead).
- Scan analytics dashboard.
- Offline PWA caching.
- Pre-recorded human-voice narration.
- Cross-figure memory.

---

## 2. User Flow

1. User scans the QR printed on a physical card.
2. Browser opens `https://<domain>/c/<figId>` where `figId ∈ [1, 52]`.
3. Page loads **directly into the chat UI** — anonymous session, no gate.
4. First AI message auto-sent in Mongolian (default): *"Би бол <name>. Та надаас юу асуух вэ?"*
5. A language pill (MN / EN / CN) at the top switches the conversation language for the next AI reply.
6. Each AI message has a small 🔊 icon. Tapping triggers voice playback (ElevenLabs with cache → Web Speech fallback).
7. A dismissible bottom banner reads *"Цуглуулгадаа нэм"* — tapping routes to `/otp?next=/collection` (existing auth flow).
8. Invalid `figId` (e.g. `/c/999`) shows a styled "Card not recognized" page.

---

## 3. Routes

| Path | Auth | Component | Purpose |
|---|---|---|---|
| `/c/:figId` | none | `ScanChat` | **New.** Public scan landing = chat UI. |
| `/otp`, `/app`, `/collection`, `/figure/:figId`, `/tour`, `/games/quotes` | as today | unchanged | unchanged |

QR payload = full URL, no signing. `figId` validity is enforced by the DB `check (fig_id between 1 and 999)` and by the client rendering the error page if the id isn't in `FIGURES`.

---

## 4. AI Strategy — Three-Tier Priority Ladder

For every user message, the client asks in order:

### Tier 1 — Rule-based floor (Mongolian only, client-side)
- Lives in `src/lib/figureResponder.js`.
- Matches user input against ~12 intent patterns via keyword/regex:
  - birth year, death year, lifespan, role, achievements list, famous quote, random fact, family/relationships, "who are you", "what did you do", "when did you die", "where did you live".
- For each intent, a first-person MN template pulls from the figure's static fields (`bio`, `achs`, `fact`, `quote`, `yrs`, `role`, `rel`) and wraps with a natural sentence.
- **Returns only if high-confidence match** (intent hit AND required field present). Otherwise passes through to Tier 2.
- EN/CN user messages always skip Tier 1 and go to Tier 2.

### Tier 2 — Gemini 2.5 Flash via edge function `ask-figure`
- Server-side: new Supabase edge function, public (`verify_jwt: false`), IP-rate-limited.
- System prompt constructed per-request from the figure's data:

```
You are {{name}}, a Mongolian historical figure who lived {{yrs}}.
Role: {{role}}.
Your life story (ground truth — never contradict):
  {{bio}}
Your documented achievements:
  {{achs joined with newlines}}
Your famous quote: "{{quote}}" — {{qattr}}
A notable fact about you: {{fact}}

Rules:
- Speak in first person as {{name}}, in {{target_language}}.
- Stay in character. Refer to your own life with "I" and "my".
- If asked about events after your death ({{death_year}}) or matters
  outside your documented life, say so in-character: e.g., "I cannot
  know this — I had already passed away by then."
- Answer in ≤ 3 short paragraphs. Prefer concrete details from the
  ground truth over speculation.
- Never break character to mention you are an AI.
```
- Client sends the last ~8 turns of conversation from `sessionStorage` as context.
- Model: `gemini-2.5-flash` (free tier generous for MVP scale).
- Returns text body + `lang` the model answered in.

### Tier 3 — Quota-exhausted / upstream error fallback
- If Gemini returns 429 or any upstream failure, edge function returns HTTP 200 with a pre-baked in-character deflection in the requested language:
  - MN: *"Уучлаарай, миний бодол санаа одоо тогтворгүй байна. Дараа дахин асуугаарай."*
  - EN: *"Forgive me — my thoughts are unsettled right now. Ask me again later."*
  - CN: *"抱歉，此刻我的思绪不宁。请稍后再问。"*
- Client treats this response identically to a real reply and displays it. Never surfaces a raw error.

---

## 5. Voice (ElevenLabs, aggressively cached, free-tier compatible)

- **On-demand only.** Voice is never auto-played. User taps 🔊 on a specific AI message to hear it.
- New edge function `speak`:
  1. Rate-limit check (tighter ceiling, see §6).
  2. Compute `key = sha256(lang + voice_id + text)`.
  3. Check `voice-cache` Supabase Storage bucket for `<key>.mp3`. If present, return public URL. **No ElevenLabs call.**
  4. Cache miss → POST to ElevenLabs `/text-to-speech`, stream response, upload to bucket, return URL.
- Cache is forever-immutable per key. Rule-based answers (birth year, quote, etc.) pay the ElevenLabs chars once, then are free for all subsequent scanners.
- **If ElevenLabs returns quota-exceeded**, edge function returns `{ ok: false, fallback: "web-speech" }`. The client then falls back to browser `speechSynthesis` automatically (MN voice coverage is limited in browsers but EN/CN are fine).

ElevenLabs voice_id choice: one voice per language (MN, EN, CN). Voices picked later; three string IDs in env.

---

## 6. Anti-Abuse (Rate Limiting)

- New DB table:

```sql
create table rate_limits (
  ip_hash text not null,
  bucket_hour text not null,  -- e.g., "2026-04-23T14"
  endpoint text not null,     -- "ask-figure" | "speak"
  count int not null default 0,
  primary key (ip_hash, bucket_hour, endpoint)
);
alter table rate_limits enable row level security;
-- no policies → no client access. Edge functions use service role.
```

- Both edge functions:
  1. Derive `ip_hash = sha256(request.headers['cf-connecting-ip'] ?? request.headers['x-forwarded-for'])`.
  2. Upsert `(ip_hash, current_hour, endpoint)` incrementing count by 1 atomically.
  3. Enforce limits: **`ask-figure`: 20/hr/IP. `speak`: 10/hr/IP.**
  4. Over limit → return 200 with in-character "I am resting" message (for `ask-figure`) or `{ ok: false, fallback: "web-speech" }` (for `speak`).

Shared-NAT risk: office WiFi may rate-limit collectively. Accepted for MVP; if it bites, switch to a token-bucket with burst tolerance later.

---

## 7. Multi-Turn Memory

- **Client-side only.** `sessionStorage` key `chat:fig:<figId>`.
- Last 20 user+AI turns retained (auto-trimmed).
- Cleared on tab close. No server-side chat log.
- Implications: no RLS work, no privacy surface, nothing to leak. Re-scanning the same card tomorrow starts fresh — acceptable for a public kiosk-style experience.

---

## 8. Frontend Work

New files:

| File | Purpose |
|---|---|
| `src/pages/ScanChat.jsx` | Page component. Figure header strip, language pill, chat viewport, input, dismissible signup banner. |
| `src/hooks/useFigureChat.js` | Message state, language state, rule-based-then-edge-function orchestrator, 429/error handling, sessionStorage persistence. |
| `src/lib/figureResponder.js` | Rule-based intent matcher + MN templates. Exports `tryAnswer(figure, question, lang) → string \| null`. |
| `src/components/ScanNotFound.jsx` | 404-style page for invalid `figId`. |

Modified files:

| File | Change |
|---|---|
| `src/App.jsx` | Add `<Route path="/c/:figId" element={<ScanChat />} />` **outside** the `OtpGate` wrapper (public route). |

Reuse:
- Existing `useLang` hook and `LangProvider` for the language pill.
- Visual language from `ChatFAB.jsx` (bubble styling, fade animations) to stay consistent with the authenticated chat.
- Figure data already in `src/lib/figuresData.js` (client-side import; no DB fetch needed for the figure record).

---

## 9. Backend Work

New edge functions (directory names):

| Function | `verify_jwt` | Purpose |
|---|---|---|
| `supabase/functions/ask-figure/index.ts` | `false` | Rate-limit → build persona prompt → call Gemini → return reply. |
| `supabase/functions/speak/index.ts` | `false` | Rate-limit → cache lookup → call ElevenLabs on miss → return audio URL. |

Shared utilities in `supabase/functions/_shared/`:
- `rate-limit.ts` — `checkAndIncrement(supabaseAdmin, ipHash, endpoint, hourlyLimit)` returning `{ allowed: boolean, remaining: number }`.
- `ip.ts` — hash the request's origin IP.

New migration `20260424000000_qr_ai_guide.sql`:
- Create `rate_limits` table + RLS.
- Create Storage bucket `voice-cache` (public read).
- Storage policy: public read on `voice-cache`, service-role only for insert/update/delete.

Secrets to set in Supabase project settings → Edge Functions:
- `GEMINI_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID_MN`
- `ELEVENLABS_VOICE_ID_EN`
- `ELEVENLABS_VOICE_ID_CN`

---

## 10. Error Handling & Degradation Matrix

| Failure | User sees |
|---|---|
| Invalid `figId` in URL | Styled "Card not recognized" page with link to `/` landing |
| Rule-based floor no match | Request goes to Gemini — user sees a longer pause (~1s), nothing bad |
| Gemini 429 / upstream error | Pre-baked in-character "thoughts unsettled" message in requested language |
| IP rate limit on `ask-figure` | In-character "I am resting" message |
| ElevenLabs 429 | 🔊 button still works — browser `speechSynthesis` takes over |
| IP rate limit on `speak` | 🔊 button silently falls back to browser TTS |
| No internet at all | Tier 1 rule-based still answers in MN for matched intents; otherwise static error page |

---

## 11. Landing Page Alignment

The existing hero section already depicts the exact flow (scan → chat with figure). Once this feature ships:
- Keep the hero mockup animation as-is for MVP (works as marketing).
- Optional v1.1 polish: replace the hardcoded messages in `HeroSection.jsx`'s `PhoneMockup` with a small live iframe to `/c/1`. Low-priority enhancement.

No changes required to copy — the §1 hero paragraph already says "QR уншуулмагц AI хөтөч амьсгалтай ярьж өгнө."

---

## 12. Open Questions / Acceptance Criteria

### Acceptance
- Scanning a printed QR for card #1 (Chinggis) on a cold browser session reaches a working chat within 2 seconds on mobile 4G.
- Asking "Та хэзээ төрсөн бэ?" in Mongolian returns a correct answer from the rule-based tier (no LLM call).
- Asking "What did you think of Börte?" in English returns a plausible first-person reply from Gemini.
- Tapping 🔊 on the same message twice in a row only triggers ElevenLabs once (second tap hits the cache).
- 21st message from the same IP within an hour gets an in-character "I am resting" reply.

### Deferred until after first user feedback
- Mobile tap-to-copy for the dismissible banner URL.
- Share button to send the chat to a friend.
- Saving the scan as "last card scanned" in localStorage for the authenticated app.
