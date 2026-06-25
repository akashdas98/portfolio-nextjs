import Link from "next/link";

import { getAdminLeads } from "@/lib/admin/data";

export const metadata = {
  title: "Admin Leads",
};

export default async function AdminLeadsPage() {
  const result = await getAdminLeads();

  return (
    <div className="admin-stack">
      <header className="admin-page-header admin-page-header-row">
        <div>
          <p className="admin-kicker">Leads</p>
          <h1>Freelance enquiries</h1>
          <p>Review portfolio-origin leads, statuses, notes, and next actions.</p>
        </div>
      </header>

      {result.error ? <div className="admin-banner">Supabase query failed: {result.error}</div> : null}

      <section className="admin-panel admin-table-wrap">
        {result.items.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Next action</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <strong>{lead.name}</strong>
                    <span>{lead.email}</span>
                  </td>
                  <td>
                    <span className={`admin-status admin-status-${lead.status}`}>{lead.status.replace("_", " ")}</span>
                  </td>
                  <td>{lead.priority}</td>
                  <td>{lead.nextAction || "Not set"}</td>
                  <td>
                    <Link href={`/admin/leads/${lead.id}`}>Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="admin-empty-state">
            <h2>No leads yet</h2>
            <p>Validated contact form submissions will appear here after Supabase lead capture is configured.</p>
          </div>
        )}
      </section>
    </div>
  );
}
