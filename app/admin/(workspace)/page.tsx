import Link from "next/link";

import { getAdminLeads, getAdminProjects } from "@/lib/admin/data";

export const metadata = {
  title: "Admin Dashboard",
};

export default async function AdminDashboardPage() {
  const [projects, leads] = await Promise.all([getAdminProjects(), getAdminLeads()]);
  const newLeads = leads.items.filter((lead) => lead.status === "new").length;
  const followUps = leads.items.filter((lead) => lead.nextFollowUpAt).length;
  const publishedProjects = projects.items.filter((project) => project.status === "published").length;

  return (
    <div className="admin-stack">
      <header className="admin-page-header">
        <p className="admin-kicker">Dashboard</p>
        <h1>Portfolio operations</h1>
        <p>Track selected work, inbound enquiries, and follow-up actions from one private surface.</p>
      </header>

      <section className="admin-metric-grid" aria-label="Admin summary">
        <Link className="admin-metric" href="/admin/projects">
          <span>Published projects</span>
          <strong>{publishedProjects}</strong>
        </Link>
        <Link className="admin-metric" href="/admin/leads">
          <span>New leads</span>
          <strong>{newLeads}</strong>
        </Link>
        <Link className="admin-metric" href="/admin/leads">
          <span>Follow-ups set</span>
          <strong>{followUps}</strong>
        </Link>
      </section>

      <section className="admin-panel">
        <div className="admin-section-title">
          <h2>Next build focus</h2>
          <Link href="/admin/projects">Open projects</Link>
        </div>
        <ul className="admin-task-list">
          <li>Seed Supabase with the current selected work.</li>
          <li>Add project create/edit forms with publish controls.</li>
          <li>Save validated contact submissions into the leads table.</li>
          <li>Add lead notes, statuses, and follow-up actions.</li>
        </ul>
      </section>
    </div>
  );
}
