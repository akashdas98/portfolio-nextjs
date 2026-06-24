# CONTEXT

## Current Intent

This portfolio exists to sell Akash Das as a senior full-stack developer for clean, user-friendly websites and web applications.

The core offer is one experienced technical partner across UI/UX planning, frontend development, backend architecture, deployment, and maintenance.

The site should make competence feel obvious without overselling. It should read like an established technical brand, not a freelancer asking to be trusted.

## Positioning

Primary headline:

Senior Full-Stack Developer for Clean, User-Friendly Websites and Web Applications

Portfolio headline:

Clean, Reliable Web Products Built End to End

Safe UI/UX claim:

I create clean, professional interfaces using established UI/UX principles, responsive design and reusable design systems.

Do not position Akash as a dedicated UI/UX designer. The claim is UI/UX-informed engineering.

## Voice

Use direct, client-facing language.

Prefer:

- Built for
- Designed to
- End-to-end
- Reliable by design
- Clear, maintainable, and ready to scale
- Existing systems, improved without unnecessary disruption
- Technical complexity translated into dependable products

Avoid:

- I can help with
- I can build
- I can investigate
- I am able to
- Whether you need
- My services include

Use first person selectively. Most service and project copy should focus on outcomes.

## Visual Direction

The desired impression is cold competence: controlled, sharp, calm, confident, and not sterile.

Use:

- Near-black or deep-charcoal background
- Slightly lighter surfaces
- Soft off-white primary text
- Muted cool-grey secondary text
- Low-contrast borders
- One restrained icy-blue, steel-blue, or desaturated-cyan accent
- Typography-led hierarchy
- Spacious but purposeful layout
- Subtle hover and reveal motion

Avoid:

- Bright gradients
- Neon cyberpunk styling
- Decorative blobs
- Fake terminal aesthetics
- Code rain
- Heavy glassmorphism
- Multiple accent colors
- Scroll-jacking, parallax, magnetic buttons, cursor effects, or long intro animations

## Current Site Structure

Navigation:

- Work
- Services
- About
- Contact

Main sections:

- Hero
- Selected work
- Additional impact
- Services
- About
- Technical foundation
- Contact

Selected work:

- Ecommerce Delivery Intelligence Platform
- Centralized Lead Capture and Routing Platform
- Horecah Hospitality Hiring Application

Additional impact:

- Customer communication automation
- Healthcare and hospital platforms
- Mobile patient-management application
- OCR document processing prototype

Services:

- Business Websites
- Custom Web Applications
- Application Rescue
- Ongoing Support

## Technical Context

Framework:

- Next.js
- TypeScript
- App Router
- Server Components by default

Styling:

- Global CSS in `app/globals.css`
- Custom CSS variables for tokens
- No component library

Contact:

- `components/ContactForm.tsx` posts to `app/api/contact/route.ts`
- API validates with Zod
- Email delivery uses Resend
- Required environment variables:
  - `RESEND_API_KEY`
  - `CONTACT_TO_EMAIL`
  - `CONTACT_FROM_EMAIL`

Deployment notes:

- Replace placeholder production URLs in metadata, sitemap, and robots before launch.
- Verify Resend sender domain before relying on the form.
- Direct email link remains the fallback.

## Known Watchpoints

- Some source files currently contain mojibake characters from encoding issues, such as broken middots, rupee symbols, arrows, and apostrophes. Fix these deliberately when touching nearby copy.
- The global CSS currently uses strong negative letter spacing in large headings. Any design pass should verify readability on mobile.
- `package.json` uses `latest` dependency ranges. Pin versions before a serious deployment if repeatable builds matter.
- `next lint` may not be available depending on the installed Next.js version.

