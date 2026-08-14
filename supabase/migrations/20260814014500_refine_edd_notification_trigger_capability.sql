update public.projects
set
  case_study_document = jsonb_set(
    case_study_document,
    '{sections}',
    (
      select jsonb_agg(
        case
          when section ->> 'id' = 'communication-automation' then
            jsonb_set(
              section,
              '{capabilities}',
              (
                select jsonb_agg(
                  case
                    when capability = 'EDD integration' then
                      to_jsonb('Event integrations'::text)
                    when capability = 'Production ownership' then
                      to_jsonb('Technical ownership'::text)
                    else to_jsonb(capability)
                  end
                  order by capability_order
                )
                from jsonb_array_elements_text(section -> 'capabilities')
                  with ordinality as capabilities(capability, capability_order)
              )
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
  and case_study_document @> '{"sections":[{"id":"communication-automation","capabilities":["EDD integration"]}]}'::jsonb;
