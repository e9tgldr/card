-- Enable pgcrypto for gen_random_uuid()
create extension if not exists pgcrypto;

-- =============================================================
-- Tables
-- =============================================================

create table figures (
  id uuid primary key default gen_random_uuid(),
  fig_id integer unique not null check (fig_id between 1 and 999),
  cat text check (cat in ('khans','queens','warriors','political','cultural')),
  ico text,
  card text,
  name text,
  yrs text,
  role text,
  bio text,
  achs text[] default '{}',
  fact text,
  quote text,
  qattr text,
  rel integer[] default '{}',
  front_img text,
  back_img text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique not null,
  fig_ids integer[] default '{}',
  earned_at jsonb default '{}'::jsonb,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table app_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value text,
  created_date timestamptz default now(),
  updated_date timestamptz default now()
);

create table access_codes (
  code text primary key,
  grants_admin boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- =============================================================
-- Triggers: keep updated_date current
-- =============================================================

create or replace function set_updated_date()
returns trigger language plpgsql as $$
begin
  new.updated_date := now();
  return new;
end;
$$;

create trigger figures_updated before update on figures
  for each row execute function set_updated_date();
create trigger collections_updated before update on collections
  for each row execute function set_updated_date();
create trigger app_settings_updated before update on app_settings
  for each row execute function set_updated_date();

-- =============================================================
-- Trigger: create profile row when auth.users row is inserted.
-- Reads username from raw_user_meta_data.username and is_admin from
-- raw_app_meta_data.is_admin. The redeem-code Edge Function sets both.
-- =============================================================

create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data->>'is_admin')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- =============================================================
-- RLS: enable on everything
-- =============================================================

alter table figures       enable row level security;
alter table collections   enable row level security;
alter table app_settings  enable row level security;
alter table access_codes  enable row level security;
alter table profiles      enable row level security;

-- Helper: is the current caller an admin per JWT claim?
create or replace function is_admin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt()->'app_metadata'->>'is_admin')::boolean, false);
$$;

-- --- figures ---
create policy "figures readable by everyone"
  on figures for select using (true);
create policy "figures writable by admins"
  on figures for all using (is_admin()) with check (is_admin());

-- --- app_settings ---
create policy "app_settings readable by everyone"
  on app_settings for select using (true);
create policy "app_settings writable by admins"
  on app_settings for all using (is_admin()) with check (is_admin());

-- --- collections ---
create policy "collections readable by owner"
  on collections for select using (auth.uid() = user_id);
create policy "collections writable by owner"
  on collections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- access_codes --- (no client access; Edge Functions use service role)
-- no policies = no rows visible to anon/authenticated. Service role bypasses RLS.

-- --- profiles ---
create policy "profiles self-read"
  on profiles for select using (auth.uid() = id);
create policy "profiles readable by admins"
  on profiles for select using (is_admin());
-- Users can update their own username but not their is_admin flag.
-- We enforce the is_admin guard via a column grant rather than a self-referencing
-- policy subquery (which would recurse through RLS).
create policy "profiles self-update"
  on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update (is_admin) on profiles from authenticated, anon;

-- =============================================================
-- Realtime: enable for entities used by base44.*.subscribe()
-- =============================================================

alter publication supabase_realtime add table figures;
alter publication supabase_realtime add table collections;
alter publication supabase_realtime add table app_settings;
