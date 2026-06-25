import { missingSupabaseAdminConfig, missingSupabaseConfig } from "@/lib/supabase/config";

export const metadata = {
  title: "Admin Settings",
};

export default function AdminSettingsPage() {
  return (
    <div className="admin-stack">
      <header className="admin-page-header">
        <p className="admin-kicker">Settings</p>
        <h1>Configuration</h1>
        <p>Use this checklist before relying on the admin panel in production.</p>
      </header>

      <section className="admin-panel admin-settings-grid">
        <div>
          <h2>Supabase Auth</h2>
          {missingSupabaseConfig.length ? (
            <ul className="admin-task-list">
              {missingSupabaseConfig.map((key) => (
                <li key={key}>Set {key}</li>
              ))}
            </ul>
          ) : (
            <p>Supabase browser/server auth variables are present.</p>
          )}
        </div>
        <div>
          <h2>Lead capture</h2>
          {missingSupabaseAdminConfig.length ? (
            <ul className="admin-task-list">
              {missingSupabaseAdminConfig.map((key) => (
                <li key={key}>Set {key}</li>
              ))}
            </ul>
          ) : (
            <p>Server-side Supabase lead capture variables are present.</p>
          )}
        </div>
        <div>
          <h2>Database setup</h2>
          <ul className="admin-task-list">
            <li>Run `supabase/schema.sql` in the Supabase SQL editor.</li>
            <li>Run `supabase/seed.sql` to load the current selected work.</li>
            <li>Create the first admin user in Supabase Auth.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
