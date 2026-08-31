insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-study-assets', 'case-study-assets', true, 26214400, array['image/svg+xml'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
