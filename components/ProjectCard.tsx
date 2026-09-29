import { ProjectVisitButton } from "./ProjectVisitButton";

interface Project {
  id?: string;
  index?: string;
  slug: string;
  name: string;
  url: string;
  category: string;
  title: string;
  challenge: string;
  delivery: string;
  metrics: readonly (
    | readonly [string, string]
    | { value: string; label: string }
  )[];
  capabilities: string | readonly string[];
  hasCaseStudy: boolean;
  orderIndex?: number;
}

function normalizeMetric(metric: Project["metrics"][number]) {
  if ("value" in metric) return metric;
  return { value: metric[0], label: metric[1] };
}

function hasHeadlineWhitespace(title: string) {
  return title.trim().length <= 42;
}

export function ProjectCard({ project }: { project: Project }) {
  const index =
    project.index ?? String(project.orderIndex ?? 0).padStart(2, "0");
  const capabilities = Array.isArray(project.capabilities)
    ? project.capabilities.join(", ")
    : project.capabilities;
  const metrics = project.metrics.map(normalizeMetric);
  const challengePlacement = hasHeadlineWhitespace(project.title)
    ? "challenge-left"
    : "challenge-right";
  const websiteUrl = project.url;
  const action = project.hasCaseStudy
    ? { href: `/work/${project.slug}`, label: "View Case Study", external: false }
    : websiteUrl
      ? { href: websiteUrl, label: "Visit Website", external: true }
      : null;

  return (
    <article className="project-card reveal">
      <div className="project-meta reveal-item">
        <span className="project-index">{index}</span>
        <span className="project-name">{project.name}</span>
        <span className="project-category">{project.category}</span>
        {action ? (
          <ProjectVisitButton
            href={action.href}
            borderWidth={1}
            className="project-visit-desktop"
            external={action.external}
          >
            {action.label}
          </ProjectVisitButton>
        ) : null}
      </div>
      <div className={`project-grid project-grid--${challengePlacement}`}>
        <div className="project-left reveal-item">
          <h3>{project.title}</h3>
        </div>

        <div className="project-section-copy project-challenge reveal-item">
          <h4>The challenge</h4>
          <p>{project.challenge}</p>
        </div>

        <div className="project-right reveal-item">
          <div className="project-section-copy">
            <h4>The solution</h4>
            <p>{project.delivery}</p>
          </div>

          <dl className="metric-grid">
            {metrics.map(({ value, label }) => (
              <div key={label}>
                <dt>{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
          {action ? (
            <ProjectVisitButton
              href={action.href}
              borderWidth={1}
              className="project-visit-mobile"
              external={action.external}
            >
              {action.label}
            </ProjectVisitButton>
          ) : null}
        </div>

        <p className="capabilities">{capabilities}</p>
      </div>
    </article>
  );
}
