type PublicStartupSkeletonProps = {
  kind?: "home" | "case-study";
  projectName?: string;
  title?: string;
  summary?: string;
  role?: string;
};

/** Inert paint only: canonical content and its entrance retain sole ownership. */
export function PublicStartupSkeleton({
  kind = "home",
  projectName = "Project case study",
  title = kind === "home"
    ? "Clean, reliable web products built end to end."
    : "Reliable systems built around real outcomes.",
  summary = "Websites and applications shaped around real business needs, clear user experiences, and dependable technical foundations.",
  role = "End-to-end engineering, architecture and delivery.",
}: PublicStartupSkeletonProps) {
  const caseStudy = kind === "case-study";

  return (
    <div
      className="public-loading-skeleton public-loading-skeleton--art"
      aria-hidden="true"
      inert
    >
      <div className="public-skeleton-header shell">
        <span className="public-skeleton-block public-skeleton-brand" />
        <span className="public-skeleton-block public-skeleton-navigation" />
      </div>
      <div className={`${caseStudy ? "case-hero" : "hero"} shell public-skeleton-hero`}>
        {caseStudy && (
          <span className="case-back-link public-skeleton-text" data-skeleton-text="Back to selected work" />
        )}
        <span
          className="eyebrow public-skeleton-text"
          data-skeleton-text={caseStudy ? "Case study" : "Senior Software Engineer · Full-Stack Web Development"}
        />
        {caseStudy && <span className="case-project-name public-skeleton-text" data-skeleton-text={projectName} />}
        <div className="public-skeleton-title public-skeleton-text" data-skeleton-text={title} />
        <div className={caseStudy ? "case-hero-lower" : "hero-lower"}>
          <div className="hero-copy public-skeleton-copy public-skeleton-text" data-skeleton-text={summary} />
          {caseStudy ? (
            <div className="case-role public-skeleton-copy public-skeleton-text" data-skeleton-text={role} />
          ) : (
            <div className="hero-actions public-skeleton-actions">
              <span className="public-skeleton-block public-skeleton-button" />
              <span className="public-skeleton-block public-skeleton-button" />
            </div>
          )}
        </div>
        {caseStudy ? (
          <div className="public-skeleton-diagram">
            <span className="public-skeleton-block public-skeleton-diagram-label" />
            <div className="public-skeleton-diagram-nodes">
              {[0, 1, 2].map((item) => <span key={item} className="public-skeleton-block" />)}
            </div>
          </div>
        ) : (
          <div className="proof-strip public-skeleton-proof">
            {[0, 1, 2, 3].map((item) => <span key={item} className="public-skeleton-block" />)}
          </div>
        )}
      </div>
    </div>
  );
}
