"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/lib/admin/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const leadSchema = z.object({
  id: z.string().trim().min(1),
  status: z.enum(["new", "replied", "qualified", "proposal_sent", "won", "lost", "archived"]),
  priority: z.enum(["low", "normal", "high"]),
  notes: z.string().trim().default(""),
  nextAction: z.string().trim().default(""),
  nextFollowUpAt: z.string().trim().default(""),
});

export async function updateLead(formData: FormData) {
  await requireAdminUser();
  const parsed = leadSchema.parse({
    id: formData.get("id"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    notes: formData.get("notes"),
    nextAction: formData.get("nextAction"),
    nextFollowUpAt: formData.get("nextFollowUpAt"),
  });

  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/admin/settings?missing=supabase");

  const { error } = await supabase
    .from("leads")
    .update({
      status: parsed.status,
      priority: parsed.priority,
      notes: parsed.notes || null,
      next_action: parsed.nextAction || null,
      next_follow_up_at: parsed.nextFollowUpAt ? new Date(parsed.nextFollowUpAt).toISOString() : null,
    })
    .eq("id", parsed.id);

  if (error) throw new Error(error.message);

  revalidatePath("/admin");
  revalidatePath("/admin/leads");
  revalidatePath(`/admin/leads/${parsed.id}`);
  redirect("/admin/leads");
}
