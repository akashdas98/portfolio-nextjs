update public.projects
set
  challenge = $$Lead capture relied on spreadsheets and disconnected systems. The business needed a centralized platform for collecting lead activities, retaining owned records, enriching applicable data, and synchronizing it across marketing, sales, and analytics systems.$$,
  delivery = $$A centralized lead service replaced spreadsheet-based middleware, retained owned lead-activity records, normalized payloads for downstream systems, enriched applicable activities through a nearest-store API, and handled custom activity-type workflows.$$,
  metrics = '[{"value":"3.6M","label":"requests in 30 days"},{"value":"626K","label":"lead activities sustained"},{"value":"2.2x","label":"daily activity volume growth"}]'::jsonb,
  updated_at = timezone('utc', now())
where slug = 'leads-management-the-sleep-company';
