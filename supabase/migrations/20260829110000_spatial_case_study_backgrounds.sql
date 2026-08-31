update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('delivery-intelligence-the-sleep-company/background.9567a7dededd68186ed9.svg'::text)
)
where slug = 'delivery-intelligence-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('leads-management-the-sleep-company/background.1c16f23f8062a3817417.svg'::text)
)
where slug = 'leads-management-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('horecah/background.0187dfed4b1d71de1f7d.svg'::text)
)
where slug = 'horecah'
  and case_study_document is not null;
