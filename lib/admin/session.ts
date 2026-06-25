import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isAdminEmail } from "./authorization";

export async function requireAdminUser() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/admin/settings?missing=supabase");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin/login");
  if (!isAdminEmail(user.email)) redirect("/admin/login?error=unauthorized");

  return user;
}
