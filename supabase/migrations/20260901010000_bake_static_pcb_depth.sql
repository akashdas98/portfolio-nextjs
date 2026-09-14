update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('delivery-intelligence-the-sleep-company/background.3b3a5936f4a84e766469.svg'::text)
)
where slug = 'delivery-intelligence-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('leads-management-the-sleep-company/background.be94185e2a102e00fed2.svg'::text)
)
where slug = 'leads-management-the-sleep-company'
  and case_study_document is not null;

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background,objectPath}',
  to_jsonb('horecah/background.817ddaf6dd608d57885f.svg'::text)
)
where slug = 'horecah'
  and case_study_document is not null;
