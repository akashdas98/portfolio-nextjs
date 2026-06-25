import { ProjectVisitButton } from "./ProjectVisitButton";

interface Project {
  id?: string;
  index?: string;
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

  return (
    <article className="project-card reveal">
      <div className="project-meta">
        <span className="project-index">{index}</span>
        <span className="project-name">{project.name}</span>
        <span className="project-category">{project.category}</span>
        {project.url ? (
          <ProjectVisitButton
            href={project.url}
            borderWidth={1}
            className="project-visit-desktop"
          >
            Visit website
          </ProjectVisitButton>
        ) : null}
      </div>
      <div className={`project-grid project-grid--${challengePlacement}`}>
        <div className="project-left">
          <h3>{project.title}</h3>
        </div>

        <div className="project-section-copy project-challenge">
          <h4>The challenge</h4>
          <p>{project.challenge}</p>
        </div>

        <div className="project-right">
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
          {project.url ? (
            <ProjectVisitButton
              href={project.url}
              borderWidth={1}
              className="project-visit-mobile"
            >
              Visit website
            </ProjectVisitButton>
          ) : null}
        </div>

        <p className="capabilities">{capabilities}</p>
      </div>
    </article>
  );
}
