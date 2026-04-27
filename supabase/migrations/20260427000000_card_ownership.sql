-- Card identification system: per-user ownership records and persistent chats.

create table card_ownership (
  user_id    uuid not null references auth.users(id) on delete cascade,
  fig_id     int  not null,
  scanned_at timestamptz not null default now(),
  primary key (user_id, fig_id)
);

alter table card_ownership enable row level security;

create policy "card_ownership self read"
  on card_ownership for select
  using (user_id = auth.uid());
-- No client insert/update/delete policies: only service role (edge fn) writes.

create table card_chats (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  fig_id     int         not null,
  messages   jsonb       not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, fig_id)
);

alter table card_chats enable row level security;

create policy "card_chats self read"
  on card_chats for select using (user_id = auth.uid());
create policy "card_chats self insert"
  on card_chats for insert with check (user_id = auth.uid());
create policy "card_chats self update"
  on card_chats for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function set_card_chats_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger card_chats_updated before update on card_chats
  for each row execute function set_card_chats_updated_at();

alter table profiles add column starter_granted_at timestamptz;
