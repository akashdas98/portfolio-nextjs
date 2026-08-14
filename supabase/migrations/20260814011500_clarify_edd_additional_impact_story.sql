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
              'eyebrow', 'Additional impact',
              'detail', 'A separate notification-system overhaul rebuilt customer communication across the full order journey. Its reusable scheduling foundation relied heavily on the centralized EDD service, using current promise and timing data to drive messages across order placement, processing, dispatch, delivery, cancellation, and return journeys.'
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
