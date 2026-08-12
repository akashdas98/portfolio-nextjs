do $$
begin
  if to_regclass('public.admin_users') is not null then
    insert into public.admin_users (email)
    values ('akash42662012@gmail.com')
    on conflict (email) do nothing;
  end if;
end
$$;

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
  has_case_study,
  case_study_document,
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
  '[{"value":"50%","label":"reduction in support calls"},{"value":"5x","label":"FRT improvement"},{"value":"₹5 crore","label":"annual cost savings"}]'::jsonb,
  true,
  $case_study${"schemaVersion":2,"summary":"A scattered delivery-date calculation process was rebuilt as a centralized EDD service that could support ecommerce touchpoints, logistics operations, warehouse data, product rules, courier timelines, stock states, holidays, and manufacturing delays from one dependable source of truth.","role":"Backend lead: system design, API development, integrations, infrastructure, deployment, and technical ownership.","sections":[{"id":"outcome-snapshot","type":"outcome-table","tone":"muted","eyebrow":"Outcome snapshot","title":"Delivery accuracy, support load, and response speed moved together.","rows":[{"metric":"Delivery-date accuracy","before":"30%","after":"95%","impact":"Roughly 2x accuracy increase"},{"metric":"Daily support calls","before":"500","after":"250","impact":"50% reduction"},{"metric":"FRT","before":"10%","after":"60%","impact":"5x improvement"}],"footer":{"value":"₹5 crore","label":"annual cost savings","detail":"Lower support volume and faster first-response handling turned the operational gains into measurable recurring savings."}},{"id":"operating-model-shift","type":"comparison","tone":"base","eyebrow":"Operating model shift","title":"From fragmented delivery promises to one controlled source of truth.","beforeLabel":"Before","afterLabel":"After","items":[{"before":"Delivery estimates split across frontend logic, team-owned sheets, and disconnected databases.","after":"One backend EDD API serving ecommerce, logistics, warehouse, and operational touchpoints."},{"before":"Important variables handled inconsistently: stock state, holidays, manufacturing delay, courier timing, and warehouse location.","after":"A single calculation path combined product, courier, warehouse, order, holiday, stock, and cutoff data."},{"before":"Manual correction loops created support pressure and low confidence in customer-facing promises.","after":"Controlled upload workflows, validation reports, snapshots, restores, and alerts gave operations a safer way to manage EDD data."}]},{"id":"system-flow","type":"system-flow","tone":"muted","eyebrow":"System flow","title":"Scattered delivery data became one controlled delivery-date API.","items":[{"step":"01","title":"Normalize scattered inputs","detail":"Product, warehouse, courier, order, holiday, stock, and manufacturing-delay data were brought into one calculation path.","stat":"8","statLabel":"data domains"},{"step":"02","title":"Control operational changes","detail":"Admin updates moved through validation, correction sheets, snapshots, restores, and cache refreshes before affecting live promises.","stat":"7","statLabel":"control workflows"},{"step":"03","title":"Serve one EDD API","detail":"A NestJS service read operational records from MongoDB and served high-read delivery rules through Redis-backed paths.","stat":"3","statLabel":"runtime layers"}]},{"id":"operational-control","type":"workflow","tone":"base","eyebrow":"Operational control","title":"Data changes became validated, reversible, and cache-aware.","intro":"Operations could update the rules behind customer-facing promises without scattered sheets, unsafe replacements, or unclear failures.","steps":["Upload","Validate","Correction sheet","Snapshot","Replace","Refresh cache","Alert"],"cards":[{"title":"Validated uploads","detail":"CSV/XLSX files were checked row by row before operational data could replace active collections.","keywords":["CSV/XLSX","row-level errors","admin workflow"]},{"title":"Snapshot-backed restores","detail":"Every upload and restore preserved the current collection first, keeping rollback paths available.","keywords":["snapshot","restore","MongoDB"]},{"title":"Operational alerts","detail":"Kubernetes-backed checks surfaced variant stock changes and admin-dashboard alerts.","keywords":["cron checks","stock state","alerts"]}]},{"id":"engineering-decisions","type":"evidence-grid","tone":"muted","eyebrow":"Engineering decisions","title":"Choices shaped around central dependency risk and production traffic.","cards":[{"title":"Isolated EDD service","detail":"Delivery logic could evolve in one backend system instead of being duplicated across touchpoints.","keywords":["NestJS","single API","service boundary"]},{"title":"Redis-backed read path","detail":"High-read rules such as holidays, processing times, cutoff hours, and variant delays were cached and refreshed after database changes.","keywords":["Redis","cache refresh","high-read data"]},{"title":"Lifecycle-aware delay logic","detail":"Holiday and Sunday handling accounted for where delay happened: factory, warehouse, courier, or post-dispatch.","keywords":["holidays","cutoffs","delay rules"]},{"title":"Seasonal traffic headroom","detail":"The deployment was designed to handle seasonal bursts without losing the central EDD dependency.","keywords":["Kubernetes","Diwali","scaling"]}]},{"id":"production-proof","type":"evidence-grid","tone":"base","eyebrow":"Production proof","title":"The system held up where production systems usually break.","cards":[{"title":"Seasonal traffic headroom","detail":"The central EDD service stayed dependable during Diwali demand, supporting 1.45M period requests and traffic roughly 199% above the previous month.","keywords":["1.45M requests","199% traffic lift","Kubernetes scaling"]},{"title":"Cache-safe rule updates","detail":"High-read delivery rules were served through Redis and refreshed after database changes, so admin updates did not leave stale promises in circulation.","keywords":["Redis","cache refresh","high-read rules"]},{"title":"Rollback-ready operations","detail":"Uploads validated rows before replacement and snapshotted active collections first, giving operations a controlled recovery path for delivery data changes.","keywords":["row validation","snapshots","restore path"]}],"circuitAnchor":"section-bottom"},{"id":"capabilities-demonstrated","type":"capability-band","tone":"muted","eyebrow":"Capabilities demonstrated","title":"Backend architecture carried through production ownership.","showProjectCapabilities":true,"primaryActionLabel":"Discuss a Project","secondaryActionLabel":"Visit Live Site"}],"heroVisual":{"type":"edd-calculation","eyebrow":"Request to promise","title":"One request, resolved into a dependable promise.","description":"A delivery estimate request follows a curved path through destination resolution, fulfilment source, dispatch readiness, and promise assembly. EasyEcom supplies warehouse data. ClickPost supplies courier and delivery-promise data before the service returns dispatch, delivery-range, and express-availability values.","requestLabel":"EDD request","requestFields":[{"label":"Product","value":"Product ID"},{"label":"Destination","value":"Pincode"},{"label":"Requested","value":"Date + time"}],"integrations":[{"key":"clickpost","name":"ClickPost","role":"Courier API"},{"key":"easyecom","name":"EasyEcom","role":"Warehouse API"}],"stages":[{"number":"01","title":"Destination resolution","items":[{"label":"Pincode serviceability"},{"label":"Recommended courier partner","sourceKey":"clickpost"},{"label":"Available delivery modes"}]},{"number":"02","title":"Fulfilment source","items":[{"label":"Inventory availability"},{"label":"Warehouse determination","sourceKey":"easyecom"},{"label":"Warehouse details","sourceKey":"easyecom"}]},{"number":"03","title":"Dispatch readiness","items":[{"label":"Processing time"},{"label":"Manufacturing delay"},{"label":"Cutoff + holiday calendar"}]},{"number":"04","title":"Promise assembly","items":[{"label":"Baseline post-dispatch range","sourceKey":"clickpost"},{"label":"Express eligibility","sourceKey":"clickpost"},{"label":"Final delivery range"}]}],"responseLabel":"EDD response","responseFields":[{"label":"Dispatch","value":"Dispatch date"},{"label":"Delivery","value":"Date range"},{"label":"Express","value":"Available / unavailable"}],"layout":{"breakpoints":{"compactMax":480,"mobileMax":800,"tabletMax":1080},"canvas":{"width":1440,"height":810,"frameInset":1,"gridSize":28},"desktop":{"boundary":{"x":320,"y":130,"width":800,"height":535},"request":{"x":24,"y":260,"width":190,"height":280},"response":{"x":1226,"y":260,"width":190,"height":280},"stageSize":{"width":216,"height":185},"stagePositions":[{"x":353,"y":180},{"x":526,"y":430},{"x":699,"y":180},{"x":872,"y":430}],"flowPaths":["M226 400 C254 400 280 400 308 400","M461 377 V423 C461 452 482 475 502 475 H514","M634 418 V372 C634 343 655 325 675 325 H687","M807 377 V423 C807 452 828 475 848 475 H860","M1132 400 C1160 400 1186 400 1214 400"],"services":[{"integrationKey":"clickpost","x":900,"y":25,"width":200,"height":70,"path":"M900 60 C850 60 800 80 800 118"},{"integrationKey":"easyecom","x":340,"y":715,"width":200,"height":70,"path":"M540 750 C590 750 650 720 650 677"}]},"tablet":{"boundary":{"x":316,"y":130,"width":808,"height":535},"request":{"x":24,"y":260,"width":202,"height":280},"response":{"x":1214,"y":260,"width":202,"height":280},"stageSize":{"width":236,"height":185},"stagePositions":[{"x":347,"y":180},{"x":520,"y":430},{"x":693,"y":180},{"x":866,"y":430}],"flowPaths":["M238 400 C260 400 282 400 304 400","M461 377 V423 C461 452 482 475 508 475","M634 418 V372 C634 343 655 325 681 325","M807 377 V423 C807 452 828 475 854 475","M1136 400 C1158 400 1180 400 1202 400"],"services":[{"integrationKey":"clickpost","x":888,"y":25,"width":224,"height":70,"path":"M888 60 C844 60 800 80 800 118"},{"integrationKey":"easyecom","x":316,"y":715,"width":224,"height":70,"path":"M540 750 C590 750 650 720 650 677"}]},"mobile":{"groupLabel":"Promise engine","canvasPadding":32,"compactCanvasPadding":18,"endpointPadding":22,"compactEndpointPadding":18,"enginePadding":20,"compactEnginePadding":18,"entryColumns":[37.5,25,37.5],"entryPaddingTop":28,"entryPaddingBottom":38,"integrationPadding":12,"compactIntegrationPadding":10,"integrationConnectorHeight":36,"integrationConnectorGap":4,"responseConnectorHeight":34,"stageGap":26,"stagePadding":20,"compactStagePadding":18,"compactStageHeaderPadding":15,"compactFieldRows":{"labelMinWidth":82,"labelFraction":0.42,"valueFraction":1,"gap":12,"paddingBlock":13},"stageColumns":{"titleMinWidth":108,"titleFraction":0.55,"detailsFraction":1.45,"gap":22,"compactGap":16},"integrationPositions":[{"integrationKey":"clickpost","column":1},{"integrationKey":"easyecom","column":3}],"connections":[{"from":"request","to":"engine","kind":"primary"},{"from":"clickpost","to":"engine","kind":"api"},{"from":"easyecom","to":"engine","kind":"api"},{"from":"engine","to":"response","kind":"primary"}]}}}}$case_study$::jsonb,
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
  false,
  null,
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
  false,
  null,
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
  has_case_study = excluded.has_case_study,
  case_study_document = excluded.case_study_document,
  order_index = excluded.order_index,
  status = excluded.status;
