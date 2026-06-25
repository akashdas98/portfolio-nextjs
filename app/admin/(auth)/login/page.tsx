import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminLoginForm } from "@/components/AdminLoginForm";
import { isAdminEmail } from "@/lib/admin/authorization";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Admin Login",
};

export default async function AdminLoginPage() {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && isAdminEmail(user.email)) redirect("/admin");
  }

  return (
    <main className="admin-login-page">
      <Suspense fallback={<div className="admin-panel">Loading admin login...</div>}>
        <AdminLoginForm configured={hasSupabaseConfig} />
      </Suspense>
    </main>
  );
}
