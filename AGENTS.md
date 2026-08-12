# Portfolio Agent Guide

## Architecture Overview

This repository is a Next.js App Router portfolio site for Akash Das.

Top-level layout:

- `app/`: Next.js routes, metadata, sitemap, robots, global styles, and API routes.
- `app/work/[slug]/`: public expanded case-study pages for selected projects with available case-study content.
- `app/admin/`: private admin routes for dashboard, projects, leads, settings, and login.
- `app/api/contact/route.ts`: contact form endpoint using Zod validation and Resend email delivery.
- `components/`: reusable UI components for the header, contact form, project cards, and system visuals.
- `components/AdminLoginForm.tsx`: Supabase Auth login form for the admin panel.
- `components/AdminProjectForm.tsx`: admin create/edit form for selected-work project records.
- `components/AdminLeadForm.tsx`: admin action form for lead status, priority, notes, and follow-ups.
- `components/CaseStudyRenderer.tsx`: server-side renderer for validated, database-backed case-study layout documents.
- `components/EddCalculationDiagram.tsx`: generic responsive renderer for validated, database-owned EDD content, integrations, geometry, connections, paths, and breakpoints; it uses SVG for database-selected wide variants and native HTML/CSS for database-selected mobile variants.
- `lib/admin/`: admin data adapters and TypeScript types.
- `lib/case-study/`: versioned case-study document validation.
- `lib/content.ts`: structured website-only fallback content for selected work plus homepage services; it does not contain public case-study documents.
- `lib/supabase/`: Supabase configuration and browser/server/admin clients.
- `public/`: static assets.
- `supabase/schema.sql`: Supabase schema for projects, project case-study documents, leads, and future selected Gmail messages.
- `supabase/seed.sql`: initial selected-work project seed data.
- `supabase/migrations/`: incremental migrations applied to linked Supabase environments.
- `portfolio-structure.md`: durable content, UI/UX direction, service positioning, and technical direction.
- `positioning.md`: client-facing positioning and safe UI/UX claim.
- `resume.pdf`: source resume used as reference material.
- `README.md`: local setup and deployment notes.
- `proxy.ts`: Next.js proxy guard for protected admin routes.

Generated/cache folders such as `.next`, `node_modules`, `out`, `.vercel`, logs, and local environment files should not be committed.

## Required Startup Context

At the start of every task in this repository:

1. Read this `AGENTS.md`.
2. Read `CONTEXT.md`.
3. Use the `Status Ledger`, `Known Issues`, and `Next Recommended Steps` in `CONTEXT.md` before deciding what to do.
4. Read `portfolio-structure.md` and `positioning.md` before changing copy, structure, visual direction, or offer positioning.

If `AGENTS.md` or `CONTEXT.md` changes during a task, re-read the changed file before continuing.

## Product Boundaries

The portfolio should position Akash as a senior full-stack developer with UI/UX-informed engineering judgment.

Preserve these boundaries:

- The site is a client-facing portfolio, not a generic developer resume page.
- The core offer is end-to-end delivery across planning, frontend, backend, deployment, and maintenance.
- The UI/UX claim must stay practical: clean, professional interfaces using established UI/UX principles, responsive design, and reusable design systems.
- Do not position Akash as a dedicated UI/UX designer unless the source positioning changes.
- Service copy should describe outcomes and delivery value more than personal capability claims.

## Visual Rules

The desired impression is cold competence: controlled, sharp, calm, confident, and not sterile.

Use:

- Near-black or deep-charcoal backgrounds.
- Slightly lighter surface layers.
- Soft off-white primary text.
- Muted cool-grey secondary text.
- Low-contrast borders.
- One restrained icy-blue, steel-blue, or desaturated-cyan accent.
- Typography-led hierarchy.
- Spacious but purposeful layouts.
- Subtle hover and reveal motion.
- Hard-cornered buttons.
- Hard-cornered card surfaces with slightly thicker borders.
- Light-blue primary buttons with black text, an offset striped shadow shape, and a slightly larger/separated hover state.
- Button shadow shapes use solid deep colors with 3px borders and black diagonal negative stripes; do not make them translucent.
- Primary button hover states must keep black text.
- `Start a Conversation` uses the same primary button face with a pink striped shadow shape.
- Project `View Case Study` actions use a pointed arrow-style blue button with horizontal hover motion.
- Service item tags are plain inline text separated by large accent dots, not pills.

Avoid:

- Bright gradients.
- Neon cyberpunk styling.
- Decorative blobs.
- Fake terminal aesthetics.
- Code rain.
- Heavy glassmorphism.
- Multiple accent colors.
- Rounded pill buttons for primary actions.
- Rounded card surfaces.
- Pill-shaped service tags.
- Scroll-jacking, parallax, magnetic buttons, cursor effects, or long intro animations.

Every design choice should improve hierarchy, readability, comprehension, navigation, trust, or interaction feedback. If it does not, remove it.

## Copy Rules

Write as an established technical brand, not as a freelancer asking to be trusted.

Prefer phrases like:

- Built for
- Designed to
- End-to-end
- Reliable by design
- Clear, maintainable, and ready to scale
- Existing systems, improved without unnecessary disruption
- Technical complexity translated into dependable products

Avoid phrases like:

- I can help with
- I can build
- I can investigate
- I am able to
- Whether you need
- My services include

Use first person selectively. Most copy should focus on what the work delivers.

## Coding Rules

- Prefer the existing project structure over new abstractions.
- Keep server components as the default.
- Add client components only when interactivity requires them.
- Keep JavaScript minimal and purposeful.
- Avoid unnecessary dependencies and component libraries.
- Keep content data structured in `lib/content.ts` unless a page-specific reason exists.
- Public Work should prefer published Supabase projects when available, with `lib/content.ts` as the fallback.
- Static fallback projects are website-only: they must always expose `Visit Website`, never `View Case Study`.
- Project cards must use the database-backed `has_case_study` field to choose between `View Case Study` and `Visit Website`; do not infer availability from static content.
- Finalized case-study layouts must be stored as schema-versioned project data and validated through `lib/case-study/`; do not store executable React, JavaScript, or unrestricted HTML/CSS in the database.
- Case-study project development is local-first. While the user is actively iterating, project-specific content, layout definitions, diagram geometry, responsive variants, paths, and breakpoints may be developed locally for speed.
- Do not convert, upload, or remove that local project-specific data until the user explicitly approves database promotion for that project.
- After explicit approval, database promotion is a mandatory project-completion gate: extend the validated schema as needed; convert every project-specific content and layout value—including hero-visual geometry, nodes, connections, responsive variants, and breakpoints—into the project's database document; upload it to the linked database; verify the stored document and public rendering; update seeds/migrations where applicable; and remove the duplicated local project-specific data.
- After database promotion, frontend code may retain only generic renderers, safe visual primitives, and shared design tokens. A project is not complete if project-specific layout or diagram data remains hardcoded locally.
- Never store executable React, JavaScript, or unrestricted HTML/CSS in database documents. Store declarative, bounded, schema-validated layout data that generic frontend renderers interpret.
- Public case-study routes are database-only. If the Supabase row, availability flag, or validated document is unavailable, the route must not render a static case study.
- Keep global visual tokens in `app/globals.css`.
- Keep every font size on the centralized typography scale in `app/globals.css`. Component and breakpoint rules must reference a `--font-size-*` token; add a deliberately named standard to the scale when a genuinely distinct role is required instead of introducing a one-off numeric size.
- Keep semantic HTML, accessible labels, keyboard navigation, visible focus states, and reduced-motion support.
- Do not commit secrets. Contact form configuration belongs in `.env.local`, based on `.env.example`.
- Keep admin data access through `lib/admin/` and Supabase utilities through `lib/supabase/`.
- Keep `SUPABASE_SECRET_KEY` server-only. Never reference it from client components.
- Admin access must be restricted by both the server-side `ADMIN_EMAILS` allowlist and matching `public.admin_users` rows in Supabase RLS.

## Tooling Rules

- Install dependencies with `npm install`.
- Run the local dev server with `npm run dev`.
- Build with `npm run build`.
- Never run `npm run build` while a Next.js development server is running in this repository. Both commands write to `.next`; stop the dev server before building, then clear the generated cache before restarting development so LAN devices cannot receive mismatched HTML, CSS, or JavaScript assets.
- Start a production build with `npm start`.
- `npm run lint` currently calls `next lint`; verify the installed Next.js version still supports that command before relying on it.
- Do not use Playwright or browser screenshots for straightforward issues that can be determined from markup, selectors, CSS, or layout rules. Use rendered browser inspection only when the task genuinely requires visual judgment—for example composition, hierarchy, density, motion, responsive behavior, or an ambiguity that code inspection cannot resolve.

Current local shell note:

- Node `v18.17.1` is on PATH.
- Current `latest` dependency resolution includes packages that require Node 20+.
- Use Node 20+ for local install/build unless dependencies are intentionally pinned lower.
- Supabase admin/auth work depends on `@supabase/supabase-js` and `@supabase/ssr`.

## Mandatory Update Protocol

After every meaningful change:

- Update `CONTEXT.md` with what changed, why it changed, current status, verification, known issues, and next steps.
- Keep `CONTEXT.md` compact. It is current working memory, not a full historical changelog.
- Keep `Recent Changes` to the latest high-signal entries only.
- Update `AGENTS.md` if architecture boundaries, workflow rules, dependencies, tools, or product guidance changed.
- Update `README.md` when setup, deployment, or required environment variables change.

A meaningful change includes changed positioning, changed layout, changed dependency/tooling, changed form behavior, changed deployment requirements, verification results, or completion-status changes.

For case-study projects, completion-status changes must also record whether database promotion is awaiting user approval, approved and in progress, or verified complete.

## Git Notes

The repository was initialized on branch `main`.

Git safe-directory has been configured for this exact repository path for the current shell user:

`E:/Documents/Projects/Freelance Starter Pack/portfolio-nextjs`

Do not use ownership or ACL changes to fix Git access unless the user explicitly asks. The safe-directory entry is the intended non-ownership-changing fix.

## Visual design work

For appearance-led frontend tasks involving stylized compositions, decorative
systems, procedural graphics, SVG/Canvas artwork, or significant visual
art-direction work, use the `visual-design` skill in
`.codex/skills/visual-design/SKILL.md`.

## Do Not

- Do not make the site feel like a fake terminal, cyberpunk demo, animated showcase, or generic SaaS landing page.
- Do not add decorative motion that delays access to content.
- Do not add broad dependency weight for simple UI.
- Do not remove the direct email fallback when editing the contact form.
- Do not claim the site is deployment-ready until metadata URLs, contact sender configuration, and a production build are verified.
