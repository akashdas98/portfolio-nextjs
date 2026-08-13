update public.projects
set
  metrics = '[{"value":"3.6M","label":"requests in 30 days"},{"value":"626K","label":"leads sustained"},{"value":"2.2x","label":"daily volume growth"}]'::jsonb,
  updated_at = timezone('utc', now())
where slug = 'leads-management-the-sleep-company';
