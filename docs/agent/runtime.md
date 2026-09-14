# Runtime and verification workflow

Read before install, build, server operations, LAN/browser verification, or tooling changes. Process and environment facts must be observed again in each session.

- Install dependencies with `npm install`.
- Run the local dev server with `npm run dev`.
- LAN development uses the bounded `192.168.0.*` entry in `allowedDevOrigins`; do not replace it with the machine's current DHCP address, because that recreates the client-asset failure when the address changes.
- LAN development assets deliberately use `Cache-Control: no-store, max-age=0, must-revalidate`; Next.js retains its framework-owned `no-cache, must-revalidate` policy for development HTML. All development responses also carry legacy no-cache/expiry headers, and the development layout reloads pages restored from the browser back/forward cache. Keep these safeguards development-only so normal production content hashing and caching remain intact.
- Build with `npm run build`.
- Treat `.next` as single-writer state. Before starting either development or a production build, inspect the repository-specific `npm`/`next` process tree and the intended port; never infer that an earlier launcher is stopped or alive.
- Never run `npm run build` while a Next.js development server is running in this repository. Before building, stop only the verified process tree for this repository, confirm its listener is closed, validate that the resolved deletion target is this repository's `.next`, remove that generated cache, and only then build.
- After any production build—or whenever generated-asset state is uncertain—use a clean LAN-development restart: stop the verified repository process tree, confirm the port is closed, validate and remove only this repository's `.next`, start exactly one `npm run dev` writer, confirm `.next/dev` exists and `.next/BUILD_ID` does not, and request the site through its current LAN origin.
- A LAN restart is not verified merely because its launcher command returned. Before handoff, confirm the actual Next server process is alive, the expected port is listening, the LAN HTML returns `200`, its referenced CSS and JavaScript assets also return successfully, HTML carries Next's must-revalidate policy, and CSS/JavaScript carry the development no-store policy. When testing client behavior, additionally verify that the delivered assets contain the current implementation and exercise the affected behavior against the LAN origin at the relevant viewport.
- If localhost or emulation disagrees with a real device, first audit running processes, `.next` ownership, asset URLs/statuses, cache headers, hydration, and the exact LAN-delivered CSS/JavaScript. Correct an inconsistent toolchain state before changing UI behavior. Real-device results remain authoritative after the delivery path is clean.
- Start a production build with `npm start`.
- `npm run lint` currently calls `next lint`; verify the installed Next.js version still supports that command before relying on it.
- Do not use Playwright or browser screenshots for straightforward issues that can be determined from markup, selectors, CSS, or layout rules. Use rendered browser inspection only when the task genuinely requires visual judgment—for example composition, hierarchy, density, motion, responsive behavior, or an ambiguity that code inspection cannot resolve.

Current local shell note:

- The shell has previously resolved Node `v18.17.1`; inspect the current executable/version. Node 24 was used successfully in prior sessions.
- Current `latest` dependency resolution includes packages that require Node 20+.
- Use Node 20+ for local install/build unless dependencies are intentionally pinned lower.
- Supabase admin/auth work depends on `@supabase/supabase-js` and `@supabase/ssr`.
- Case-study SVG preparation is repository-owned and dependency-free: validate the semantic/lens pair, renderer classifications, matching viewBoxes, element bounds, and forbidden content before Storage upload. Do not reintroduce generic SVG optimization that can discard IDs/classes or alter authored geometry.

## Git Notes

The repository was initialized on branch `main`.

Git safe-directory has been configured for this exact repository path for the current shell user:

`E:/Documents/Projects/Freelance Starter Pack/portfolio-nextjs`

Do not use ownership or ACL changes to fix Git access unless the user explicitly asks. The safe-directory entry is the intended non-ownership-changing fix.
