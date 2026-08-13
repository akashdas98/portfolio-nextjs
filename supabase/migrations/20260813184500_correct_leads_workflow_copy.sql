update public.projects
set
  challenge = $$Lead capture relied on spreadsheets and disconnected systems. The business needed a centralized platform for collection, owned storage, enrichment, and synchronization across marketing, sales, and analytics systems.$$,
  delivery = $$A centralized lead service replaced spreadsheet-based middleware, retained an owned lead record, normalized payloads for downstream systems, enriched applicable leads through a nearest-store API, and coordinated internal and third-party workflows.$$,
  capabilities = array[
    'System integration',
    'Backend architecture',
    'Business workflows',
    'Data enrichment',
    'Workflow orchestration',
    'Cloud deployment',
    'Scaling',
    'Production support'
  ],
  updated_at = timezone('utc', now())
where slug = 'leads-management-the-sleep-company';
