update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background}',
  '{"type":"pcb-svg","bucket":"case-study-assets","objectPath":"delivery-intelligence-the-sleep-company/background.f9e6f6fcd6f7e4ef8bed.svg","lensObjectPath":"delivery-intelligence-the-sleep-company/background-lens.24ea936c990e871a6bd7.svg","width":2400,"height":15343.2}'::jsonb,
  false
)
where slug = 'delivery-intelligence-the-sleep-company';

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background}',
  '{"type":"pcb-svg","bucket":"case-study-assets","objectPath":"leads-management-the-sleep-company/background.9903f7dfb3275f2d9bb9.svg","lensObjectPath":"leads-management-the-sleep-company/background-lens.dcc661dd0e57dd540401.svg","width":2400,"height":14322.5}'::jsonb,
  false
)
where slug = 'leads-management-the-sleep-company';

update public.projects
set case_study_document = jsonb_set(
  case_study_document,
  '{background}',
  '{"type":"pcb-svg","bucket":"case-study-assets","objectPath":"horecah/background.d0e81f816d967c5feb8d.svg","lensObjectPath":"horecah/background-lens.85fcc135e4bbc188df64.svg","width":2400,"height":11136}'::jsonb,
  false
)
where slug = 'horecah';
