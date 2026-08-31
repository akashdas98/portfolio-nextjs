import type { AdminProject } from "@/lib/admin/types";

type AdminProjectFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  project?: AdminProject;
  disabled?: boolean;
  submitLabel: string;
};

function metricsValue(project?: AdminProject) {
  return project?.metrics.map((metric) => `${metric.value} | ${metric.label}`).join("\n") ?? "";
}

function caseStudyDocumentValue(project?: AdminProject) {
  return project?.caseStudyDocument ? JSON.stringify(project.caseStudyDocument, null, 2) : "";
}

export function AdminProjectForm({ action, project, disabled = false, submitLabel }: AdminProjectFormProps) {
  return (
    <form className="admin-form" action={action} encType="multipart/form-data">
      {project ? <input type="hidden" name="id" value={project.id} /> : null}

      <div className="admin-form-grid">
        <label>
          <span>Project name</span>
          <input name="name" defaultValue={project?.name ?? ""} required disabled={disabled} />
        </label>
        <label>
          <span>Slug</span>
          <input name="slug" defaultValue={project?.slug ?? ""} placeholder="auto-generated if empty" disabled={disabled} />
        </label>
      </div>

      <div className="admin-form-grid">
        <label>
          <span>URL</span>
          <input name="url" type="url" defaultValue={project?.url ?? ""} placeholder="https://example.com" disabled={disabled} />
        </label>
        <label>
          <span>Category</span>
          <input name="category" defaultValue={project?.category ?? ""} required disabled={disabled} />
        </label>
      </div>

      <label>
        <span>Headline</span>
        <input name="title" defaultValue={project?.title ?? ""} required disabled={disabled} />
      </label>

      <label>
        <span>Challenge</span>
        <textarea name="challenge" rows={5} defaultValue={project?.challenge ?? ""} required disabled={disabled} />
      </label>

      <label>
        <span>Delivery</span>
        <textarea name="delivery" rows={5} defaultValue={project?.delivery ?? ""} required disabled={disabled} />
      </label>

      <label>
        <span>Capabilities</span>
        <textarea
          name="capabilities"
          rows={5}
          defaultValue={project?.capabilities.join("\n") ?? ""}
          placeholder="One capability per line"
          disabled={disabled}
        />
      </label>

      <label>
        <span>Metrics</span>
        <textarea
          name="metrics"
          rows={4}
          defaultValue={metricsValue(project)}
          placeholder="95% | delivery-date accuracy"
          disabled={disabled}
        />
      </label>

      <label className="admin-checkbox">
        <input
          name="hasCaseStudy"
          type="checkbox"
          defaultChecked={project?.hasCaseStudy ?? false}
          disabled={disabled}
        />
        <span>Published case study exists</span>
      </label>

      <label>
        <span>Case-study document (versioned JSON)</span>
        <textarea
          name="caseStudyDocument"
          rows={18}
          defaultValue={caseStudyDocumentValue(project)}
          placeholder='{"schemaVersion": 3, "summary": "...", "role": "...", "sections": [...]}'
          spellCheck={false}
          disabled={disabled}
        />
      </label>

      <label>
        <span>Case-study PCB semantic background (SVG)</span>
        <input
          name="caseStudyBackground"
          type="file"
          accept=".svg,image/svg+xml"
          disabled={disabled}
        />
        <small>
          Optional when editing. Preserve the renderer's classified primitives and upload it with
          the matching prepared lens below.
        </small>
      </label>

      <label>
        <span>Case-study PCB pointer lens (SVG)</span>
        <input
          name="caseStudyBackgroundLens"
          type="file"
          accept=".svg,image/svg+xml"
          disabled={disabled}
        />
        <small>
          Required with a new semantic background. This spatially local projection preserves the
          same visible geometry while keeping pointer repainting bounded.
        </small>
      </label>

      <div className="admin-form-grid admin-form-grid-compact">
        <label>
          <span>Order</span>
          <input name="orderIndex" type="number" min="0" max="999" defaultValue={project?.orderIndex ?? 0} disabled={disabled} />
        </label>
        <label>
          <span>Status</span>
          <select name="status" defaultValue={project?.status ?? "draft"} disabled={disabled}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      <div className="admin-form-actions">
        <button className="button button-primary" type="submit" disabled={disabled}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
