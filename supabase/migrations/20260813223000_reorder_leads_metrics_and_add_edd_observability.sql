update public.projects
set
  metrics = '[{"value":"2.2x","label":"daily activity volume growth"},{"value":"626K","label":"monthly activities sustained"},{"value":"3.6M","label":"requests in 30 days"}]'::jsonb,
  updated_at = timezone('utc', now())
where slug = 'leads-management-the-sleep-company';

update public.projects
set
  case_study_document = jsonb_set(
    case_study_document,
    '{sections}',
    (
      select jsonb_agg(
        case
          when section ->> 'id' = 'production-proof'
            and not exists (
              select 1
              from jsonb_array_elements(section -> 'cards') as card
              where card ->> 'title' = 'Production visibility'
            )
          then jsonb_set(
            section,
            '{cards}',
            (section -> 'cards') || jsonb_build_array(
              jsonb_build_object(
                'title', 'Production visibility',
                'detail', 'SigNoz brought EDD logs and traces into one searchable view, with alerts surfacing downtime, slow P90 responses, and elevated error rates before delivery promises degraded.',
                'keywords', jsonb_build_array('SigNoz', 'P90 monitoring', 'error alerts')
              )
            )
          )
          else section
        end
        order by section_order
      )
      from jsonb_array_elements(case_study_document -> 'sections')
        with ordinality as sections(section, section_order)
    ),
    false
  ),
  updated_at = timezone('utc', now())
where slug = 'delivery-intelligence-the-sleep-company'
  and has_case_study = true
  and case_study_document is not null;
