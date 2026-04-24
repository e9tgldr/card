-- Default app_settings
insert into app_settings (key, value) values
  ('site_name', 'Altan Domog'),
  ('site_logo', '')
on conflict (key) do nothing;

-- Bootstrap admin code. The first user to redeem it becomes the first admin.
insert into access_codes (code, grants_admin) values
  ('ADMIN001', true)
on conflict (code) do nothing;
