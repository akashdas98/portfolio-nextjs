update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,lensObjectPath}',
  to_jsonb('delivery-intelligence-the-sleep-company/background-lens.7b727273f724e113c135.svg'::text),
  false
)
where slug = 'delivery-intelligence-the-sleep-company';

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,lensObjectPath}',
  to_jsonb('leads-management-the-sleep-company/background-lens.5de537a82a21de0fe3fc.svg'::text),
  false
)
where slug = 'leads-management-the-sleep-company';

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,lensObjectPath}',
  to_jsonb('horecah/background-lens.abbd807dc159ff4a775d.svg'::text),
  false
)
where slug = 'horecah';
