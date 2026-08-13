update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{role}',
  to_jsonb('Backend lead: Architecture, API design, integrations, infrastructure, production support, complete technical ownership.'::text),
  false
)
where slug = 'delivery-intelligence-the-sleep-company'
  and has_case_study = true
  and case_study_document is not null;
