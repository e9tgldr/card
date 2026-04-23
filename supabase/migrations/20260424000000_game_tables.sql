-- Quote-game multiplayer: core tables (Phase 0).
-- Tournaments first (game_sessions FKs to it).

create table tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  seed        text not null,
  lang        text not null check (lang in ('mn','en')),
  round_size  int  not null default 10 check (round_size between 5 and 20),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  created_by  uuid not null references auth.users(id) on delete restrict,
  published   boolean not null default false,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table game_sessions (
  id             uuid primary key default gen_random_uuid(),
  seed           text not null,
  mode           text not null check (mode in ('solo','async_duel','live_room','tournament')),
  lang           text not null check (lang in ('mn','en')),
  round_size     int  not null default 10 check (round_size between 5 and 20),
  host_user_id   uuid not null references auth.users(id) on delete cascade,
  tournament_id  uuid references tournaments(id) on delete set null,
  status         text not null default 'open'
                   check (status in ('open','in_progress','complete','abandoned')),
  join_code      text unique,
  timer_s        int check (timer_s in (10, 15, 20)),
  player_cap     int default 8 check (player_cap between 2 and 8),
  expires_at     timestamptz,
  created_at     timestamptz not null default now(),
  starts_at      timestamptz,
  ends_at        timestamptz
);

create index game_sessions_join_code_idx
  on game_sessions (join_code) where join_code is not null;
create index game_sessions_tournament_id_idx
  on game_sessions (tournament_id);
create index game_sessions_open_expires_idx
  on game_sessions (status, expires_at) where status = 'open';

create table game_participants (
  session_id  uuid not null references game_sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- tournament_id denormalized from session so we can build a unique partial index.
create table game_results (
  session_id    uuid not null references game_sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  tournament_id uuid references tournaments(id) on delete set null,
  score         int  not null check (score >= 0),
  total         int  not null check (total > 0),
  answers       jsonb not null,
  completed_at  timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index game_results_user_completed_idx
  on game_results (user_id, completed_at desc);
create index game_results_session_idx
  on game_results (session_id);
create unique index game_results_unique_per_tournament
  on game_results (user_id, tournament_id) where tournament_id is not null;
