# Portfolio Context

## Current Status

This repository is a Next.js App Router portfolio site at:

`E:\Documents\Projects\Freelance Starter Pack\portfolio-nextjs`

Current work item: establish durable repo memory, initialize Git, and push the project to GitHub.

Current implementation state:

- Portfolio site source exists with App Router, TypeScript, global CSS, reusable components, structured content, metadata, sitemap, robots, and a Resend-backed contact API.
- `AGENTS.md` and `CONTEXT.md` now exist in the same compact ledger style as the MafiaGame project memory files.
- Git is initialized on branch `main`.
- Initial baseline commit exists.
- GitHub repository exists as a private repo at `git@github.com:akashdas98/portfolio-nextjs.git`.

Current estimated completion:

- Repo memory files: complete.
- Local Git initialization: complete.
- Initial commit: complete.
- Local dependency install/build verification: blocked by Node/runtime tooling.
- GitHub push: ready after committing this context update.

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
| Metadata/sitemap/robots | Implemented with placeholder deployment URL | Replace placeholder production URL before launch. | Domain/deployment target changes. |
| Dependencies | Uses `latest` ranges | Use Node 20+ or pin versions before serious deployment. | User accepts floating latest versions. |
| Local install/build | Blocked | Retry with Node 20+ available on PATH. | Dependencies are pinned to Node 18-compatible versions. |
| Git repo | Complete | Add remote and push. | User wants a different branch or history. |
| GitHub push | Ready | Push `main` to `origin`. | Remote target changes. |

## Completed Foundation

- `AGENTS.md` and `CONTEXT.md` exist and must be read before work.
- Git is initialized on `main`.
- Initial commit exists: `0a226dd Initial portfolio baseline`.
- GitHub repository exists as private repo `akashdas98/portfolio-nextjs`.
- `origin` points to `git@github.com:akashdas98/portfolio-nextjs.git`.
- Git safe-directory is configured for this repo path.
- `.gitignore` excludes local dependencies, build outputs, Vercel state, logs, and environment files.
- Contact form environment variables are documented in `.env.example` and `README.md`.

## Current Architecture Notes

- `app/page.tsx` renders the main one-page portfolio.
- `components/Header.tsx` owns fixed header and mobile nav behavior.
- `components/ContactForm.tsx` owns client-side form state and posts to `/api/contact`.
- `app/api/contact/route.ts` validates submissions with Zod and sends email through Resend.
- `components/ProjectCard.tsx` renders selected work cards from structured content.
- `components/SystemVisual.tsx` renders simple CSS-based visuals for project cards.
- `lib/content.ts` stores selected work and service content.
- `app/globals.css` owns design tokens, layout, responsive behavior, and motion.

## Active Gaps

1. Local build verification:
   The current shell has Node `v18.17.1`. The `latest` dependency resolution includes `next@16.2.9` and `resend@6.14.0`, which require Node 20+. `npm install` exited with an npm error and did not create a usable `next` binary.

2. Encoding cleanup:
   Several source files contain mojibake from encoding issues, including broken middots, rupee symbols, arrows, apostrophes, and dashes. Fix these deliberately in a separate copy pass or when editing adjacent text.

3. Launch readiness:
   Placeholder deployment URLs still need replacement in metadata, sitemap, and robots. Resend sender configuration still needs real production values.

## Pending

- Push `main` to GitHub.
- Use Node 20+ and rerun `npm install`.
- Run `npm run build`.
- Replace placeholder domain values before deployment.
- Configure Resend sender values in `.env.local` for local testing and in the deployment environment for production.
- Review mobile and desktop layouts after any copy or styling changes.

## Assumptions

- The production branch should be `main`.
- GitHub should receive the current local history unless the user asks for a different commit structure.
- The current visual direction should remain restrained and typography-led.
- The contact form should keep direct email as a fallback.
- The site can target Node 20+ for deployment unless the user explicitly needs Node 18 compatibility.

## Known Issues

- `npm install` failed under Node `v18.17.1` after resolving packages that require Node 20+.
- `npm run build` failed because the failed install did not leave a usable `next` binary.
- GitHub CLI was installed with winget, but the current shell may not have the new PATH entry; direct path is `C:\Program Files\GitHub CLI\gh.exe`.
- GitHub CLI token storage rejected a repo-only device token because it wanted `read:org`; repo creation was completed through the GitHub API instead.
- Git operations in this workspace may require elevated filesystem access to write `.git` metadata.
- The current dependency ranges use `latest`, so future installs may change behavior unless versions are pinned.
- Some existing project files contain mojibake text.

## Important Deviations From Launch-Ready

- The site has not been successfully built in this local shell.
- The contact form is not production-ready until Resend environment variables and sender verification are configured.
- Metadata, sitemap, and robots still need the real production domain.
- Dependency versions are not pinned.

## Next Recommended Steps

1. Push `main` to GitHub.
2. Install Node 20+ or switch PATH to an existing Node 20+ runtime.
3. Run `npm install`.
4. Run `npm run build`.
5. Decide whether to pin dependency versions instead of keeping `latest`.
6. Fix mojibake text across `app/page.tsx`, `lib/content.ts`, `README.md`, `portfolio-structure.md`, and `positioning.md`.
7. Replace placeholder domain values in `app/layout.tsx`, `app/sitemap.ts`, and `app/robots.ts`.

## Recent Changes

- 2026-06-24: Created root `AGENTS.md` and `CONTEXT.md` using the MafiaGame compact agent-guide and status-ledger style.
- 2026-06-24: Initialized Git on branch `main`, configured Git safe-directory for the repo path, staged the full project, and created the initial baseline commit.
- 2026-06-24: Attempted local dependency install and build. Verification is blocked by Node 18 while the resolved latest packages require Node 20+.
- 2026-06-24: Created private GitHub repository `akashdas98/portfolio-nextjs` and set `origin` to the SSH remote.
