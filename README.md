# Akash Das Portfolio

A restrained, client-facing portfolio built with Next.js App Router and TypeScript.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

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
- Project records.
- Contact-form lead records.
- Future selected Gmail message records.

Add the Supabase values to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
ADMIN_EMAILS=akash42662012@gmail.com
```

Create the database tables by running `supabase/schema.sql` in the Supabase SQL editor.
Seed the current selected work by running `supabase/seed.sql` after the schema is created.

Notes:

- `/admin` shows fallback project data until Supabase is configured.
- Admin access is restricted to emails in `ADMIN_EMAILS` and matching rows in `public.admin_users`.
- Public Work uses published Supabase projects when available, then falls back to `lib/content.ts`.
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
