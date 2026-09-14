update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('delivery-intelligence-the-sleep-company/background.6f25fa828754a35c4596.svg'::text)
)
where slug = 'delivery-intelligence-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('leads-management-the-sleep-company/background.a6df1a6fc096d3e0c7be.svg'::text)
)
where slug = 'leads-management-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('horecah/background.01946e3536394cf760f6.svg'::text)
)
where slug = 'horecah'
  and case_study_document is not null;
