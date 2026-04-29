-- 20260429000000_ar_target_column.sql
-- Adds the MindAR .mind target file path to the existing per-figure back-video table.
-- A figure is "AR-ready" iff both video_path and ar_target_path are non-null.
alter table public.figure_back_videos
  add column if not exists ar_target_path text;
