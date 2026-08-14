update public.projects
set
  case_study_document = jsonb_set(
    case_study_document,
    '{sections}',
    (
      select jsonb_agg(
        case
          when section ->> 'id' = 'communication-automation' then
            section || jsonb_build_object(
              'detail', 'A separate notification-system overhaul was built to keep customers properly informed throughout the entire order journey—from order placement through processing, dispatch, delivery, cancellation, and returns. The system relied heavily on EDD as the foundation for timely, journey-aware communication.'
            )
          else section
        end
        order by section_order
      )
      from jsonb_array_elements(case_study_document -> 'sections')
        with ordinality as sections(section, section_order)
    )
  ),
  updated_at = timezone('utc', now())
where slug = 'delivery-intelligence-the-sleep-company'
  and has_case_study = true
  and case_study_document @> '{"sections":[{"id":"communication-automation"}]}'::jsonb;
