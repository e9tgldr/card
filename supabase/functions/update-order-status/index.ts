import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

const ALLOWED_STATUSES = ['pending', 'confirmed', 'shipped', 'cancelled'] as const;

Deno.serve(async (req) => {
  const pre = handleOptions(req); if (pre) return pre;
  if (req.method !== 'POST') return json({ ok: false, reason: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) return json({ ok: false, reason: 'unauthenticated' }, 401);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: prof } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (!prof?.is_admin) return json({ ok: false, reason: 'forbidden' }, 403);

  let body: { id?: string; status?: string };
  try { body = await req.json(); } catch { return json({ ok: false, reason: 'bad_body' }, 400); }
  const id = (body.id ?? '').trim();
  const status = (body.status ?? '').trim();
  if (!id) return json({ ok: false, reason: 'missing_id' }, 400);
  if (!(ALLOWED_STATUSES as readonly string[]).includes(status)) {
    return json({ ok: false, reason: 'bad_status' }, 400);
  }

  const { data, error } = await admin
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select('id, status')
    .maybeSingle();
  if (error) return json({ ok: false, reason: error.message }, 500);
  if (!data) return json({ ok: false, reason: 'not_found' }, 404);

  return json({ ok: true, order: data });
});
