"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requireAdminUser } from "@/lib/admin/session";
import { slugify } from "@/lib/admin/data";
import type { AdminProjectMetric } from "@/lib/admin/types";
import { prepareCaseStudyBackground } from "@/lib/case-study/prepare-background";
import { caseStudyDocumentSchema, type CaseStudyBackground } from "@/lib/case-study/schema";
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
  hasCaseStudy: z.boolean().default(false),
  caseStudyDocument: z.string().trim().default(""),
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

function parseProjectForm(formData: FormData, background?: CaseStudyBackground) {
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
    hasCaseStudy: formData.get("hasCaseStudy") === "on",
    caseStudyDocument: formData.get("caseStudyDocument"),
    orderIndex: formData.get("orderIndex"),
    status: formData.get("status"),
  });

  const documentValue = parsed.caseStudyDocument
    ? (JSON.parse(parsed.caseStudyDocument) as Record<string, unknown>)
    : null;
  if (documentValue && background) documentValue.background = background;
  const caseStudyDocument = documentValue ? caseStudyDocumentSchema.parse(documentValue) : null;

  if (parsed.hasCaseStudy && !caseStudyDocument) {
    throw new Error("A project marked as having a case study requires a valid case-study document.");
  }

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
    has_case_study: parsed.hasCaseStudy,
    case_study_document: caseStudyDocument,
    order_index: parsed.orderIndex,
    status: parsed.status,
  };
}

async function uploadCaseStudyBackground(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  formData: FormData,
  projectId: string,
) {
  const semanticFile = formData.get("caseStudyBackground");
  const lensFile = formData.get("caseStudyBackgroundLens");
  const hasSemantic = semanticFile instanceof File && semanticFile.size > 0;
  const hasLens = lensFile instanceof File && lensFile.size > 0;
  if (!hasSemantic && !hasLens) return null;
  if (!hasSemantic || !hasLens) {
    throw new Error(
      "Upload both the depth-defined semantic background SVG and its matching lens SVG.",
    );
  }
  if (!(semanticFile instanceof File) || !(lensFile instanceof File)) {
    throw new Error("The prepared PCB uploads are invalid.");
  }

  const prepared = await prepareCaseStudyBackground(semanticFile, lensFile);
  const objectPath = `${projectId}/background.${prepared.semanticHash}.svg`;
  const lensObjectPath = `${projectId}/background-lens.${prepared.lensHash}.svg`;
  const { error: semanticError } = await supabase.storage
    .from("case-study-assets")
    .upload(objectPath, prepared.semanticBody, {
      cacheControl: "31536000",
      contentType: "image/svg+xml",
      upsert: true,
    });
  if (semanticError) throw new Error(`Background upload failed: ${semanticError.message}`);

  const { error: lensError } = await supabase.storage
    .from("case-study-assets")
    .upload(lensObjectPath, prepared.lensBody, {
      cacheControl: "31536000",
      contentType: "image/svg+xml",
      upsert: true,
    });
  if (lensError) {
    await supabase.storage.from("case-study-assets").remove([objectPath]);
    throw new Error(`Background lens upload failed: ${lensError.message}`);
  }

  return {
    type: "pcb-svg" as const,
    bucket: "case-study-assets" as const,
    objectPath,
    lensObjectPath,
    width: prepared.width,
    height: prepared.height,
  };
}

async function removeUploadedBackground(
  supabase: NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>,
  background: CaseStudyBackground,
) {
  await supabase.storage
    .from(background.bucket)
    .remove([background.objectPath, background.lensObjectPath].filter((path): path is string => Boolean(path)));
}

async function getSupabaseOrRedirect() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/admin/settings?missing=supabase");
  return supabase;
}

export async function createProject(formData: FormData) {
  await requireAdminUser();
  const supabase = await getSupabaseOrRedirect();
  const id = randomUUID();
  const background = await uploadCaseStudyBackground(supabase, formData, id);
  const payload = parseProjectForm(formData, background ?? undefined);

  const { data, error } = await supabase
    .from("projects")
    .insert({ id, ...payload })
    .select("id")
    .single<{ id: string }>();
  if (error) {
    if (background) await removeUploadedBackground(supabase, background);
    throw new Error(error.message);
  }

  updateTag("public-projects");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  revalidatePath(`/work/${payload.slug}`);
  redirect(`/admin/projects/${data.id}`);
}

export async function updateProject(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Project id is required.");

  const supabase = await getSupabaseOrRedirect();
  const background = await uploadCaseStudyBackground(supabase, formData, id);
  const payload = parseProjectForm(formData, background ?? undefined);

  const { error } = await supabase.from("projects").update(payload).eq("id", id);
  if (error) {
    if (background) await removeUploadedBackground(supabase, background);
    throw new Error(error.message);
  }

  updateTag("public-projects");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath(`/work/${payload.slug}`);
  redirect("/admin/projects");
}

export async function archiveProject(formData: FormData) {
  await requireAdminUser();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Project id is required.");

  const supabase = await getSupabaseOrRedirect();
  const { error } = await supabase.from("projects").update({ status: "archived" }).eq("id", id);
  if (error) throw new Error(error.message);

  updateTag("public-projects");
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/projects");
  revalidatePath("/work/[slug]", "page");
  redirect("/admin/projects");
}
