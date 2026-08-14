update public.projects
set
  case_study_document = jsonb_insert(
    case_study_document,
    '{sections,-1}',
    $impact${
      "id": "communication-automation",
      "type": "impact-highlight",
      "tone": "base",
      "eyebrow": "Communication automation",
      "title": "Customer communication rebuilt around the full order journey.",
      "detail": "The notification system depended heavily on the centralized EDD service. EDD promise and timing data drove reusable scheduling across order placement, processing, dispatch, delivery, cancellation, and return journeys.",
      "metrics": [
        { "value": "35%", "label": "reduction in support calls" },
        { "value": "₹3 crore", "label": "annual support-cost savings" },
        { "value": "30+", "label": "new notifications introduced" }
      ],
      "circuitAnchor": "section-bottom"
    }$impact$::jsonb,
    false
  ),
  updated_at = timezone('utc', now())
where slug = 'delivery-intelligence-the-sleep-company'
  and has_case_study = true
  and case_study_document is not null
  and not case_study_document @> '{"sections":[{"id":"communication-automation"}]}'::jsonb;
