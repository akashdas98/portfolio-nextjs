# Work and Product Presentation Overhaul

## Status

Design direction approved in principle. Implementation is intentionally deferred.

This document defines how the portfolio should present:

- one independently owned live product;
- several independently owned live products;
- selected client and company work;
- the broader work catalogue;
- full client case studies;
- full stories for independently owned products;
- smaller projects that need only compact evidence.

The purpose is to create clear editorial hierarchy instead of presenting every project as an equal card in one increasingly crowded grid.

## Core Positioning Decision

Independently owned products are the strongest evidence of complete product ownership. They show the ability to identify an opportunity, research a domain, define a product, design its experience, engineer it, deploy it, operate it, and continue improving it.

Once an owned product is polished, live, and supported by credible product evidence, it should appear before selected client work on the homepage.

Client work remains essential. It proves that the same judgment and engineering depth have delivered meaningful outcomes inside established businesses and production environments. It should validate the owned-product claim rather than define the entire portfolio identity.

Do not describe a live owned product as a `personal project`. Prefer:

- `Independent product`
- `Built and operated independently`
- `Researched, designed, engineered, deployed, and operated end to end`

## Target Homepage Hierarchy

When at least one owned product is ready to feature, the homepage order should become:

1. Hero
2. Independent Product or Independent Products
3. Selected Client Work
4. View More Work
5. Services
6. About
7. Technical Foundation
8. Contact

## State One: One Live Owned Product

With only one live owned product, do not render a one-card product grid or use collection language. Present it as a singular flagship editorial feature.

Recommended section labels include:

- `Independent Product`
- `Built and Operated`
- `Product in Production`

The initial Quilt Calculations and Planning Toolkit feature should feel like a condensed product landing page inside the portfolio, not another Selected Work card.

### Flagship Composition

The section should contain:

- an `Independent product · Live` status line;
- the product name and a concise audience-focused proposition;
- one dominant product-interface or workflow visual;
- a short explanation of the user problem and product premise;
- an explicit ownership statement;
- a compact set of meaningful product, scope, or operational evidence;
- a primary `Explore Live Product` action;
- a secondary `Read Product Story` action.

Preferred ownership statement:

> Independently researched, designed, engineered, deployed, and operated end to end.

Avoid reducing ownership to a technology list. The presentation should foreground product judgment and living-product responsibility; technical implementation supports that story.

### Visual Treatment

The flagship should be wider, more visual, and more editorial than client project cards. It should have enough space to establish one product as a defining piece of work.

It should remain part of the portfolio's existing visual system:

- restrained near-black and charcoal surfaces;
- typography-led hierarchy;
- hard-edged composition;
- low-contrast borders;
- restrained cold accent;
- purposeful interaction feedback;
- no startup-style gradient treatment or oversized marketing ornament.

The product interface remains the visual focal point. Decorative treatments must not compete with it.

## State Two: Multiple Live Owned Products

The single-product system should evolve without a redesign when more owned products launch.

The section label changes from singular to `Independent Products`. The strongest or most strategically relevant product keeps the large flagship position. Additional products appear beneath it as smaller supporting entries.

Recommended structure:

```text
INDEPENDENT PRODUCTS

[Large current flagship product]

[Supporting product] [Supporting product]

[View all products]
```

Do not place every product into equal cards merely for consistency. Editorial priority should remain explicit.

Homepage selection can rotate over time. Removing a product from the homepage does not remove it from the portfolio; the complete collection remains available through the Work page.

## Selected Client Work

Rename the existing `Selected Work` section to `Selected Client Work` when owned products are introduced. This prevents the client section from implicitly claiming to represent every kind of work.

Its role is to show:

- meaningful business outcomes;
- production scale and reliability;
- complex system ownership;
- integration and operational depth;
- successful delivery within real organizational constraints.

Keep the homepage selection intentionally small—normally three strong case studies. New client work should not automatically expand the homepage list. Replace or rotate featured work based on relevance and proof strength.

## View More Work

Add a prominent `View More Work` link after Selected Client Work. It should lead to a dedicated `/work` page containing the complete portfolio catalogue.

The Work page should be an editorial index, not an undifferentiated wall of cards and not a long accordion-only interface.

Recommended information architecture:

```text
/work
├── Featured Client Case Studies
├── Independent Products
├── Additional Production Work
└── Experiments and Prototypes, when strategically useful
```

Categories may become filters once the catalogue is large enough, but the first implementation should prefer clear semantic sections over premature filtering controls.

### Compact Work Entries

Smaller projects should use concise evidence briefs containing:

- project and context;
- problem or opportunity;
- exact contribution boundary;
- what was delivered;
- outcome or production evidence;
- relevant technology only where it clarifies the work;
- external link when a live product or public artefact exists.

Inline expansion is acceptable for quick browsing, but every meaningful project should have a stable address or deep link. A prospect should be able to share or revisit one specific project without reopening and searching through an accordion.

## Two Distinct Long-Form Formats

Owned products and client work must not be forced through the same narrative template.

They may share global portfolio typography, spacing, navigation, backgrounds, actions, and safe layout primitives. Their editorial structures should remain distinct.

### Client Case Study

A client case study answers:

> What business problem existed, what was owned, what was delivered, and what measurable impact did the work create?

Its typical evidence structure includes:

- operating problem;
- contribution and ownership boundary;
- system or workflow before and after;
- architecture and integrations;
- engineering decisions;
- production proof;
- measurable business and operational outcomes.

The existing Delivery Intelligence, Leads Management, and Horecah evidence-board language remains appropriate for this format.

### Independent Product Story

An owned-product page should be called a `Product Story` in user-facing actions. It answers:

> Why did this product need to exist, how was it discovered and shaped, and how was it taken from an idea to a living product?

The Product Story should support sections such as:

1. Product thesis — audience, problem, and reason to exist.
2. Research and discovery — domain research, workflows, terminology, and validated assumptions.
3. Product definition — requirements, scope, prioritisation, information architecture, and first-release boundary.
4. Experience design — key journeys, interaction decisions, responsive behaviour, and accessibility.
5. Domain or calculation model — rules, validation, edge cases, and explainability where relevant.
6. Engineering — architecture, data model, testing, integrations, and important implementation decisions.
7. From code to production — deployment, domains, monitoring, analytics, privacy, backups, and reliability.
8. Product evolution — feedback, corrected assumptions, releases, and current direction.
9. Current evidence — live status, supported workflows, usage, adoption, releases, or other defensible product signals.
10. Ownership — a concise statement of independent research, design, engineering, deployment, and operation.

Primary actions:

- `Explore Live Product`
- `Read Product Story`
- `View Source` only when the source is public and strategically useful.

### Product Story Visual Language

The Product Story should feel like a product-development narrative rather than a technical evidence board. Useful proof includes:

- real interface imagery;
- annotated workflows;
- research artefacts;
- early and current product states;
- decision-to-evidence connections;
- focused interactive demonstrations;
- a restrained release or evolution timeline.

It should preserve the portfolio's shared design language while communicating creation, ownership, and continuing operation.

## Responsive Behaviour

The flagship composition should recompose deliberately rather than collapse into a generic stacked project card.

At narrow widths:

- the product proposition and live status remain ahead of implementation detail;
- the main interface visual retains useful scale and legibility;
- ownership evidence becomes a compact readable list or grid;
- actions stack without losing their primary/secondary hierarchy;
- secondary decorative elements are reduced before product evidence is reduced.

The broader Work page should preserve quick scanning on mobile. Compact entries may expand vertically, but labels, contribution boundaries, and outcomes should be visible before expansion.

## Data and Route Direction

Implementation should preserve the existing database-only public detail boundary.

Recommended future distinctions:

- `work_type`: client case study, independent product, compact work entry, or experiment;
- homepage feature priority rather than relying only on chronological order;
- live-product status and live-product URL;
- detail format: client case study, Product Story, or compact evidence brief;
- stable public slugs for independently shareable entries.

Product Stories should use bounded, schema-validated database documents interpreted by generic renderers, following the existing promotion workflow. Their schema and renderer should be distinct enough to express product discovery and evolution without adding project-specific React or unrestricted markup to the database.

## Implementation Sequence for Later

1. Complete and review the first live product's evidence, imagery, and Product Story content.
2. Define the independent-product data model and validated Product Story schema.
3. Build the singular homepage flagship composition.
4. Rename `Selected Work` to `Selected Client Work` and place it after the flagship.
5. Build `/work` as a categorized editorial index with compact evidence entries and stable links.
6. Verify desktop, laptop, tablet, and mobile hierarchy before adding optional filters or additional product-card variants.
7. When a second owned product is ready, extend the singular flagship into the flagship-plus-supporting-products composition.

## Non-Goals

- Do not overcrowd the homepage to prove volume.
- Do not demote live owned products into a generic More Work list.
- Do not call production products personal projects.
- Do not make every project visually equal.
- Do not reuse the client evidence-board template unchanged for Product Stories.
- Do not build filters, carousels, or elaborate browsing controls before the amount of content requires them.
- Do not make the portfolio resemble a product marketplace or generic agency project gallery.
