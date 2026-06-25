import Link from "next/link";
import { notFound } from "next/navigation";

import { archiveProject, updateProject } from "@/app/admin/(workspace)/projects/actions";
import { AdminProjectForm } from "@/components/AdminProjectForm";
import { getAdminProject } from "@/lib/admin/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata = {
  title: "Edit Project",
};

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminProject(id);
  const project = result.items[0];

  if (!project) notFound();

  const disabled = !hasSupabaseConfig || result.source !== "supabase";

  return (
    <div className="admin-stack">
      <header className="admin-page-header admin-page-header-row">
        <div>
          <p className="admin-kicker">Projects</p>
          <h1>Edit project</h1>
          <p>{project.name}</p>
        </div>
        <Link className="button button-secondary" href="/admin/projects">
          Back
        </Link>
      </header>

      {result.error ? <div className="admin-banner">Supabase query failed: {result.error}</div> : null}
      {disabled ? (
        <div className="admin-banner">
          This record is fallback data. Configure Supabase and seed projects before edits can be saved.
        </div>
      ) : null}

      <section className="admin-panel">
        <AdminProjectForm action={updateProject} project={project} disabled={disabled} submitLabel="Save project" />
      </section>

      <section className="admin-panel admin-danger-zone">
        <div>
          <h2>Archive project</h2>
          <p>Archived projects stay in the database but should not be rendered publicly.</p>
        </div>
        <form action={archiveProject}>
          <input type="hidden" name="id" value={project.id} />
          <button className="button button-secondary" type="submit" disabled={disabled || project.status === "archived"}>
            Archive project
          </button>
        </form>
      </section>
    </div>
  );
}
