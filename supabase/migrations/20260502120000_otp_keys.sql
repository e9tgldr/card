-- =============================================================
-- OTP keys: 1000 single-use numeric signup codes (1..1000)
-- A user can sign up by entering a number 1..1000 plus a username/password.
-- Each number is single-use forever; once redeemed, it can never be reused.
-- Distinct from access_codes (invitation system) — these are self-serve.
-- =============================================================

create table if not exists otp_keys (
  number      int primary key check (number between 1 and 1000),
  -- on delete restrict: a redeemed key MUST stay traceable to its redeemer.
  -- combined with the redeemed_at sentinel below, this prevents a key from
  -- being recycled even if the FK ever ends up null via privileged DDL.
  redeemed_by uuid references auth.users(id) on delete restrict,
  redeemed_at timestamptz,
  created_at  timestamptz default now()
);

-- Pre-seed all 1000 numbers (idempotent — re-running this migration is safe).
insert into otp_keys (number)
select g
from generate_series(1, 1000) as g
on conflict (number) do nothing;

-- Lock the table down: only the service role (used by the edge function) can
-- read or update. Anon and authenticated roles get nothing — preventing
-- enumeration of which numbers are still available, and preventing any client
-- from marking a row redeemed itself.
alter table otp_keys enable row level security;

revoke all on otp_keys from anon, authenticated;
-- service_role bypasses RLS by default (postgres role attribute) so no policy
-- needed for it. Explicitly NO policies for anon/authenticated => deny-all.

comment on table  otp_keys is
  'Single-use numeric signup codes (1..1000). Redemption goes through the redeem-otp-key edge function (service-role only). Distinct from access_codes (invitation flow).';
comment on column otp_keys.redeemed_by is
  'auth.users.id of the account created from this number. NULL = number is still unused.';
