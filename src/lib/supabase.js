import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error('Supabase env vars missing. Copy .env.example to .env and fill in values.');
}

const SESSION_ID_KEY = 'mhh.device_session_id';

// Attach X-Session-Id to edge function invocations only. Supabase REST / RPC /
// auth / storage requests go through a gateway whose CORS allowlist we don't
// control, so adding the header there would fail preflight. Edge functions
// share our own _shared/cors.ts which we've extended to allow it.
const wrappedFetch = (input, init = {}) => {
  const u = typeof input === 'string' ? input : input.url;
  if (typeof u === 'string' && u.includes('/functions/v1/') && typeof window !== 'undefined') {
    const sid = (() => { try { return window.localStorage.getItem(SESSION_ID_KEY); } catch { return null; } })();
    if (sid) {
      const headers = new Headers(init.headers || {});
      if (!headers.has('x-session-id')) headers.set('x-session-id', sid);
      return fetch(input, { ...init, headers });
    }
  }
  return fetch(input, init);
};

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: { fetch: wrappedFetch },
});

export const usernameToEmail = (username) => `${username.trim().toLowerCase()}@users.local`;
export const emailToUsername = (email) => email?.replace(/@users\.local$/, '') || null;
