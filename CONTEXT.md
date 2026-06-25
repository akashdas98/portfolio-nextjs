# Portfolio Context

## Current Status

This repository is a Next.js App Router portfolio site at:

`E:\Documents\Projects\Freelance Starter Pack\portfolio-nextjs`

Current work item: refine the public selected-work layout and continue the admin/project workflow buildout.

Current implementation state:

- Portfolio site source exists with App Router, TypeScript, global CSS, reusable components, structured content, metadata, sitemap, robots, and a Resend-backed contact API.
- Admin/project/lead plan now targets free-tier-first Netlify + Supabase + Resend, with Gmail sync delayed.
- `AGENTS.md` and `CONTEXT.md` now exist in the same compact ledger style as the MafiaGame project memory files.
- Git is initialized on branch `main`.
- Initial baseline commit exists.
- GitHub repository exists as a private repo at `git@github.com:akashdas98/portfolio-nextjs.git`.
- GitHub CLI is installed and authenticated for `akashdas98` through the Windows keyring.
- Local dependencies install successfully when Node 24 is on PATH and npm uses the public registry.
- The dev server is running at `http://localhost:3000`; port 3000 is currently owned by PID 10748.
- Admin panel foundation now exists under `/admin` with Supabase Auth wiring, project CRUD screens/actions, lead actionable screens/actions, settings checks, schema, and seed SQL.
- Admin access is now restricted by a server-side `ADMIN_EMAILS` allowlist plus matching `public.admin_users` rows in Supabase RLS.
- Local `.env.local` now has Supabase and Resend values. Supabase connectivity has been verified: `projects` has 3 seeded rows and `leads` has 0 rows.
- Supabase Auth admin user exists for `akash42662012@gmail.com`; sign-in was verified through the Supabase client.

Current estimated completion:

- Repo memory files: complete.
- Local Git initialization: complete.
- Initial commit: complete.
- Local dependency install: complete.
- Local dev server startup: complete.
- Production build verification: complete.
- GitHub push: complete.

## Operating Rule

Before continuing work, check this file's `Status Ledger`, `Known Issues`, and `Next Recommended Steps`.

Keep this file compact. It is working memory, not a full changelog. Use Git history for detailed change history and `portfolio-structure.md` / `positioning.md` for durable product direction.

## Status Ledger

| Area | Status | Do Next | Do Not Rework Unless |
| --- | --- | --- | --- |
| Root memory files | Complete | Keep them accurate after meaningful changes. | User asks for a different format. |
| Product positioning | Defined | Preserve senior full-stack, UI/UX-informed, end-to-end delivery framing. | `positioning.md` changes. |
| Portfolio content | Implemented from outline | Fix encoding issues deliberately when touching nearby copy. | Copy strategy changes. |
| Visual direction | Implemented as restrained dark UI | Verify mobile/desktop polish before launch. | User requests a redesign. |
| Contact form | Implemented with Resend | Configure real env vars and verified sender before launch. | Contact provider changes. |
| Deployment target | Planned | Use Netlify Free first; keep Vercel as an option if Next.js hosting needs outgrow Netlify. | User chooses another host. |
| Metadata/sitemap/robots | Implemented with Vercel production URL | Update if the production domain changes. | Domain/deployment target changes. |
| Dependencies | Uses `latest` ranges | Use Node 20+ or pin versions before serious deployment. | User accepts floating latest versions. |
| Local install | Complete with Node 24 and public npm registry | Keep lockfile URLs on public npm registry. | Dependency strategy changes. |
| Dev server | Running | Use `http://localhost:3000`; restart after route-convention changes such as `middleware.ts` to `proxy.ts`. | Port or framework changes. |
| Production build | Complete | Re-run after code or dependency changes. | Build tooling changes. |
| Git repo | Complete | Add remote and push. | User wants a different branch or history. |
| GitHub push | Complete | Use normal Git workflow from `main`. | Remote target changes. |
| GitHub CLI auth | Complete | Use `gh` for future repo/PR/API work. | Token is revoked or account changes. |

## Completed Foundation

- `AGENTS.md` and `CONTEXT.md` exist and must be read before work.
- Git is initialized on `main`.
- Initial commit exists: `0a226dd Initial portfolio baseline`.
- GitHub repository exists as private repo `akashdas98/portfolio-nextjs`.
- `origin` points to `git@github.com:akashdas98/portfolio-nextjs.git`.
- GitHub CLI is installed at `C:\Program Files\GitHub CLI\gh.exe` and authenticated as `akashdas98`.
- Git safe-directory is configured for this repo path.
- `package-lock.json` tarball URLs were normalized to `https://registry.npmjs.org/` so installs do not depend on an internal registry gateway.
- `.gitignore` excludes local dependencies, build outputs, Vercel state, logs, and environment files.
- Contact form environment variables are documented in `.env.example` and `README.md`.

## Current Architecture Notes

- `app/page.tsx` renders the main one-page portfolio and reads published Supabase projects when available, falling back to static content.
- `components/Header.tsx` owns fixed header and mobile nav behavior.
- `components/ContactForm.tsx` owns client-side form state and posts to `/api/contact`.
- `app/api/contact/route.ts` validates submissions with Zod, optionally inserts leads into Supabase with the server-only Supabase secret key, and sends email through Resend.
- `app/admin/` owns the protected admin dashboard, login, project CRUD, lead actionables, and settings routes.
- `components/ProjectCard.tsx` renders selected work cards from structured content.
- `components/ProjectVisitButton.tsx` renders the project Visit Website arrow button and calculates inner polygon values from a passed border width while preserving the original outer arrow geometry.
- `components/SystemVisual.tsx` renders simple CSS-based visuals for project cards.
- `lib/admin/` maps Supabase rows or static fallback content into admin/public screens.
- `lib/admin/authorization.ts` and `lib/admin/session.ts` enforce admin email authorization for route guards and mutating server actions.
- `lib/supabase/` owns Supabase config and browser/server/admin clients.
- `lib/content.ts` stores selected work and service content.
- `app/globals.css` owns design tokens, layout, responsive behavior, and motion.
- `proxy.ts` protects admin routes when Supabase Auth env vars are configured.
- `supabase/schema.sql` defines admin users, projects, leads, and future selected-email tables with admin-only RLS for private tables.
- `supabase/seed.sql` seeds the current admin email and selected-work projects.
- Project records no longer include an `additional_impact` field in the app model, form, actions, schema, or seed files.

## Active Gaps

1. Encoding cleanup:
   Several source files contain mojibake from encoding issues, including broken middots, rupee symbols, arrows, apostrophes, and dashes. Fix these deliberately in a separate copy pass or when editing adjacent text.

2. Launch readiness:
   Metadata, sitemap, and robots now use the Vercel production URL. Resend sender configuration still needs final production values if moving beyond the zero-cost default sender.

3. Admin completion:
   Gmail label sync, selected email review, richer lead filters, and project deletion are not built yet.

4. Supabase schema application:
   The tightened admin authorization SQL has been added locally. Run the updated `supabase/schema.sql` and `supabase/seed.sql` in Supabase before relying on database-side admin restrictions in the hosted project.

## Pending

- Keep `main` pushed to GitHub after changes.
- Build the planned text-led project, admin-project, and freelance-lead tracking workflow from `docs/admin-projects-and-leads-plan.md`.
- Keep production domain values aligned with the deployed URL.
- Configure Resend sender values in `.env.local` for local testing and in the deployment environment for production.
- Supabase env vars are configured locally, schema/seed appear applied, and the admin Auth user has been created.
- Review mobile and desktop layouts after any copy or styling changes.

## Assumptions

- The production branch should be `main`.
- GitHub should receive the current local history unless the user asks for a different commit structure.
- The current visual direction should remain restrained and typography-led.
- The contact form should keep direct email as a fallback.
- The site can target Node 20+ for deployment unless the user explicitly needs Node 18 compatibility.
- Supabase Free is the planned backend for admin auth, project CRUD, lead tracking, and later selected Gmail sync.
- Supabase env naming uses current dashboard keys: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. Legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` still work as fallbacks.
- `ADMIN_EMAILS` is a comma-separated server-side allowlist; current default/fallback is `akash42662012@gmail.com`.

## Known Issues

- The shell may initially resolve Node `v18.17.1`; refresh PATH from machine/user environment variables to resolve Node `v24.18.0`.
- GitHub CLI was installed with winget. Existing shells may not have the new PATH entry; direct path is `C:\Program Files\GitHub CLI\gh.exe`.
- GitHub CLI auth now passes for `akashdas98` through the Windows keyring. Existing shells may still need PATH refresh before `gh` resolves without the full executable path.
- Git operations in this workspace may require elevated filesystem access to write `.git` metadata.
- The current dependency ranges use `latest`, so future installs may change behavior unless versions are pinned.
- Some existing project files contain mojibake text.
- `npm install @supabase/supabase-js @supabase/ssr` reported two moderate npm audit advisories; no force fix has been applied.

## Important Deviations From Launch-Ready

- The site has been production-built successfully in this local shell after dependency installation.
- The contact form is not production-ready until Resend environment variables and sender verification are configured.
- Database-backed projects and admin auth are locally connected. Production still needs deployment env vars.
- Metadata, sitemap, and robots use `https://freebirdakash.vercel.app`.
- Dependency versions are not pinned.

## Next Recommended Steps

1. Decide whether to pin dependency versions instead of keeping `latest`.
2. Start `npm run dev` and test `/admin/login` with the created Supabase Auth user.
3. Start Phase 1 from `docs/admin-projects-and-leads-plan.md`: remove/replace static public diagrams with tighter text-led project cards and URLs.
4. Add Gmail label sync and selected-email review after lead workflow is valuable.
5. Fix mojibake text across `app/page.tsx`, `lib/content.ts`, `README.md`, `portfolio-structure.md`, and `positioning.md`.
6. Re-check production env vars and Resend sender behavior after each deployment.

## Recent Changes

- 2026-06-24: Created root `AGENTS.md` and `CONTEXT.md` using the MafiaGame compact agent-guide and status-ledger style.
- 2026-06-24: Initialized Git on branch `main`, configured Git safe-directory for the repo path, staged the full project, and created the initial baseline commit.
- 2026-06-24: Attempted local dependency install and build. Verification is blocked by Node 18 while the resolved latest packages require Node 20+.
- 2026-06-24: Created private GitHub repository `akashdas98/portfolio-nextjs` and set `origin` to the SSH remote.
- 2026-06-24: Completed OS-level GitHub CLI authentication for `akashdas98`; `gh auth status` passes with SSH as the Git protocol.
- 2026-06-24: Refreshed PATH to use Node `v24.18.0`, normalized lockfile tarball URLs to public npm registry URLs, installed dependencies, ignored `.npm-cache`, and started the dev server at `http://localhost:3000`.
- 2026-06-24: Tightened CTA button vertical alignment, reduced the top spacing before Selected Work, darkened the Additional Impact band, and verified `npm run build` passes.
- 2026-06-24: Added `docs/admin-projects-and-leads-plan.md` covering project showcase images, DB-backed admin project editing, contact-form lead tracking, and selected freelance email sync.
- 2026-06-24: Rebuilt the EDD and Leads work-card visuals as vertical flow diagrams with arrowed connections instead of horizontal absolute-position diagrams.
- 2026-06-24: Revised the admin/projects/leads plan to use Netlify Free, Supabase Free, Resend Free, no required showcase images or diagrams, and delayed owner-only Gmail label sync.
- 2026-06-24: Updated button styling so button text renders uppercase; primary buttons use a subtle deep-blue gradient, blue border, medium text weight, and layered blue hover glow; secondary/header CTA buttons use a matching white-grey hover glow with no lift motion. Verified `npm run build` passes.
- 2026-06-24: Added Supabase dependencies, admin auth/config utilities, protected `/admin` route foundation, project/lead/settings screens, contact-form lead insertion when service credentials exist, and `supabase/schema.sql`. Verified `npm run build` passes.
- 2026-06-24: Added project create/edit/archive actions, lead status/priority/notes/follow-up actions, Supabase project seed SQL, and public Work fallback-to-Supabase published projects. Verified `npm run build` passes.
- 2026-06-24: Updated Supabase env naming to current publishable/secret keys while keeping legacy anon/service-role fallback support. Verified `npm run build` passes.
- 2026-06-24: Verified local `.env.local` has Supabase/Resend values, `npm run build` passes, and Supabase tables are reachable with 3 project rows and 0 lead rows.
- 2026-06-24: Created Supabase Auth admin user for `akash42662012@gmail.com` and verified sign-in through Supabase client. Password was shared with the user and not stored in repo memory.
- 2026-06-24: Started the Next dev server at `http://localhost:3000`; `/` and `/admin/login` both return HTTP 200.
- 2026-06-24: Reworked public project cards into a text-led two-column case-study layout: title plus challenge on the left, solution plus metrics on the right, and capabilities spanning the full bottom row. Removed diagram rendering from project cards. Verified `npm run build` passes.
- 2026-06-24: Refined project cards so the left column holds the title only, the right column stacks challenge and solution with metrics aligned lower, the website action is a visible `Visit website` link in the meta row, and capabilities remain full-width. Verified `npm run build` passes.
- 2026-06-24: Moved the challenge copy back under the project title in the left column while keeping solution and metrics on the right, with capabilities spanning the bottom row. Verified `npm run build` passes.
- 2026-06-24: Made project challenge placement dynamic: short headlines place challenge below the title to use left-column whitespace, while longer headlines keep challenge on the right. Mobile keeps title, challenge, solution, metrics, and capabilities in reading order. Verified `npm run build` passes.
- 2026-06-24: Adjusted the short-headline project layout so the solution column starts on the lower row beside the challenge instead of spanning from the headline row. Verified `npm run build` passes.
- 2026-06-24: Fixed stretched project copy blocks by aligning section-copy content to the top, keeping challenge headings and body text grouped while preserving lower-row solution alignment. Verified `npm run build` passes.
- 2026-06-24: Reworked project-card layout root cause by splitting title, challenge, solution, metrics, and capabilities into independent grid areas. Solution now aligns against the title row for short headlines, while metrics no longer force empty space under challenge. Verified `npm run build` passes.
- 2026-06-24: Reversed the bottom-align project-card changes. Project cards now use the earlier dynamic challenge placement with solution and metrics grouped in the right column, and the proof strip has horizontal padding. Verified `npm run build` passes.
- 2026-06-24: Removed the unused project `additionalImpact` admin field from the form, actions, data model, schema, and seed. Updated buttons to hard-cornered light-blue primary actions with black text and offset striped shadow shapes; `Start a Conversation` uses a pink shadow variant, and project visit links use arrow-shaped blue buttons. Verified `npm run build` passes.
- 2026-06-24: Fixed primary button layering so the striped shadow sits behind a separate button-face layer, increased button type size, made the Visit Website left notch point inward, hardened card corners with thicker borders, and replaced service pills with accent-dot-separated inline text. Verified `npm run build` passes.
- 2026-06-24: Tuned button shadows to use solid deep colors with 3px borders, coordinated face and shadow hover separation, kept Start a Conversation hover text black, preserved Visit Website vertical shadow offset while increasing horizontal separation, added vertical padding to Visit Website, and reduced service separator dot size. Verified `npm run build` passes.
- 2026-06-24: Corrected button stripe layers to solid black instead of semi-transparent black, removed Visit Website hover scaling while keeping horizontal movement, and increased Visit Website left padding by 3px. Verified `npm run build` passes.
- 2026-06-24: Removed all transparent stops from button stripe gradients so the colored stripe bands are explicit solid deep blue/pink values instead of transparency revealing a base layer. Verified `npm run build` passes.
- 2026-06-24: Changed colored stripe bands to use the same blue/pink shadow-border tokens as their outlines, so the diagonal colored fill and border match exactly. Verified `npm run build` passes.
- 2026-06-24: Tried and rolled back the experimental button face/shadow color swap. Buttons are back to light-blue faces, deep blue striped shadows, and a pink striped shadow for Start a Conversation. Verified `npm run build` passes.
- 2026-06-25: Restricted admin authorization to `ADMIN_EMAILS` plus Supabase `public.admin_users` RLS, guarded mutating admin server actions, documented the new env/schema requirement, and rebuilt Visit Website buttons with the original CSS arrow geometry. Removed the SVG attempt and restored the initial 15px right point / 12px left notch angles while using an offset inner face to keep the left angled border visible. Added `ProjectVisitButton` so border width can be passed as a prop and the inner polygon values are calculated automatically. Verified `npm run build` passes.
- 2026-06-25: Removed `autocomplete="organization"` from the `Company or project` contact field to stop browser organization autofill UI from shifting that field on focus. Verified `npm run build` passes.
- 2026-06-25: Adjusted phone-only project-card layout so `Visit website` is hidden from the meta row and rendered below metrics, aligned right at 80% width. Fixed the stretched mobile button by making the inner face span fill the same width as the outer polygon. Tablet and desktop placement remain unchanged. Verified `npm run build` passes.
- 2026-06-25: Reduced phone-only hero top padding from 140px to 110px, leaving tablet and desktop hero spacing unchanged. Verified `npm run build` passes.
- 2026-06-25: Tuned phone-only hero CTA/overview spacing: added top margin above `View selected work`, brought the overview closer to the CTAs, and set the proof strip to keep its top border with larger vertical padding. Verified `npm run build` passes.
- 2026-06-25: Set phone-only `.split-heading` gap to 40px so the Services heading and supporting paragraph sit closer together. Verified `npm run build` passes.
- 2026-06-25: Centralized major layout spacing values in CSS variables with breakpoint overrides, changed phone section padding from 78px to 80px, and set the Services header-to-list gap to a dedicated 40px variable. Verified `npm run build` passes.
- 2026-06-25: Fixed the phone service-row headline-to-copy spacing by zeroing the service headline paragraph margin and setting the mobile service row gap to an explicit 40px variable. Verified `npm run build` passes.
- 2026-06-25: Restored contact-form section spacing to the existing responsive contact grid gap after testing a tighter mobile contact gap. Verified `npm run build` passes.
- 2026-06-25: Added explicit Contact heading-to-copy spacing: 16px on larger screens and 40px on phone via CSS variables. Verified `npm run build` passes.
- 2026-06-25: Added a shared `--space-heading-copy-gap` token and wired mobile heading-to-copy gaps through it for split headings, About, Impact, Contact, and service rows. Verified `npm run build` passes.
- 2026-06-25: Removed phone-only bottom borders and bottom padding from the final Services row and final Technical foundation capability row so section-end spacing is only `--space-section-y`. Verified `npm run build` passes.
- 2026-06-25: Matched Technical foundation capability-list border thickness to the existing Services list properties without changing Services styles or Technical foundation padding. Verified `npm run build` passes.
- 2026-06-25: Replaced the mobile `MENU` text trigger with an accessible two-line hamburger icon and changed mobile nav from an isolated rounded popup to a full-width dropdown band attached to the header. Verified `npm run build` passes.
- 2026-06-25: Added a subtle mobile nav dropdown animation using opacity and vertical translate while keeping reduced-motion behavior covered by the global media rule. Verified `npm run build` passes.
- 2026-06-25: Changed the phone-specific CSS breakpoint from 620px to 480px, leaving the 900px tablet breakpoint unchanged. Verified `npm run build` passes.
- 2026-06-25: Adjusted tablet project-card meta layout so project name and category stack on separate lines while the Visit Website action spans those rows on the right. Verified `npm run build` passes.
- 2026-06-25: Tightened tablet project meta row gap between name and category and top-aligned the Visit Website action. Verified `npm run build` passes.
- 2026-06-25: Added a tablet-only `-4px` top offset to the Visit Website action in project-card metadata. Verified `npm run build` passes.
- 2026-06-25: Fixed project meta desktop regression by scoping project meta grid-area assignments to the tablet breakpoint only. Verified `npm run build` passes.
- 2026-06-25: Set phone-only project meta row spacing to 8px for clearer but restrained separation between index, name, and category. Verified `npm run build` passes.
- 2026-06-25: Removed Services and Technical foundation list top borders at tablet/mobile widths while preserving desktop borders. Verified `npm run build` passes.
- 2026-06-25: Added a subtle shadow below the fixed header with a slightly stronger scrolled state. Verified `npm run build` passes.
- 2026-06-25: Unified section heading-to-content spacing through `--space-section-heading-bottom`: 64px default, 50px tablet, and 40px phone. Removed the Services-specific heading gap override so section headings use one shared token. Verified `npm run build` passes.
- 2026-06-25: Folded the remaining Services, Additional impact, About, and Contact section gap variables back into `--space-section-heading-bottom`, including split-heading, impact/about/contact grids, contact heading copy, and mobile service row gaps. Verified `npm run build` passes.
- 2026-06-25: Restored Contact heading-to-copy spacing to its original 16px desktop-only exception while keeping tablet/phone on `--space-section-heading-bottom`, and bottom-aligned Additional impact copy only on big screens. Verified `npm run build` passes.
- 2026-06-25: Changed Additional impact copy on big screens from bottom-aligned as a block to a stretched vertical column with `space-between` between the paragraph and metrics; tablet/phone keep the stacked metrics spacing. Verified `npm run build` passes.
- 2026-06-25: Adjusted big-screen Additional impact copy again to vertically center the paragraph and metrics as a group with a fixed 54px gap instead of stretching them apart; tablet/phone remain stacked. Verified `npm run build` passes.
- 2026-06-25: Updated contact-form email labeling so inbox messages read as work leads: subject is now `New work enquiry from {name}`, the body starts with `New portfolio work enquiry`, and the documented sender display name is `Portfolio Work Leads`. Verified `npm run build` passes.
- 2026-06-25: Replaced placeholder production URLs in metadata, sitemap, and robots with `https://freebirdakash.vercel.app`, and updated deployment notes accordingly. Verified `npm run build` passes.
