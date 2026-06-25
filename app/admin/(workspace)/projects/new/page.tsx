import Link from "next/link";

import { createProject } from "@/app/admin/(workspace)/projects/actions";
import { AdminProjectForm } from "@/components/AdminProjectForm";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata = {
  title: "New Project",
};

export default function NewProjectPage() {
  return (
    <div className="admin-stack">
      <header className="admin-page-header admin-page-header-row">
        <div>
          <p className="admin-kicker">Projects</p>
          <h1>New project</h1>
          <p>Create a new selected-work record for the public portfolio.</p>
        </div>
        <Link className="button button-secondary" href="/admin/projects">
          Back
        </Link>
      </header>

      {!hasSupabaseConfig ? (
        <div className="admin-banner">Supabase is not configured yet. Project creation is disabled until setup is complete.</div>
      ) : null}

      <section className="admin-panel">
        <AdminProjectForm action={createProject} disabled={!hasSupabaseConfig} submitLabel="Create project" />
      </section>
    </div>
  );
}
