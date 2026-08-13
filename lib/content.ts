export const projects = [
  {
    index: "01",
    name: "Delivery Intelligence | The Sleep Company",
    url: "https://thesleepcompany.in",
    category: "Ecommerce · Backend Architecture · Production Systems",
    title: "Delivery promises made dependable",
    challenge:
      "A large ecommerce business needed one reliable source of truth for delivery estimates across products, warehouses, locations, couriers, holidays, manufacturing delays, stock status, and express-delivery rules.",
    delivery:
      "A centralized delivery-estimation service combined operational data and business rules from courier, inventory, ecommerce, and warehouse systems, with caching, administrative data controls, version history, backup and restore, and automated alerts.",
    metrics: [
      ["50%", "reduction in support calls"],
      ["5x", "FRT improvement"],
      ["\u20b95 crore", "annual cost savings"],
    ],
    capabilities:
      "Backend architecture, API design, business-rule modelling, external integrations, caching, production scaling, observability, and long-term maintenance.",
    visual: "delivery",
  },
  {
    index: "02",
    name: "Leads Management | The Sleep Company",
    url: "https://thesleepcompany.in",
    category: "Ecommerce · Integrations · High-Volume Systems",
    title: "Fragmented lead capture, rebuilt as one dependable system",
    challenge:
      "Lead capture relied on spreadsheets and disconnected systems. The business needed a centralized platform for collecting lead activities, retaining owned records, enriching applicable data, and synchronizing it across marketing, sales, and analytics systems.",
    delivery:
      "A centralized lead service replaced spreadsheet-based middleware, retained owned lead-activity records, normalized payloads for downstream systems, enriched applicable activities through a nearest-store API, and handled custom activity-type workflows.",
    metrics: [
      ["2.2×", "daily activity volume growth"],
      ["626K", "monthly activities sustained"],
      ["3.6M", "requests in 30 days"],
    ],
    capabilities:
      "System integration, backend architecture, business workflows, data enrichment, workflow orchestration, cloud deployment, scaling, and production support.",
    visual: "leads",
  },
  {
    index: "03",
    name: "Horecah",
    url: "https://horecah.com",
    category: "Freelance · Cross-Platform · Payments and Notifications",
    title: "Payments and notification journeys across web, Android, and iOS",
    challenge:
      "A new hospitality hiring product needed two release-critical capabilities to behave consistently across three client platforms.",
    delivery:
      "End-to-end Razorpay payments and event-driven push notifications were delivered through one React and Capacitor application, including backend verification, platform delivery, and deep-link routing.",
    metrics: [
      ["3", "client platforms"],
      ["2", "production features"],
      ["1", "shared payment flow"],
    ],
    capabilities:
      "Cross-platform feature delivery, payment integration, push notifications, backend APIs, Hasura events, deep linking, third-party package adaptation, and production testing.",
    visual: "horecah",
  },
] as const;

export const services = [
  {
    number: "01",
    title: "Business Websites",
    headline: "Professional websites built to communicate clearly and convert confidently.",
    copy:
      "Structured around the business, its audience, and the actions that matter most. Designed for clarity, responsiveness, performance, and easy ongoing management.",
    items: ["Content hierarchy", "UI/UX-informed design", "Responsive development", "CMS and lead flows"],
  },
  {
    number: "02",
    title: "Custom Web Applications",
    headline: "Product ideas turned into dependable, production-ready software.",
    copy:
      "SaaS platforms, dashboards, portals, and internal tools developed across the complete product stack. Clear interfaces on the surface. Maintainable architecture underneath.",
    items: ["Product workflows", "Frontend and backend", "Auth, APIs, and data", "Payments and integrations"],
  },
  {
    number: "03",
    title: "Application Rescue",
    headline: "Existing systems stabilized, improved, and moved forward.",
    copy:
      "For products affected by unfinished work, fragile code, performance problems, broken integrations, or unreliable deployments.",
    items: ["Technical assessment", "Bug and feature recovery", "Performance improvement", "Deployment stabilization"],
  },
  {
    number: "04",
    title: "Ongoing Support",
    headline: "Reliable technical continuity after launch.",
    copy:
      "Long-term development support for businesses that need steady progress without building a full internal engineering team.",
    items: ["Maintenance", "Feature development", "Production support", "Technical planning"],
  },
] as const;
