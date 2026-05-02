-- =============================================================
-- OTP keys: recycle the number when its redeemer's account is deleted.
--
-- Original migration 20260502120000 used ON DELETE RESTRICT + a redeemed_at
-- sentinel to keep keys permanently consumed. Per product requirement, deleting
-- an account should free that number back into the unused pool so the limited
-- 1000-key supply isn't wasted on churned accounts.
--
-- Switch the FK to SET NULL and add a BEFORE DELETE trigger on auth.users that
-- ALSO clears redeemed_at — without that, the FK cascade would null only
-- redeemed_by while leaving redeemed_at populated, and the edge function's
-- belt-and-suspenders check (`redeemed_at IS NULL`) would still reject reuse.
-- =============================================================

-- 1. Drop the RESTRICT constraint and recreate it as SET NULL.
alter table public.otp_keys
  drop constraint otp_keys_redeemed_by_fkey;

alter table public.otp_keys
  add constraint otp_keys_redeemed_by_fkey
  foreign key (redeemed_by) references auth.users(id) on delete set null;

-- 2. Trigger function: when an auth user is deleted, fully reset any otp_key
--    they consumed. SECURITY DEFINER so the trigger can write to
--    public.otp_keys regardless of who triggered the user delete.
--    Empty search_path forces every name in the body to be schema-qualified
--    (Supabase-recommended hardening — prevents shadowing attacks).
create or replace function public.recycle_otp_key_on_user_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.otp_keys
    set redeemed_by = null,
        redeemed_at = null
    where redeemed_by = old.id;
  return old;
end;
$$;

-- The function is invoked by the trigger on auth.users; nobody else needs to
-- call it. Strip the default PUBLIC EXECUTE so it can't be used as a vector.
revoke execute on function public.recycle_otp_key_on_user_delete() from public;

-- 3. Fire BEFORE DELETE so the row update is part of the same statement and
--    propagates ahead of the FK cascade.
drop trigger if exists recycle_otp_key_on_user_delete on auth.users;
create trigger recycle_otp_key_on_user_delete
  before delete on auth.users
  for each row execute function public.recycle_otp_key_on_user_delete();

-- 4. Speed up the trigger's WHERE redeemed_by = $1 lookup. Sparse index since
--    most rows have NULL redeemed_by (unused keys).
create index if not exists otp_keys_redeemed_by_idx
  on public.otp_keys (redeemed_by)
  where redeemed_by is not null;

comment on function public.recycle_otp_key_on_user_delete() is
  'Frees an otp_key (clears redeemed_by + redeemed_at) when its redeemer is deleted. Required because clearing redeemed_by alone is not enough — the redeem-otp-key edge function checks both fields.';
