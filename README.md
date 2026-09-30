# Akash Das Portfolio

A restrained, client-facing portfolio built with Next.js App Router and TypeScript.

## Agent workflow

Open Codex in this repository. [AGENTS.md](AGENTS.md) is the automatic instruction entry point; it requires reading Current Task in [CONTEXT.md](CONTEXT.md), then relevant issue/approval rows on demand before affected project work and preserving changed restart state. Same-session follow-ups reuse valid context; acknowledgements and already-complete continuations need no tool or memory cycle. Detailed rules are loaded only for the affected task through the root routing table. Keep current state small; historical memory is excluded from normal startup.

The dependency-free memory structure checker is:

```bash
node scripts/check-agent-memory.mjs
```

It checks file budgets, required state fields, promotion statuses, and agent-document links. Reading and checkpointing are agent-executed instructions, not a background service; this check cannot prove their timing or semantic correctness. See [agent architecture](docs/agent/workflow.md) for ownership, recovery, and fresh-session verification.

## Run locally

Routing guard operation and the checked parent launcher are documented in
[the routing guide](scripts/agent-routing/README.md). Project hooks are installed
in `.codex/hooks.json`; review and trust them using Codex `/hooks` before relying
on them. Check discovery and trust with `node scripts/agent-runtime/inspect.mjs`.
The guard does not enforce all parent launches or spending limits.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Optionally specify a port (omit it to keep the default of `3000`):

```bash
npm run dev -- --port 3001
```

Then open `http://localhost:3001`. The `--` forwards options to Next.js;
`-p 3001` is also supported.

For testing from another device on the same `192.168.0.x` network, bind the
development server to the LAN and open the computer's current IPv4 address:

```bash
npm run dev -- --hostname 0.0.0.0
```

`allowedDevOrigins` covers the local `192.168.0.*` subnet, so DHCP address
changes within that subnet do not require a configuration edit.

Development CSS and JavaScript responses are sent with `no-store`; HTML must
revalidate, and pages restored from the browser back/forward cache reload once.
This keeps LAN devices on the current development asset set. Keep only one
Next.js writer active: stop the dev server and clear `.next` before running a
production build, then clear `.next` again before returning to development.

## Contact form

The form uses Resend for email delivery. Copy `.env.example` to `.env.local` and add:

```env
RESEND_API_KEY=your_key
CONTACT_TO_EMAIL=akash42662012@gmail.com
CONTACT_FROM_EMAIL=Portfolio Work Leads <your_verified_sender@example.com>
```

Without these values, the site remains usable and the direct email link still works.

## Admin panel

The admin panel lives under `/admin`. It is designed for Netlify Free + Supabase Free + Resend Free.

Supabase is used for:

- Admin authentication.
- Project records, case-study availability, and versioned case-study layout documents.
- Project-owned case-study SVG backgrounds in the public `case-study-assets` Storage bucket.
- Contact-form lead records.
- Future selected Gmail message records.

Add the Supabase values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
ADMIN_EMAILS=akash42662012@gmail.com
```

For a new database, create the tables and Storage policies by running `supabase/schema.sql` in the Supabase SQL editor, then run `supabase/seed.sql`. Promoted project SVG objects must also be uploaded to the document-declared paths in the `case-study-assets` bucket.

For an existing linked database, apply incremental changes with:

```bash
npx supabase db push
```

The committed files in `supabase/migrations/` preserve those remote schema changes.

Notes:

- `/admin` shows fallback project data until Supabase is configured.
- Admin access is restricted to emails in `ADMIN_EMAILS` and matching rows in `public.admin_users`.
- Public Work uses published Supabase projects when available, then falls back to website-only project cards from `lib/content.ts`; static fallback cards never expose case studies.
- `has_case_study` controls whether a project card links to `View Case Study` or the external `Visit Website` action.
- Case-study content and section composition are stored in `case_study_document` as schema-versioned JSON and validated before rendering.
- A schema-v3 case-study document owns paired Storage-backed PCB references: an individually classified semantic background plus an exact-geometry spatial lens projection. It can also select a validated hero visual. The promoted Delivery Intelligence document owns the EDD copy, integration nodes, responsive geometry, connections, SVG paths, and compact/mobile/tablet breakpoints; the frontend retains only validated generic renderers, upload validation, and shared visual primitives.
- Admin project forms accept the depth-defined semantic/lens pair. The server rejects executable or external SVG content, requires one hidden internal depth reference to the unchanged semantic source, verifies every semantic primitive retains its renderer ID/class/ownership fields, verifies matching viewBoxes and bounded lens paths, uploads both objects under content-versioned paths with a one-year cache lifetime, and writes both references into the validated document. The Server Action upload limit is 32 MB and the Storage bucket permits 25 MB per SVG.

For every PCB generation request, follow the [PCB generation procedure](docs/agent/pcb-generation.md) to measure each current full page, run the external renderer without a seed unless one is supplied, and respect site versus project asset ownership. Prepare a render before uploading it through admin:

```bash
npm run prepare:pcb-background -- path/to/generated.svg path/to/background.svg path/to/background-lens.svg
npm run attach:pcb-depth -- path/to/background.svg path/to/background-with-depth.svg
```

The optional final argument to `prepare:pcb-background` overrides the default `400`-unit lens cell size. Its first output preserves every generated line and form—including all small circles and markers—plus the renderer's stable IDs, classifications, labels, and ownership data. Its second output compounds the same visible geometry only within local paint cells for bounded rendering. `attach:pcb-depth` wraps the unchanged semantic primitives and adds one hidden translated-source definition; it does not paint or visibly duplicate that geometry. Upload the depth-defined semantic output together with the unchanged lens output. At runtime, the public renderer measures native bounds once and builds local vector SVG resources containing only intersecting unchanged paths. Positive geometry and the 1px-down depth highlight paint directly; small negative cutouts use bounded masks. All vector tiles replace the prior layout together after decoding. The viewport-fixed hover lens uses native spatial paths selected from cached bounds, keeping geometry aligned during native scrolling. Exact palette and rendering constraints live in [the visual rules](docs/agent/visual.md).

- Case-study projects are developed locally while their layouts are being iterated. Project-specific content, responsive geometry, paths, and breakpoints are promoted to validated `case_study_document` data only after explicit user approval.
- Database promotion is the completion gate: upload and verify the finalized document, update seeds/migrations where applicable, then remove duplicated project-specific local data. Only generic renderers and shared visual primitives remain in frontend code.
- `/work/[slug]` is database-only and returns not found unless the published Supabase project has both an enabled flag and a valid stored document.
- Contact submissions are saved to Supabase only when `SUPABASE_SECRET_KEY` is configured.
- Keep `SUPABASE_SECRET_KEY` server-only. Do not expose it in client code.

## Before deployment

1. Confirm `https://freebirdakash.vercel.app` in `app/layout.tsx`, `app/sitemap.ts`, and `app/robots.ts` still matches the production domain.
2. Add a custom Open Graph image if desired.
3. Verify the sender domain in Resend.
4. Configure Supabase environment variables if the admin panel or lead capture should be active.
5. The connected Vercel project deploys pushes to `main` at `https://freebirdakash.vercel.app`. Verify the exact Git SHA through the Vercel GitHub deployment status and check the public routes/assets after completion. Other Node-compatible hosts require their own configuration.

## Design direction

- Near-black neutral palette
- One restrained icy-blue accent
- Typography-led hierarchy
- Minimal motion
- No decorative developer clichés
- Accessible focus states and reduced-motion support

### Touch delivery and lifecycle verification

Run `node --experimental-strip-types --test scripts/pcb-touch-geometry-warmup.test.mjs scripts/pcb-touch-preparation.test.mjs scripts/pcb-geometry-delivery.test.mjs` for bounded plain-geometry coverage, cancellation and scheduling checks. With the site running and an installed Playwright module/browser, run `node scripts/verify-pcb-touch-lifecycle.mjs http://127.0.0.1:3000` (optional final `webkit`) for release/new-contact and activation-during-scroll regressions. The script uses a local Playwright package or the Windows installed-browser link registry; these checks do not replace physical-device momentum/pinch verification.
