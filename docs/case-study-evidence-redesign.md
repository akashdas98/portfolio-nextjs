# Case Study Evidence Redesign

## Goal

Make expanded case-study pages less prose-heavy and more demonstrative.

The Delivery Intelligence case study should read like a technical evidence board: fast to scan, grounded in before/after changes, clear about business impact, and credible about production engineering depth.

## Direction

Replace long narrative sections with structured proof:

- Outcome snapshot
- Before/after comparisons
- Numbers that explain the system, not only the final result
- Workflow strips
- Decision cards
- Operational controls
- Production-readiness proof
- Short keyword-led capability summaries

Every section should quickly answer at least one question:

- What changed?
- How much did it improve?
- What complexity was handled?
- What became controllable?
- Why does this prove production ownership?

## Proposed Page Flow

1. Outcome Snapshot
   - EDD accuracy: 30% to 95%
   - Customer calls: 50% reduction
   - First response time: 10% to 60%
   - Diwali-period requests: 1.45M
   - Traffic spike handled: 199% above previous month
   - Estimated annual savings: INR 5 crore, if using the old savings-to-call-reduction relation

2. Before / After
   - Before: scattered sheets, duplicated logic, low delivery-date confidence, manual correction loops, support pressure
   - After: centralized EDD API, controlled uploads, Redis-backed read path, snapshots and restores, operational alerts

3. System In Numbers
   - Data domains combined: products, couriers, warehouses, orders, holidays, stock, manufacturing delays, cutoff rules
   - Control workflows: upload, validate, correction sheet, snapshot, restore, cache refresh, alert
   - Runtime layers: API, MongoDB, Redis, Kubernetes, admin workflows

4. Operational Control Demo
   - Upload
   - Validate
   - Generate correction sheet
   - Snapshot current collection
   - Replace active data
   - Refresh cache
   - Alert on out-of-stock or rule changes

5. Decision Cards
   - Centralized rule engine
   - Redis-backed reads
   - Admin-controlled data updates
   - Snapshot and restore safety
   - Seasonal traffic headroom
   - Cross-system delivery truth

6. Production Proof
   - Show traffic, accuracy, support impact, response improvement, and savings together.
   - Keep copy short. Let the numbers and labels do most of the work.

7. Closing Capability Band
   - Keep the existing final band concise.
   - Focus on backend architecture, API design, operational workflows, caching, scaling, and production ownership.

## Content Model Direction

The current `caseStudy.sections` model encourages prose blocks. Replace or augment it with structured data:

```ts
impactMetrics: [
  { before: "30%", after: "95%", label: "EDD accuracy" },
  { before: "10%", after: "60%", label: "first response time" },
  { value: "50%", label: "customer-call reduction" },
  { value: "INR 5 crore", label: "estimated annual savings" },
]

beforeAfter: [
  { before: "Scattered spreadsheet logic", after: "Centralized EDD API" },
  { before: "Manual correction loops", after: "Row-level correction sheets" },
]

systemNumbers: [
  { value: "8", label: "data domains combined" },
  { value: "7", label: "control workflows" },
  { value: "3", label: "runtime layers: API, cache, database" },
]

workflow: ["Upload", "Validate", "Correction sheet", "Snapshot", "Replace", "Refresh cache", "Alert"]

decisionCards: [
  {
    title: "Redis-backed reads",
    keywords: ["high-read data", "cache refresh", "seasonal load"],
  },
]
```

## Updated Metrics

Previously stated relation:

- 10% customer-call reduction ~= INR 1 crore annual savings

Updated EDD impact:

- 50% customer-call reduction
- FRT improved from 10% to 60%

If the cost-saving relationship is treated as linear:

- 1% call reduction ~= INR 0.1 crore annual savings
- 50% call reduction ~= INR 5 crore annual savings

Compared with the previous metric:

- Previous savings: INR 1 crore
- Updated estimated savings: INR 5 crore
- Difference: +INR 4 crore
- Multiple: 5x the previous savings estimate
- Increase over previous savings estimate: 400%

Use careful wording unless the business has independently confirmed the exact accounting:

- "Estimated INR 5 crore annual savings, based on the previous call-reduction-to-savings relationship."
- "Customer-call reduction improved from the previously stated 10% to 50%, implying a 5x higher annual savings estimate under the same calculation model."

## Copy Rules

Prefer:

- "30% to 95% delivery-date accuracy"
- "50% fewer customer calls"
- "FRT increased from 10% to 60%"
- "1.45M Diwali-period requests"
- "199% traffic spike handled"
- "Centralized delivery truth"
- "Controlled operational data"
- "Cache-backed read path"
- "Snapshot-backed restores"

Avoid:

- Long explanatory paragraphs
- Repeating the same system summary in multiple places
- Unsupported claims beyond the known metrics
- Overstating exact cost savings without naming the estimation basis
