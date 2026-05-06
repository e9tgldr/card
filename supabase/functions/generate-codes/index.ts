import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LEN = 8;
const MAX_BATCH = 1500;

function randomCode(): string {
  const buf = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(buf);
  let s = '';
  for (const b of buf) s += ALPHABET[b % ALPHABET.length];
  return s;
}

Deno.serve(async (req) => {
  const preflight = handleOptions(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return json({ ok: false, reason: 'method_not_allowed' }, 405);
  }

  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer /, '');
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ ok: false, reason: 'unauthorized' }, 401);
  const isAdmin = !!userData.user.app_metadata?.is_admin;
  if (!isAdmin) return json({ ok: false, reason: 'forbidden' }, 403);

  let body: { count?: number; grants_admin?: boolean };
  try { body = await req.json(); }
  catch { return json({ ok: false, reason: 'bad_request' }, 400); }

  const count = Math.max(1, Math.min(MAX_BATCH, Math.floor(body.count ?? 1)));
  const grantsAdmin = !!body.grants_admin;

  const admin = createClient(url, serviceKey);
  const created: string[] = [];

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomCode();
      const { error } = await admin
        .from('access_codes')
        .insert({ code, grants_admin: grantsAdmin, created_by: userData.user.id });
      if (!error) { created.push(code); break; }
      if (!error.message?.includes('duplicate')) {
        return json({ ok: false, reason: error.message }, 500);
      }
    }
  }

  return json({ ok: true, codes: created });
});
