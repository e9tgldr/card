-- 20260429220000_model_path_column.sql
-- Adds an optional .glb model path to the existing per-figure back-video table.
-- When set, the AR view mounts a 3D glTF model on the detected card instead of the flat video plane.
alter table public.figure_back_videos
  add column if not exists model_path text;
