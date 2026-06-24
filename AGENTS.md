# AGENTS

## Project

This is Akash Das's client-facing freelance portfolio.

It is a Next.js App Router site built to present senior full-stack engineering work with restrained UI/UX judgment. The portfolio should feel calm, precise, technically credible, and easy to scan. The design prompt is simple: not try-hard, not decorative, but functional, principled, informed, and ice cold.

Read these files before making product, copy, or design changes:

- `CONTEXT.md`
- `portfolio-structure.md`
- `positioning.md`
- `README.md`

The resume source used for the project is `resume.pdf`.

## Working Rules

- Preserve the positioning: senior full-stack developer, UI/UX-informed, end-to-end delivery, reliable systems, practical product ownership.
- Do not make the site feel like a generic developer portfolio, SaaS landing page, fake terminal, cyberpunk page, or visual-design experiment.
- Keep copy client-facing. Describe what the work delivers instead of repeatedly saying "I can".
- Keep the visual language restrained: near-black background, off-white text, muted cool greys, low-contrast borders, and one cold accent.
- Every design choice should improve hierarchy, readability, comprehension, navigation, trust, or interaction feedback.
- Prefer semantic HTML, accessible labels, keyboard support, visible focus states, and reduced-motion support.
- Keep JavaScript minimal. Use server components by default unless client behavior is required.
- Avoid unnecessary dependencies and component libraries.
- Do not commit secrets. Contact form configuration belongs in `.env.local`, based on `.env.example`.

## Code Shape

- App code lives in `app/`.
- Reusable components live in `components/`.
- Portfolio content data lives in `lib/content.ts`.
- Global design tokens and layout styles live in `app/globals.css`.
- Contact form API logic lives in `app/api/contact/route.ts`.

## Commands

- Install dependencies: `npm install`
- Run locally: `npm run dev`
- Build: `npm run build`
- Start production build: `npm start`

`npm run lint` currently calls `next lint`; verify the installed Next.js version still supports it before relying on that command.

## Quality Bar

Before handing off meaningful changes:

- Run `npm run build` when dependencies are installed.
- Check mobile and desktop layouts if the UI changes.
- Check form behavior if contact code changes.
- Verify metadata, sitemap, and robots values before deployment.
- Leave unrelated files and user changes alone.

