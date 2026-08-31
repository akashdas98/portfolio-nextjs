update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('delivery-intelligence-the-sleep-company/background.1fe054954f74d0a56c24.svg'::text)
)
where slug = 'delivery-intelligence-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('leads-management-the-sleep-company/background.8b9b8a8da28b222ce398.svg'::text)
)
where slug = 'leads-management-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('horecah/background.3ff5b2fe09065c8a9f65.svg'::text)
)
where slug = 'horecah'
  and case_study_document is not null;
