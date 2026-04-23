-- Public read bucket for figure images. Admin-only write.
insert into storage.buckets (id, name, public)
values ('figure-images', 'figure-images', true)
on conflict (id) do nothing;

create policy "figure-images public read"
  on storage.objects for select
  using (bucket_id = 'figure-images');

create policy "figure-images admin write"
  on storage.objects for insert
  with check (bucket_id = 'figure-images' and is_admin());

create policy "figure-images admin update"
  on storage.objects for update
  using (bucket_id = 'figure-images' and is_admin());

create policy "figure-images admin delete"
  on storage.objects for delete
  using (bucket_id = 'figure-images' and is_admin());
