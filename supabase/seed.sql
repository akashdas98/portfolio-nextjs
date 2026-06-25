insert into public.admin_users (email)
values ('akash42662012@gmail.com')
on conflict (email) do nothing;

insert into public.projects (
  slug,
  name,
  url,
  category,
  title,
  challenge,
  delivery,
  capabilities,
  metrics,
  order_index,
  status
) values
(
  'delivery-intelligence-the-sleep-company',
  'Delivery Intelligence | The Sleep Company',
  'https://thesleepcompany.in',
  'Ecommerce - Backend Architecture - Production Systems',
  'Delivery promises made dependable',
  $$A large ecommerce business needed one reliable source of truth for delivery estimates across products, warehouses, locations, couriers, holidays, manufacturing delays, stock status, and express-delivery rules.$$,
  $$A centralized delivery-estimation service combined operational data and business rules from courier, inventory, ecommerce, and warehouse systems, with caching, administrative data controls, version history, backup and restore, and automated alerts.$$,
  array[
    'Backend architecture',
    'API design',
    'Business-rule modelling',
    'External integrations',
    'Caching',
    'Production scaling',
    'Observability',
    'Long-term maintenance'
  ],
  '[{"value":"95%","label":"delivery-date accuracy"},{"value":"INR 1 crore","label":"annual cost savings"},{"value":"1.45M","label":"peak-period requests"}]'::jsonb,
  1,
  'published'
),
(
  'leads-management-the-sleep-company',
  'Leads Management | The Sleep Company',
  'https://thesleepcompany.in',
  'Ecommerce - Integrations - High-Volume Systems',
  'Fragmented lead capture, rebuilt as one dependable system',
  $$Lead capture relied on spreadsheets and disconnected systems. The business needed a centralized platform for collection, enrichment, routing, and synchronization across marketing, sales, and communication systems.$$,
  $$A centralized lead service replaced spreadsheet-based middleware, enriched data with ecommerce metadata, applied configurable routing rules, and coordinated internal and third-party systems.$$,
  array[
    'System integration',
    'Backend architecture',
    'Business workflows',
    'Data enrichment',
    'Routing logic',
    'Cloud deployment',
    'Scaling',
    'Production support'
  ],
  '[{"value":"3.6M","label":"requests in 30 days"},{"value":"626K","label":"leads sustained"},{"value":"3.19x","label":"daily volume growth"}]'::jsonb,
  2,
  'published'
),
(
  'horecah',
  'Horecah',
  'https://horecah.com',
  'Freelance - Web and Mobile - Payments and Notifications',
  'One hiring platform across web, Android, and iOS',
  $$A hospitality-focused hiring platform needed to operate across three platforms while preserving a shared codebase and supporting payments and push notifications everywhere.$$,
  $$A shared Capacitor client connected to a Node.js and Hasura GraphQL backend. Razorpay compatibility issues were resolved through direct plugin adaptation, while one payment implementation remained shared across platforms.$$,
  array[
    'Full-stack development',
    'Cross-platform mobile delivery',
    'Payments',
    'GraphQL',
    'Push notifications',
    'Third-party integration',
    'Technical problem-solving'
  ],
  '[{"value":"3","label":"platforms delivered"},{"value":"1","label":"shared payment flow"},{"value":"3","label":"push ecosystems unified"}]'::jsonb,
  3,
  'published'
)
on conflict (slug) do update set
  name = excluded.name,
  url = excluded.url,
  category = excluded.category,
  title = excluded.title,
  challenge = excluded.challenge,
  delivery = excluded.delivery,
  capabilities = excluded.capabilities,
  metrics = excluded.metrics,
  order_index = excluded.order_index,
  status = excluded.status;
