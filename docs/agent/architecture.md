# Project architecture

Read when locating implementation boundaries. Current task status belongs in `CONTEXT.md`.

This repository is a Next.js App Router portfolio site for Akash Das.

Top-level layout:

- `app/`: Next.js routes, metadata, sitemap, robots, global styles, and API routes.
- `app/work/[slug]/`: public expanded case-study pages for selected projects with available case-study content.
- `app/admin/`: private admin routes for dashboard, projects, leads, settings, and login.
- `app/api/contact/route.ts`: contact form endpoint using Zod validation and Resend email delivery.
- `components/`: reusable UI components for the header, contact form, project cards, and system visuals.
- `components/PublicCircuitBackground.tsx`: deterministic PCB orchestration for the static projection and independently owned desktop/touch interaction renderers; excludes admin and reduced-motion interaction.
- `components/public-circuit/StaticCircuitVector.tsx`: regional static vector projection ownership.
- `components/public-circuit/DesktopCircuitInteraction.tsx`: frozen on-demand native SVG desktop interaction ownership.
- `components/public-circuit/TouchCanvasInteraction.tsx`: accepted bounded Canvas touch lifecycle and paint ownership.
- `components/public-circuit/shared.ts`: non-React shared geometry acquisition, renderer types, and constants used by more than one PCB renderer.
- `components/CircuitUnderlay.tsx`: shared semantic text and inert readability paint source. Exact stacking/paint requirements live in `visual.md`.
- `components/PublicAnimations.tsx`: progressively enhanced reveals; preserves CSS first-paint ownership and rebinds below-fold animation on route changes.
- `components/CaseStudyBackLink.tsx`: browser-back behavior with a synthesized `/#work` history entry for direct arrivals.
- `components/AdminLoginForm.tsx`: Supabase Auth login form for the admin panel.
- `components/AdminProjectForm.tsx`: admin create/edit form for selected-work project records.
- `components/AdminLeadForm.tsx`: admin action form for lead status, priority, notes, and follow-ups.
- `components/CaseStudyRenderer.tsx`: server-side renderer for validated, database-backed case-study layout documents.
- `components/EddCalculationDiagram.tsx`: generic responsive renderer for validated, database-owned EDD content, integrations, geometry, connections, paths, and breakpoints; it uses SVG for database-selected wide variants and native HTML/CSS for database-selected mobile variants.
- `components/LeadNetworkDiagram.tsx`: generic responsive renderer for validated, database-owned lead-network content, breakpoints, canvas geometry, paths, and nodes; like EDD, it mounts one fixed-viewBox SVG wide/tablet composition or one native HTML mobile/compact recomposition. Wide/tablet peripheral cards are direct native SVG siblings with explicit paint and no transformed groups; only the owned internal perimeter uses one bounded `foreignObject`.
- `components/CrossPlatformFeatureDiagram.tsx`: generic native HTML/CSS renderer for validated, database-owned cross-platform feature content and breakpoints; it maps shared client platforms into two owned feature lanes and ends at those contribution boundaries without implying ownership of the surrounding product.
- `lib/admin/`: admin data adapters and TypeScript types.
- `lib/case-study/`: versioned case-study document validation.
- `lib/content.ts`: structured website-only fallback content for selected work plus homepage services; it does not contain public case-study documents.
- `lib/supabase/`: Supabase configuration and browser/server/admin clients.
- `lib/supabase/public.ts`: stateless anonymous public reads with bounded transient retry; project loaders own tagged caching and deduplication.
- `public/`: website-owned static assets. Promoted project-specific case-study artwork belongs in Supabase Storage, not here.
- `supabase/schema.sql`: Supabase schema for projects, project case-study documents, leads, and future selected Gmail messages.
- `supabase/seed.sql`: initial selected-work project seed data.
- `supabase/migrations/`: incremental migrations applied to linked Supabase environments.
- `portfolio-structure.md`: durable content, UI/UX direction, service positioning, and technical direction.
- `positioning.md`: client-facing positioning and safe UI/UX claim.
- `resume.pdf`: source resume used as reference material.
- `README.md`: local setup and deployment notes.
- `proxy.ts`: Next.js proxy guard for protected admin routes.

Generated/cache folders such as `.next`, `node_modules`, `out`, `.vercel`, logs, and local environment files should not be committed.

- `lib/pcb/` and `app/api/pcb/route.ts`: bounded anonymous spatial delivery from the exact homepage lens or configured public Storage bucket; conservative SVG bounds retain original path strings. No database content is relocated.
