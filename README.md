# Akash Das Portfolio

A restrained, client-facing portfolio built with Next.js App Router and TypeScript.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

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
- Admin project forms accept the prepared semantic/lens pair. The server rejects executable or external SVG content, verifies every semantic primitive retains its renderer ID/class/ownership fields, verifies matching viewBoxes and bounded lens paths, uploads both objects under content-versioned paths with a one-year cache lifetime, and writes both references into the validated document. The Server Action upload limit is 32 MB and the Storage bucket permits 25 MB per SVG.

Prepare a PCB Art Generator render before uploading it through admin:

```bash
npm run prepare:pcb-background -- path/to/generated.svg path/to/background.svg path/to/background-lens.svg
```

The optional final argument overrides the default `400`-unit lens cell size. The first output preserves every generated line and form—including all small circles and markers—plus the renderer's stable IDs, classifications, labels, and ownership data. The second output compounds the same visible geometry only within local paint cells for the 330px luminance lens. Background removal, palette changes, and deliberate stroke treatment adjust presentation; neither output may add, delete, reroute, reshape, simplify, or reinterpret the renderer's geometry.
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
5. Deploy to Netlify or any Node-compatible host.

## Design direction

- Near-black neutral palette
- One restrained icy-blue accent
- Typography-led hierarchy
- Minimal motion
- No decorative developer clichés
- Accessible focus states and reduced-motion support
