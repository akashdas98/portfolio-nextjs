import type { AdminLead } from "@/lib/admin/types";

type AdminLeadFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  lead: AdminLead;
  disabled?: boolean;
};

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export function AdminLeadForm({ action, lead, disabled = false }: AdminLeadFormProps) {
  return (
    <form className="admin-form" action={action}>
      <input type="hidden" name="id" value={lead.id} />

      <div className="admin-form-grid">
        <label>
          <span>Status</span>
          <select name="status" defaultValue={lead.status} disabled={disabled}>
            <option value="new">New</option>
            <option value="replied">Replied</option>
            <option value="qualified">Qualified</option>
            <option value="proposal_sent">Proposal sent</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          <span>Priority</span>
          <select name="priority" defaultValue={lead.priority} disabled={disabled}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>
      </div>

      <label>
        <span>Next action</span>
        <input name="nextAction" defaultValue={lead.nextAction ?? ""} placeholder="Reply, qualify, send proposal..." disabled={disabled} />
      </label>

      <label>
        <span>Next follow-up</span>
        <input name="nextFollowUpAt" type="datetime-local" defaultValue={localDateTime(lead.nextFollowUpAt)} disabled={disabled} />
      </label>

      <label>
        <span>Internal notes</span>
        <textarea name="notes" rows={6} defaultValue={lead.notes ?? ""} disabled={disabled} />
      </label>

      <div className="admin-form-actions">
        <button className="button button-primary" type="submit" disabled={disabled}>
          Save lead
        </button>
      </div>
    </form>
  );
}
