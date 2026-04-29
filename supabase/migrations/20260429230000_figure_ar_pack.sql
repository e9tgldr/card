-- 20260429230000_figure_ar_pack.sql
-- Singleton row holding the combined MindAR pack (one .mind file with all 52 card targets).
-- target_order[i] = fig_id of the i-th MindAR target inside the pack.
create table if not exists public.figure_ar_pack (
  id smallint primary key default 1,
  pack_path text not null,
  target_order int[] not null,
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now(),
  constraint figure_ar_pack_singleton check (id = 1)
);

alter table public.figure_ar_pack enable row level security;

drop policy if exists "anon read pack" on public.figure_ar_pack;
create policy "anon read pack" on public.figure_ar_pack
  for select to anon, authenticated using (true);
