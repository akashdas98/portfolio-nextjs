update public.projects
set
  metrics = '[{"value":"1","label":"shared client"},{"value":"2","label":"production features"},{"value":"3","label":"client platforms"}]'::jsonb,
  updated_at = timezone('utc', now())
where slug = 'horecah';
