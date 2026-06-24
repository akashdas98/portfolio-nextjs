import { SystemVisual } from "./SystemVisual";

interface Project {
  index: string;
  category: string;
  title: string;
  challenge: string;
  delivery: string;
  metrics: readonly (readonly [string, string])[];
  capabilities: string;
  visual: "delivery" | "leads" | "horecah";
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="project-card reveal">
      <div className="project-meta">
        <span>{project.index}</span>
        <span>{project.category}</span>
      </div>
      <div className="project-grid">
        <div className="project-copy">
          <h3>{project.title}</h3>
          <div className="project-paragraphs">
            <p>{project.challenge}</p>
            <p>{project.delivery}</p>
          </div>
          <p className="capabilities">{project.capabilities}</p>
        </div>
        <div className="project-side">
          <SystemVisual variant={project.visual} />
          <dl className="metric-grid">
            {project.metrics.map(([value, label]) => (
              <div key={label}>
                <dt>{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </article>
  );
}
