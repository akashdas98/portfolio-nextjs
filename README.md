# Akash Das Portfolio

A restrained, client-facing portfolio built with Next.js App Router and TypeScript.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Contact form

The form uses Resend. Copy `.env.example` to `.env.local` and add:

```env
RESEND_API_KEY=your_key
CONTACT_TO_EMAIL=akash42662012@gmail.com
CONTACT_FROM_EMAIL=Portfolio <your_verified_sender@example.com>
```

Without these values, the site remains usable and the direct email link still works.

## Before deployment

1. Replace `https://example.com` in `app/layout.tsx`, `app/sitemap.ts`, and `app/robots.ts` with the real domain.
2. Add a custom Open Graph image if desired.
3. Verify the sender domain in Resend.
4. Deploy to Vercel or any Node-compatible host.

## Design direction

- Near-black neutral palette
- One restrained icy-blue accent
- Typography-led hierarchy
- Minimal motion
- No decorative developer clichés
- Accessible focus states and reduced-motion support
