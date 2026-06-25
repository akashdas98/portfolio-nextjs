import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { isAdminEmail } from "@/lib/admin/authorization";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const navItems = [
  ["Dashboard", "/admin"],
  ["Projects", "/admin/projects"],
  ["Leads", "/admin/leads"],
  ["Settings", "/admin/settings"],
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  let email = "Setup mode";

  if (hasSupabaseConfig) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    if (!user) redirect("/admin/login");
    if (!isAdminEmail(user.email)) redirect("/admin/login?error=unauthorized");
    email = user.email ?? "Admin";
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-brand" href="/admin">
          Akash Admin
        </Link>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navItems.map(([label, href]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="admin-user">
          <span>Signed in</span>
          <strong>{email}</strong>
        </div>
      </aside>
      <main className="admin-main">
        {!hasSupabaseConfig ? (
          <div className="admin-banner">
            Supabase is not configured yet. Admin screens are showing local fallback data.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
