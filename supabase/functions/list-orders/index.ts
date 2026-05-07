import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleOptions, json } from '../_shared/cors.ts';

// Default and hard cap for the page size. Default keeps the admin-panel
// payload bounded as the orders table grows; hard cap prevents a misbehaving
// client from requesting the whole table at once.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

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

  // Re-verify admin against profiles, not just JWT — a demoted admin's JWT may
  // still carry app_metadata.is_admin = true until refresh.
  const { data: prof } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (!prof?.is_admin) return json({ ok: false, reason: 'forbidden' }, 403);

  let body: { limit?: number; before?: string };
  try { body = req.headers.get('content-length') === '0' ? {} : await req.json(); }
  catch { body = {}; }
  const requested = Number(body.limit ?? DEFAULT_LIMIT);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Math.floor(Number.isFinite(requested) ? requested : DEFAULT_LIMIT)));
  const before = typeof body.before === 'string' && body.before ? body.before : null;

  let q = admin
    .from('orders')
    .select('id, tier, customer_name, customer_phone, customer_address, notes, status, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (before) q = q.lt('created_at', before);

  const { data, error } = await q;
  if (error) return json({ ok: false, reason: error.message }, 500);

  return json({
    ok: true,
    orders: data ?? [],
    limit,
    has_more: (data?.length ?? 0) === limit,
  });
});
