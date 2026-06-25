"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminUser } from "@/lib/admin/session";
import { slugify } from "@/lib/admin/data";
import type { AdminProjectMetric } from "@/lib/admin/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const projectSchema = z.object({
  id: z.string().trim().optional(),
  slug: z.string().trim().max(120).optional(),
  name: z.string().trim().min(2).max(180),
  url: z.string().trim().url().or(z.literal("")).default(""),
  category: z.string().trim().min(2).max(220),
  title: z.string().trim().min(2).max(220),
  challenge: z.string().trim().min(10).max(5000),
  delivery: z.string().trim().min(10).max(5000),
  capabilities: z.string().trim().default(""),
  metrics: z.string().trim().default(""),
  orderIndex: z.coerce.number().int().min(0).max(999).default(0),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

function parseLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function parseMetrics(value: string): AdminProjectMetric[] {
  return parseLines(value).flatMap((line) => {
    const [metricValue, ...labelParts] = line.split("|").map((part) => part.trim());
    const label = labelParts.join(" | ");
    if (!metricValue || !label) return [];
    return [{ value: metricValue, label }];
  });
}

function parseProjectForm(formData: FormData) {
  const parsed = projectSchema.parse({
    id: formData.get("id"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    url: formData.get("url"),
    category: formData.get("category"),
    title: formData.get("title"),
    challenge: formData.get("challenge"),
    delivery: formData.get("delivery"),
    capabilities: formData.get("capabilities"),
    metrics: formData.get("metrics"),
    orderIndex: formData.get("orderIndex"),
    status: formData.get("status"),
  });

  return {
    slug: parsed.slug || slugify(parsed.name),
    name: parsed.name,
    url: parsed.url || null,
    category: parsed.category,
    title: parsed.title,
    challenge: parsed.challenge,
    delivery: parsed.delivery,
    capabilities: parseLines(parsed.capabilities),
    metrics: parseMetrics(parsed.metrics),
    order_index: parsed.orderIndex,
    status: parsed.status,
  };
}

async function getSupabaseOrRedirect() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/admin/settings?missing=supabase");
  return supabase;
}

export async function createProject(formData: FormData) {
  await requireAdminUser();
  const supabase = await getSupabaseOrRedirect();
  const payload = parseProjectForm(formData);

  const { data, error } = await supabase.from("projects").insert(payload).select("id").single<{ id: string }>();
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  redirect(`/admin/projects/${data.id}`);
}

export async function updateProject(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Project id is required.");

  const supabase = await getSupabaseOrRedirect();
  const payload = parseProjectForm(formData);

  const { error } = await supabase.from("projects").update(payload).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  redirect("/admin/projects");
}

export async function archiveProject(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Project id is required.");

  const supabase = await getSupabaseOrRedirect();
  const { error } = await supabase.from("projects").update({ status: "archived" }).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  redirect("/admin/projects");
}
