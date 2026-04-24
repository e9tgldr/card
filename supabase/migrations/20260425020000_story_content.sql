-- Phase C: authored per-figure stories + per-era intros/outros.
create table story_content (
  slug        text not null,
  lang        text not null check (lang in ('mn','en')),
  text        text not null default '',
  status      text not null default 'draft' check (status in ('draft','published')),
  updated_by  uuid references auth.users(id),
  updated_at  timestamptz not null default now(),
  primary key (slug, lang)
);

alter table story_content enable row level security;

create policy "published read" on story_content for select using (status = 'published');
create policy "admin read all" on story_content for select using (is_admin());
create policy "admin write"    on story_content for all    using (is_admin());
