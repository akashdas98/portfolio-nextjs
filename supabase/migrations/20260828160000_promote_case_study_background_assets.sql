insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'case-study-assets',
  'case-study-assets',
  true,
  5242880,
  array['image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin users insert case-study assets" on storage.objects;
create policy "Admin users insert case-study assets"
on storage.objects for insert
to authenticated
with check (bucket_id = 'case-study-assets' and public.is_admin_user());

drop policy if exists "Admin users update case-study assets" on storage.objects;
create policy "Admin users update case-study assets"
on storage.objects for update
to authenticated
using (bucket_id = 'case-study-assets' and public.is_admin_user())
with check (bucket_id = 'case-study-assets' and public.is_admin_user());

drop policy if exists "Admin users delete case-study assets" on storage.objects;
create policy "Admin users delete case-study assets"
on storage.objects for delete
to authenticated
using (bucket_id = 'case-study-assets' and public.is_admin_user());

update public.projects
set case_study_document = jsonb_set(
  jsonb_set(case_study_document, '{schemaVersion}', '3'::jsonb),
  '{background}',
  '{"type":"pcb-svg","bucket":"case-study-assets","objectPath":"delivery-intelligence-the-sleep-company/background.80450758d9320df3e084.svg","width":2400,"height":15343.2}'::jsonb
)
where slug = 'delivery-intelligence-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  jsonb_set(case_study_document, '{schemaVersion}', '3'::jsonb),
  '{background}',
  '{"type":"pcb-svg","bucket":"case-study-assets","objectPath":"leads-management-the-sleep-company/background.5a4edfe1dfe6f77e7d76.svg","width":2400,"height":14322.5}'::jsonb
)
where slug = 'leads-management-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  jsonb_set(case_study_document, '{schemaVersion}', '3'::jsonb),
  '{background}',
  '{"type":"pcb-svg","bucket":"case-study-assets","objectPath":"horecah/background.224bcf013e6f2ceadd16.svg","width":2400,"height":11040}'::jsonb
)
where slug = 'horecah'
  and case_study_document is not null;
