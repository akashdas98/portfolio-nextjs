# Admin Projects and Leads Plan

## Goal

Add three related capabilities to the portfolio:

- Keep the public Work section text-led, with project URLs instead of diagrams or showcase images.
- A private admin panel for editing portfolio projects.
- A lead-tracking admin workflow for freelance enquiries and selected freelance emails.

The public portfolio should remain restrained, fast, and client-facing. The admin side can be more utilitarian: dense, clear, and built for repeated review/update work.

## Infrastructure Decision

Use a free-tier-first stack:

- Hosting: Netlify Free.
- Database/Auth/Storage: Supabase Free.
- Contact email delivery: Resend Free.
- Selected email sync: Gmail API, added later and limited to explicitly selected freelance emails.

This keeps the portfolio inexpensive while it is still early-stage. Netlify Free is preferred for now because it can host the Next.js app with serverless route handlers and has hard monthly limits instead of surprise usage costs when auto-recharge is not enabled.

Supabase is preferred over Firebase for the admin tool because the data is relational: projects, leads, notes, actionables, follow-up dates, email threads, and links between emails and leads. Postgres will make admin tables, filtering, reporting, and future migrations cleaner than a document database.

Free-tier constraints to keep in mind:

- Netlify Free can be enough for the public portfolio and light admin use, but the app can pause if monthly limits are exhausted.
- Supabase Free should be enough for early project CRUD and lead tracking, but quotas and inactivity rules must be watched.
- Resend Free is enough for low-volume contact notifications, but sender/domain configuration must be completed before launch.
- Gmail API sync should remain owner-only/personal-use at first to avoid unnecessary OAuth verification burden.

## Phase 1: Public Work Without Diagrams

Start by simplifying the existing Work section before introducing a database.

Implementation:

- Keep project names and live URLs in `lib/content.ts`.
- Remove diagram-specific public rendering once the card structure is settled.
- Do not add fake showcase images.
- Preserve the existing descriptions, metrics, and capabilities.
- Make each project card read like a concise case study: context, what changed, delivery scope, outcome, and capabilities.

Design rules:

- Do not compensate for zero freelance-client history with fake visual proof.
- Treat existing product/company work as shipped work examples, not freelance client logos.
- Use URLs as proof of context, while keeping contribution language precise.
- Keep the card structure consistent with the current dark, precise visual system.

## Phase 2: Database-Backed Projects

Move project content from static files to Supabase Postgres once the public Work card structure is settled.

Recommended stack:

- Database: Supabase Postgres.
- Query layer: direct Supabase server client first; add Drizzle only if schema complexity justifies it.
- Auth: Supabase Auth with a single admin account to start.
- Storage: not needed unless future project files/images are added.

Project model:

- `id`
- `slug`
- `name`
- `url`
- `category`
- `challenge`
- `delivery`
- `capabilities`
- `metrics`
- `additionalImpact`
- `orderIndex`
- `status`: `draft | published | archived`
- `createdAt`
- `updatedAt`

Admin routes:

- `/admin`
- `/admin/projects`
- `/admin/projects/new`
- `/admin/projects/[id]`

Admin project actions:

- Create project.
- Edit project.
- Reorder projects.
- Publish/unpublish project.
- Archive project.
- Preview project before publishing.

Migration approach:

1. Keep `lib/content.ts` as the seed/fallback.
2. Create database schema.
3. Seed current selected work into the database.
4. Render public Work section from the database.
5. Remove static project dependency only after the DB path is stable.

## Phase 3: Contact Form Lead Tracking

Capture new freelance enquiries at the source instead of relying only on email.

Update `app/api/contact/route.ts` so each valid submission:

1. Validates the payload.
2. Saves a lead record to the database.
3. Sends the email notification through Resend.
4. Returns success to the user.

Lead model:

- `id`
- `name`
- `email`
- `company`
- `budget`
- `message`
- `source`: `portfolio-contact-form`
- `status`: `new | replied | qualified | proposal_sent | won | lost | archived`
- `priority`: `low | normal | high`
- `notes`
- `nextAction`
- `nextFollowUpAt`
- `createdAt`
- `updatedAt`

Admin lead routes:

- `/admin/leads`
- `/admin/leads/[id]`

Lead actions:

- Mark replied.
- Mark qualified.
- Mark proposal sent.
- Mark won/lost.
- Archive.
- Add internal notes.
- Set next action.
- Set next follow-up date.

This gives the admin panel an accurate list of portfolio-origin freelance leads without needing to scan the whole inbox.

## Phase 4: Selected Freelance Email Tracking

Inbox sync should come after contact-form lead tracking. It adds OAuth, privacy, sync, duplicate handling, and failure states.

Recommended approach:

- Use Gmail labels to control what enters the admin tool.
- Create a label such as `Freelance/Portfolio`.
- Sync only messages with that label.
- Do not scan the entire inbox.

Possible Gmail filters:

- Messages from the contact-form sender.
- Messages sent to the portfolio email address.
- Subjects containing `Portfolio enquiry`.
- Messages manually labeled `Freelance/Portfolio`.

Email sync model:

- `id`
- `provider`: `gmail`
- `providerMessageId`
- `providerThreadId`
- `from`
- `to`
- `subject`
- `snippet`
- `receivedAt`
- `leadId`
- `status`: `unreviewed | linked | ignored | archived`
- `createdAt`
- `updatedAt`

Email actions:

- Link email thread to an existing lead.
- Convert email into a new lead.
- Ignore email.
- Archive email from admin.
- Add follow-up action.
- Add internal note.

Privacy rule:

Only sync selected freelance emails. Prefer label-based sync over broad inbox access.

Deployment rule:

Keep Gmail sync optional and delayed. The admin tool should be useful with contact-form leads before Gmail integration is added.

## Admin UX Direction

The admin tool should feel operational, not like a marketing page.

Use:

- Dense tables.
- Status chips.
- Search and filters.
- Clear edit forms.
- A simple side navigation.
- Strong empty states.
- Audit-friendly timestamps.

Avoid:

- Large hero sections.
- Decorative cards.
- Marketing copy.
- Unnecessary animation.

Core admin navigation:

- Dashboard
- Projects
- Leads
- Email Inbox
- Settings

Dashboard widgets:

- New leads.
- Follow-ups due.
- Open proposals.
- Recently updated projects.
- Emails waiting for review.

## Suggested Build Order

1. Remove/replace public diagrams with tighter text-led project cards and URLs.
2. Deploy the current public portfolio to Netlify Free with Resend environment variables.
3. Add Supabase and seed current projects.
4. Add protected `/admin`.
5. Add project CRUD.
6. Save contact-form submissions to Supabase.
7. Add lead dashboard and actionables.
8. Add Gmail label-based sync for selected freelance emails.

## Recommended First Implementation

Start with public Work simplification and contact-form lead capture.

Do not start with Gmail sync. Contact-form lead capture is simpler, more reliable, and immediately useful. Gmail sync should be added after the admin lead workflow is already valuable.
