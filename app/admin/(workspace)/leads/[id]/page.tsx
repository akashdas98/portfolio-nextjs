import Link from "next/link";
import { notFound } from "next/navigation";

import { updateLead } from "@/app/admin/(workspace)/leads/actions";
import { AdminLeadForm } from "@/components/AdminLeadForm";
import { getAdminLead } from "@/lib/admin/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const metadata = {
  title: "Review Lead",
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getAdminLead(id);
  const lead = result.items[0];

  if (!lead) notFound();

  const disabled = !hasSupabaseConfig || result.source !== "supabase";

  return (
    <div className="admin-stack">
      <header className="admin-page-header admin-page-header-row">
        <div>
          <p className="admin-kicker">Leads</p>
          <h1>Review lead</h1>
          <p>{lead.email}</p>
        </div>
        <Link className="button button-secondary" href="/admin/leads">
          Back
        </Link>
      </header>

      {result.error ? <div className="admin-banner">Supabase query failed: {result.error}</div> : null}
      {disabled ? <div className="admin-banner">Supabase is not configured. Lead updates are disabled.</div> : null}

      <section className="admin-panel admin-lead-summary">
        <div>
          <span>Name</span>
          <strong>{lead.name}</strong>
        </div>
        <div>
          <span>Company</span>
          <strong>{lead.company || "Not provided"}</strong>
        </div>
        <div>
          <span>Budget</span>
          <strong>{lead.budget || "Not provided"}</strong>
        </div>
        <div>
          <span>Source</span>
          <strong>{lead.source}</strong>
        </div>
      </section>

      <section className="admin-panel admin-message-panel">
        <h2>Message</h2>
        <p>{lead.message}</p>
      </section>

      <section className="admin-panel">
        <AdminLeadForm action={updateLead} lead={lead} disabled={disabled} />
      </section>
    </div>
  );
}
