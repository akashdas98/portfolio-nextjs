import type { AdminProject } from "@/lib/admin/types";
import type { CaseStudySectionDocument, CaseStudyDocument } from "@/lib/case-study/schema";

import { CaseCircuitGlow } from "./CaseCircuitGlow";
import { CaseStudyBackLink } from "./CaseStudyBackLink";
import { EddCalculationDiagram } from "./EddCalculationDiagram";

type CaseStudyRendererProps = {
  document: CaseStudyDocument;
  project: AdminProject;
};

export function CaseStudyRenderer({ document, project }: CaseStudyRendererProps) {
  const heroVisual = document.heroVisual?.type === "edd-calculation" ? document.heroVisual : null;

  return (
    <main id="top" className="case-study-page" data-public-animations>
      <CaseCircuitGlow />
      <section className="case-hero shell">
        <CaseStudyBackLink />
        <p className="eyebrow reveal">Case study</p>
        <p className="case-project-name reveal">{project.name}</p>
        <h1 className="reveal">{project.title}</h1>
        <div className="case-hero-lower reveal">
          <p>{document.summary}</p>
          <p className="case-role">{document.role}</p>
        </div>
        {heroVisual ? <EddCalculationDiagram visual={heroVisual} /> : null}
      </section>

      {document.sections.map((section) => (
        <CaseStudySection key={section.id} section={section} project={project} />
      ))}
    </main>
  );
}

function CaseStudySection({
  section,
  project,
}: {
  section: CaseStudySectionDocument;
  project: AdminProject;
}) {
  switch (section.type) {
    case "outcome-table":
      return (
        <section className={caseSectionClass(section)}>
          <div className="shell">
            <CaseSectionHeading section={section} />
            <div className="case-outcome-table-wrap reveal">
              <table className="case-outcome-table">
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    <th scope="col">Before</th>
                    <th scope="col">After</th>
                    <th scope="col">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.metric}>
                      <th scope="row">{row.metric}</th>
                      <td>{row.before}</td>
                      <td className="case-table-after">{row.after}</td>
                      <td className="case-table-impact">{row.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="case-outcome-footer">
                <div className="case-outcome-value">
                  <strong>{section.footer.value}</strong>
                  <span>{section.footer.label}</span>
                  <p>{section.footer.detail}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      );

    case "comparison":
      return (
        <section className={caseSectionClass(section)}>
          <div className="shell">
            <CaseSectionHeading section={section} />
            <div className="case-before-after reveal">
              <div className="case-comparison-heading" aria-hidden="true">
                <span>{section.beforeLabel}</span>
                <span>{section.afterLabel}</span>
              </div>
              {section.items.map((item) => (
                <article className="case-comparison-row" key={item.before}>
                  <p>{item.before}</p>
                  <p>{item.after}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      );

    case "system-flow":
      return (
        <section className={caseSectionClass(section)}>
          <div className="shell">
            <CaseSectionHeading section={section} />
            <div className="case-system-grid reveal">
              {section.items.map((item) => (
                <article className="case-system-card" key={item.title}>
                  <span>{item.step}</span>
                  <h3>{item.title}</h3>
                  <p>{item.detail}</p>
                  <div>
                    <strong>{item.stat}</strong>
                    <small>{item.statLabel}</small>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      );

    case "workflow":
      return (
        <section className={caseSectionClass(section)}>
          <div className="shell">
            <div className="section-heading split-heading reveal">
              <div>
                <p className="eyebrow">{section.eyebrow}</p>
                <h2>{section.title}</h2>
              </div>
              <p>{section.intro}</p>
            </div>
            <ol className="case-workflow reveal" aria-label={section.eyebrow}>
              {section.steps.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
            <div className="case-decision-grid case-control-grid reveal">
              {section.cards.map((item) => (
                <CaseEvidenceCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>
      );

    case "evidence-grid":
      return (
        <section className={caseSectionClass(section)}>
          <div className="shell">
            <CaseSectionHeading section={section} />
            <div className="case-decision-grid reveal">
              {section.cards.map((item) => (
                <CaseEvidenceCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>
      );

    case "capability-band":
      return (
        <section className={`section case-capability-band${section.tone === "muted" ? " case-section-muted" : ""}`}>
          <div className="shell case-capability-grid reveal">
            <div className="case-capability-heading">
              <p className="eyebrow">{section.eyebrow}</p>
              <h2>{section.title}</h2>
            </div>
            <div className="case-capability-copy">
              {section.showProjectCapabilities ? <p>{project.capabilities.join(", ")}.</p> : null}
              <div className="case-actions">
                <a className="button button-primary" href="/#contact">
                  {section.primaryActionLabel}
                </a>
                {project.url ? (
                  <a className="button button-secondary" href={project.url} target="_blank" rel="noreferrer">
                    {section.secondaryActionLabel}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      );
  }
}

function caseSectionClass(section: CaseStudySectionDocument) {
  return [
    "case-section",
    section.tone === "muted" ? "case-section-muted" : "",
    "circuitAnchor" in section && section.circuitAnchor === "section-bottom"
      ? "case-section-circuit-bottom"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function CaseSectionHeading({ section }: { section: CaseStudySectionDocument }) {
  return (
    <div className="section-heading reveal">
      <p className="eyebrow">{section.eyebrow}</p>
      <h2>{section.title}</h2>
    </div>
  );
}

type EvidenceCardItem = Extract<
  CaseStudySectionDocument,
  { type: "evidence-grid" }
>["cards"][number];

function CaseEvidenceCard({ item }: { item: EvidenceCardItem }) {
  return (
    <article className="case-decision-card">
      <h3>{item.title}</h3>
      <p>{item.detail}</p>
      <ul>
        {item.keywords.map((keyword) => (
          <li key={keyword}>{keyword}</li>
        ))}
      </ul>
    </article>
  );
}
