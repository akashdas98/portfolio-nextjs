import { preload } from "react-dom";
import type { AdminProject } from "@/lib/admin/types";
import type { CaseStudySectionDocument, CaseStudyDocument } from "@/lib/case-study/schema";
import {
  getCaseStudyBackgroundLensUrl,
  getCaseStudyBackgroundUrl,
} from "@/lib/case-study/background-url";

import { CircuitUnderlay } from "./CircuitUnderlay";
import { CaseStudyBackLink } from "./CaseStudyBackLink";
import { CrossPlatformFeatureDiagram } from "./CrossPlatformFeatureDiagram";
import { EddCalculationDiagram } from "./EddCalculationDiagram";
import { LeadNetworkDiagram } from "./LeadNetworkDiagram";
import { PublicCircuitBackground } from "./PublicCircuitBackground";

type CaseStudyRendererProps = {
  document: CaseStudyDocument;
  project: AdminProject;
};

export function CaseStudyRenderer({ document, project }: CaseStudyRendererProps) {
  const backgroundUrl = getCaseStudyBackgroundUrl(document.background);
  const backgroundLensUrl = getCaseStudyBackgroundLensUrl(document.background);
  preload(backgroundLensUrl, { as: "fetch", crossOrigin: "anonymous" });

  return (
    <main
      id="top"
      className="case-study-page public-circuit-page"
      data-public-animations
      data-public-circuit
    >
      <PublicCircuitBackground
        imageUrl={backgroundUrl}
        lensImageUrl={backgroundLensUrl}
        sourceWidth={document.background.width}
        sourceHeight={document.background.height}
      />
      <section className="case-hero shell circuit-exposed-section">
        <CaseStudyBackLink />
        <p className="eyebrow reveal"><CircuitUnderlay size="compact">Case study</CircuitUnderlay></p>
        <p className="case-project-name reveal"><CircuitUnderlay size="compact">{project.name}</CircuitUnderlay></p>
        <h1 className="reveal"><CircuitUnderlay size="heading">{project.title}</CircuitUnderlay></h1>
        <div className="case-hero-lower reveal">
          <p><CircuitUnderlay>{document.summary}</CircuitUnderlay></p>
          <p className="case-role"><CircuitUnderlay>{document.role}</CircuitUnderlay></p>
        </div>
        {document.heroVisual?.type === "edd-calculation" ? (
          <EddCalculationDiagram visual={document.heroVisual} />
        ) : null}
        {document.heroVisual?.type === "lead-network" ? (
          <LeadNetworkDiagram visual={document.heroVisual} />
        ) : null}
        {document.heroVisual?.type === "cross-platform-features" ? (
          <CrossPlatformFeatureDiagram visual={document.heroVisual} />
        ) : null}
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
  const websiteUrl = project.url;
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
                    <th scope="col"><CircuitUnderlay className="case-outcome-cell-content" size="compact">Metric</CircuitUnderlay></th>
                    <th scope="col"><CircuitUnderlay className="case-outcome-cell-content" size="compact">Before</CircuitUnderlay></th>
                    <th scope="col"><CircuitUnderlay className="case-outcome-cell-content" size="compact">After</CircuitUnderlay></th>
                    <th scope="col"><CircuitUnderlay className="case-outcome-cell-content" size="compact">Impact</CircuitUnderlay></th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row) => (
                    <tr key={row.metric}>
                      <th scope="row"><CircuitUnderlay className="case-outcome-cell-content" size="compact">{row.metric}</CircuitUnderlay></th>
                      <td><CircuitUnderlay className="case-outcome-cell-content" size="compact">{row.before}</CircuitUnderlay></td>
                      <td className="case-table-after"><CircuitUnderlay className="case-outcome-cell-content" size="compact">{row.after}</CircuitUnderlay></td>
                      <td className="case-table-impact"><CircuitUnderlay className="case-outcome-cell-content" size="compact">{row.impact}</CircuitUnderlay></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="case-outcome-footer">
                <div className="case-outcome-value">
                  <strong><CircuitUnderlay size="heading">{section.footer.value}</CircuitUnderlay></strong>
                  <span><CircuitUnderlay size="compact">{section.footer.label}</CircuitUnderlay></span>
                  <p><CircuitUnderlay>{section.footer.detail}</CircuitUnderlay></p>
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
                <span><CircuitUnderlay size="compact">{section.beforeLabel}</CircuitUnderlay></span>
                <span><CircuitUnderlay size="compact">{section.afterLabel}</CircuitUnderlay></span>
              </div>
              {section.items.map((item) => (
                <article className="case-comparison-row" key={item.before}>
                  <p><CircuitUnderlay>{item.before}</CircuitUnderlay></p>
                  <p><CircuitUnderlay>{item.after}</CircuitUnderlay></p>
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
                <p className="eyebrow"><CircuitUnderlay size="compact">{section.eyebrow}</CircuitUnderlay></p>
                <h2><CircuitUnderlay size="heading">{section.title}</CircuitUnderlay></h2>
              </div>
              <p><CircuitUnderlay>{section.intro}</CircuitUnderlay></p>
            </div>
            <ol className="case-workflow reveal" aria-label={section.eyebrow}>
              {section.steps.map((step, index) => (
                <li key={step}>
                  <span><CircuitUnderlay size="compact">{String(index + 1).padStart(2, "0")}</CircuitUnderlay></span>
                  <strong><CircuitUnderlay>{step}</CircuitUnderlay></strong>
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
            <div
              className={`case-decision-grid reveal${
                section.columns === 3 ? " case-decision-grid-three" : ""
              }`}
            >
              {section.cards.map((item) => (
                <CaseEvidenceCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>
      );

    case "impact-highlight":
      return (
        <section
          className={`${caseSectionClass(section)} impact case-impact-section`}
          data-circuit-impact-palette={section.circuitImpactPalette}
        >
          <div className="shell impact-grid reveal">
            <div>
              <p className="eyebrow"><CircuitUnderlay size="compact">{section.eyebrow}</CircuitUnderlay></p>
              <h2><CircuitUnderlay size="heading">{section.title}</CircuitUnderlay></h2>
            </div>
            <div className="impact-copy">
              <p><CircuitUnderlay>{section.detail}</CircuitUnderlay></p>
              <dl className="impact-metrics">
                {section.metrics.map((metric) => (
                  <div key={`${metric.value}-${metric.label}`}>
                    <dt><CircuitUnderlay size="heading">{metric.value}</CircuitUnderlay></dt>
                    <dd><CircuitUnderlay size="compact">{metric.label}</CircuitUnderlay></dd>
                  </div>
                ))}
              </dl>
            </div>
            {section.capabilities ? (
              <p className="capabilities case-impact-capabilities">
                <CircuitUnderlay>{section.capabilities.join(", ")}.</CircuitUnderlay>
              </p>
            ) : null}
          </div>
        </section>
      );

    case "capability-band":
      return (
        <section className={`section case-capability-band case-section-circuit-exposed${section.tone === "muted" ? " case-section-muted" : ""}`}>
          <div className="shell case-capability-grid reveal">
            <div className="case-capability-heading">
              <p className="eyebrow"><CircuitUnderlay size="compact">{section.eyebrow}</CircuitUnderlay></p>
              <h2><CircuitUnderlay size="heading">{section.title}</CircuitUnderlay></h2>
            </div>
            <div className="case-capability-copy">
              {section.showProjectCapabilities ? <p><CircuitUnderlay>{project.capabilities.join(", ")}.</CircuitUnderlay></p> : null}
              <div className="case-actions">
                <a className="button button-primary" href="/#contact">
                  {section.primaryActionLabel}
                </a>
                {websiteUrl ? (
                  <a className="button button-secondary" href={websiteUrl} target="_blank" rel="noreferrer">
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
    "case-section-circuit-exposed",
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
      <p className="eyebrow"><CircuitUnderlay size="compact">{section.eyebrow}</CircuitUnderlay></p>
      <h2><CircuitUnderlay size="heading">{section.title}</CircuitUnderlay></h2>
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
