-- 20260428000000_single_device_sessions.sql
-- Single-device sign-in: tracks the current active session per non-admin user.

create table public.active_sessions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  session_id   uuid not null,
  last_seen    timestamptz not null default now(),
  device_label text,
  created_at   timestamptz not null default now()
);

create index active_sessions_last_seen_idx on public.active_sessions(last_seen);

alter table public.active_sessions enable row level security;
-- No policies: only the service role (used by edge fns) may read or write.

-- Atomic claim. Locks the existing row (if any) under FOR UPDATE so concurrent
-- logins for the same user serialise; the second caller observes the first
-- caller's row state. Returns claimed=false (blocked) when an existing row is
-- still fresh and force is not set.
create or replace function public.claim_session_atomic(
  p_user_id        uuid,
  p_session_id     uuid,
  p_device_label   text,
  p_force          boolean,
  p_stale_seconds  integer
)
returns table (
  claimed              boolean,
  previous_session_id  uuid,
  session_id           uuid,
  last_seen            timestamptz,
  device_label         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing record;
begin
  select a.session_id as sid, a.last_seen as ls, a.device_label as dl
    into v_existing
  from public.active_sessions a
  where a.user_id = p_user_id
  for update;

  if not found then
    insert into public.active_sessions (user_id, session_id, last_seen, device_label)
      values (p_user_id, p_session_id, now(), p_device_label);
    return query select true, null::uuid, p_session_id, now(), p_device_label;
    return;
  end if;

  if v_existing.ls < now() - make_interval(secs => p_stale_seconds) or p_force then
    update public.active_sessions
       set session_id   = p_session_id,
           last_seen    = now(),
           device_label = p_device_label
     where user_id = p_user_id;
    return query
      select true,
             case when v_existing.sid <> p_session_id then v_existing.sid else null end,
             p_session_id, now(), p_device_label;
    return;
  end if;

  return query select false, null::uuid, v_existing.sid, v_existing.ls, v_existing.dl;
end;
$$;

revoke all on function public.claim_session_atomic(uuid, uuid, text, boolean, integer) from public;
grant execute on function public.claim_session_atomic(uuid, uuid, text, boolean, integer) to service_role;
