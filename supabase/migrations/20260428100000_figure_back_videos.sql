-- 20260428100000_figure_back_videos.sql
-- Per-figure back-of-card video + WebVTT captions, admin-uploaded.
create table if not exists public.figure_back_videos (
  fig_id        int  primary key,
  video_path    text not null,
  captions_path text,
  duration_s    real,
  uploaded_by   uuid references auth.users(id),
  uploaded_at   timestamptz not null default now()
);

alter table public.figure_back_videos enable row level security;

create policy "back_videos public read"
  on public.figure_back_videos for select using (true);

create policy "back_videos admin write"
  on public.figure_back_videos for all using (is_admin()) with check (is_admin());
