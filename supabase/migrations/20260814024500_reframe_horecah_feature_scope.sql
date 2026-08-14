update public.projects
set
  case_study_document = jsonb_set(
    case_study_document,
    '{sections}',
    (
      select jsonb_agg(
        case
          when section ->> 'id' = 'feature-scope' then
            $feature_scope${"id":"feature-scope","tone":"muted","eyebrow":"Feature scope","title":"Two production features, delivered through one shared cross-platform client.","type":"evidence-grid","columns":3,"cards":[{"title":"Shared client foundation","detail":"One React and Capacitor application carried the common client contracts and platform configuration across web, Android, and iOS.","keywords":["React + Capacitor","web + native","one client"]},{"title":"Payments, end to end","detail":"Ownership ran from backend order creation and Razorpay checkout through signature verification and independent webhook reconciliation.","keywords":["order creation","checkout","verification"]},{"title":"Notifications, event to destination","detail":"Ownership ran from Hasura-triggered product events through FCM or APNs delivery and destination-aware navigation after a tap.","keywords":["Hasura events","FCM + APNs","deep linking"]}]}$feature_scope$::jsonb
          else section
        end
        order by ordinal
      )
      from jsonb_array_elements(case_study_document -> 'sections')
        with ordinality as case_sections(section, ordinal)
    ),
    false
  ),
  updated_at = timezone('utc', now())
where slug = 'horecah';
