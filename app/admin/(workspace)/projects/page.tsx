import Link from "next/link";

import { getAdminProjects } from "@/lib/admin/data";

export const metadata = {
  title: "Admin Projects",
};

export default async function AdminProjectsPage() {
  const result = await getAdminProjects();

  return (
    <div className="admin-stack">
      <header className="admin-page-header admin-page-header-row">
        <div>
          <p className="admin-kicker">Projects</p>
          <h1>Selected work</h1>
          <p>Manage the project records that will power the public Work section.</p>
        </div>
        <Link className="button button-secondary" href="/admin/projects/new">
          New project
        </Link>
      </header>

      {result.error ? <div className="admin-banner">Supabase query failed: {result.error}</div> : null}

      <section className="admin-panel admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Status</th>
              <th>URL</th>
              <th>Metrics</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((project) => (
              <tr key={project.id}>
                <td>
                  <strong>{project.name}</strong>
                  <span>{project.category}</span>
                </td>
                <td>
                  <span className={`admin-status admin-status-${project.status}`}>{project.status}</span>
                </td>
                <td>
                  {project.url ? (
                    <Link href={project.url} target="_blank">
                      {project.url.replace(/^https?:\/\//, "")}
                    </Link>
                  ) : (
                    <span>Not set</span>
                  )}
                </td>
                <td>
                  <span>{project.metrics.length} metrics</span>
                </td>
                <td>
                  <Link href={`/admin/projects/${project.id}`}>Edit</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
