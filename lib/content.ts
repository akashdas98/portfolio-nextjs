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
      ["200%", "delivery-date accuracy increase"],
      ["₹1 crore", "annual cost savings"],
      ["1.45M", "peak-period requests"],
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
      "Lead capture relied on spreadsheets and disconnected systems. The business needed a centralized platform for collection, enrichment, routing, and synchronization across marketing, sales, and communication systems.",
    delivery:
      "A centralized lead service replaced spreadsheet-based middleware, enriched data with ecommerce metadata, applied configurable routing rules, and coordinated internal and third-party systems.",
    metrics: [
      ["3.6M", "requests in 30 days"],
      ["626K", "leads sustained"],
      ["3.19×", "daily volume growth"],
    ],
    capabilities:
      "System integration, backend architecture, business workflows, data enrichment, routing logic, cloud deployment, scaling, and production support.",
    visual: "leads",
  },
  {
    index: "03",
    name: "Horecah",
    url: "https://horecah.com",
    category: "Freelance · Web and Mobile · Payments and Notifications",
    title: "One hiring platform across web, Android, and iOS",
    challenge:
      "A hospitality-focused hiring platform needed to operate across three platforms while preserving a shared codebase and supporting payments and push notifications everywhere.",
    delivery:
      "A shared Capacitor client connected to a Node.js and Hasura GraphQL backend. Razorpay compatibility issues were resolved through direct plugin adaptation, while one payment implementation remained shared across platforms.",
    metrics: [
      ["3", "platforms delivered"],
      ["1", "shared payment flow"],
      ["3", "push ecosystems unified"],
    ],
    capabilities:
      "Full-stack development, cross-platform mobile delivery, payments, GraphQL, push notifications, third-party integration, and technical problem-solving.",
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
