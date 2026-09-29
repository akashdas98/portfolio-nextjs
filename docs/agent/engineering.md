# Engineering and data requirements

Read before application, API, admin, data, schema, asset ownership, or dependency changes.

- Prefer the existing project structure over new abstractions.
- Keep server components as the default.
- Add client components only when interactivity requires them.
- Keep JavaScript minimal and purposeful.
- Avoid unnecessary dependencies and component libraries.
- Keep content data structured in `lib/content.ts` unless a page-specific reason exists.
- Public Work should prefer published Supabase projects when available, with `lib/content.ts` as the fallback.
- Public project reads must use the stateless anonymous Supabase client, not the cookie/auth-aware server client. Keep successful public reads in the tagged Next data cache, deduplicate metadata/page reads, and invalidate the `public-projects` tag immediately after admin project mutations so transient Supabase network failures do not turn every navigation into a blocking live query.
- Static fallback projects are website-only: expose `Visit Website` only with an active website URL, never `View Case Study`. Retired sites have no website action. Horecah's retired URL is empty in the CMS and website-only fallback; preserve its published case-study access.
- Project cards must use the database-backed `has_case_study` field to choose between `View Case Study` and `Visit Website`; do not infer availability from static content.
- Finalized case-study layouts must be stored as schema-versioned project data and validated through `lib/case-study/`; do not store executable React, JavaScript, or unrestricted HTML/CSS in the database.
- Promoted case-study artwork must be project-owned and swappable with its document. Store both the prepared semantic SVG and its exact-geometry spatial lens SVG in the public `case-study-assets` Supabase Storage bucket, then store the validated bucket, both object paths, and intrinsic dimensions in the case-study document. Do not infer repository assets from the project slug or retain promoted project SVG copies under `public/`.
- Case-study project development is local-first. While the user is actively iterating, project-specific content, layout definitions, diagram geometry, responsive variants, paths, and breakpoints may be developed locally for speed.
- Do not convert, upload, or remove that local project-specific data until the user explicitly approves database promotion for that project.
- After explicit approval, database promotion is a mandatory project-completion gate: extend the validated schema as needed; convert every project-specific content and layout value—including hero-visual geometry, nodes, connections, responsive variants, and breakpoints—into the project's database document; upload it to the linked database; verify the stored document and public rendering; update seeds/migrations where applicable; and remove the duplicated local project-specific data.
- After database promotion, frontend code may retain only generic renderers, safe visual primitives, and shared design tokens. A project is not complete if project-specific layout or diagram data remains hardcoded locally.
- Never store executable React, JavaScript, or unrestricted HTML/CSS in database documents. Store declarative, bounded, schema-validated layout data that generic frontend renderers interpret.
- Public case-study routes are database-only. If the Supabase row, availability flag, or validated document is unavailable, the route must not render a static case study.
- Keep the project and service name `Leads Management`, but describe its ingested units, stored records, volume metrics, and processing workflows as lead activities rather than leads.
- Do not commit secrets. Contact form configuration belongs in `.env.local`, based on `.env.example`.
- Keep admin data access through `lib/admin/` and Supabase utilities through `lib/supabase/`.
- Keep `SUPABASE_SECRET_KEY` server-only. Never reference it from client components.
- Admin access must be restricted by both the server-side `ADMIN_EMAILS` allowlist and matching `public.admin_users` rows in Supabase RLS.
