update public.projects
set
  case_study_document = jsonb_set(
    case_study_document,
    '{sections,0,rows,0,impact}',
    to_jsonb('~2x accuracy increase'::text),
    false
  ),
  updated_at = timezone('utc', now())
where slug = 'delivery-intelligence-the-sleep-company'
  and has_case_study = true
  and case_study_document is not null;

update public.projects
set
  metrics = '[{"value":"3.6M","label":"requests in 30 days"},{"value":"626K","label":"monthly activities sustained"},{"value":"2.2x","label":"daily activity volume growth"}]'::jsonb,
  updated_at = timezone('utc', now())
where slug = 'leads-management-the-sleep-company';
