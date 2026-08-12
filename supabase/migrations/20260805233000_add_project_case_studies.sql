alter table public.projects
  add column if not exists has_case_study boolean not null default false;

alter table public.projects
  add column if not exists case_study_document jsonb;
