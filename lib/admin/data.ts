import { projects as staticProjects } from "@/lib/content";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { AdminDataResult, AdminLead, AdminProject, AdminProjectMetric } from "./types";

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  url: string | null;
  category: string;
  title: string;
  challenge: string;
  delivery: string;
  capabilities: string[] | string | null;
  metrics: unknown;
  order_index: number;
  status: AdminProject["status"];
  updated_at: string | null;
};

type LeadRow = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  source: string;
  status: AdminLead["status"];
  priority: AdminLead["priority"];
  notes: string | null;
  next_action: string | null;
  next_follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeCapabilities(value: string[] | string | null): string[] {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeMetrics(value: unknown): AdminProjectMetric[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (
      item &&
      typeof item === "object" &&
      "value" in item &&
      "label" in item &&
      typeof item.value === "string" &&
      typeof item.label === "string"
    ) {
      return [{ value: item.value, label: item.label }];
    }

    if (Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string") {
      return [{ value: item[0], label: item[1] }];
    }

    return [];
  });
}

function fallbackProjects(): AdminProject[] {
  return staticProjects.map((project, index) => ({
    id: project.index,
    slug: slugify(project.name),
    name: project.name,
    url: project.url,
    category: project.category,
    title: project.title,
    challenge: project.challenge,
    delivery: project.delivery,
    capabilities: normalizeCapabilities(project.capabilities),
    metrics: project.metrics.map(([value, label]) => ({ value, label })),
    orderIndex: index + 1,
    status: "published",
    updatedAt: null,
  }));
}

function mapProject(row: ProjectRow): AdminProject {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    url: row.url ?? "",
    category: row.category,
    title: row.title,
    challenge: row.challenge,
    delivery: row.delivery,
    capabilities: normalizeCapabilities(row.capabilities),
    metrics: normalizeMetrics(row.metrics),
    orderIndex: row.order_index,
    status: row.status,
    updatedAt: row.updated_at,
  };
}

function mapLead(row: LeadRow): AdminLead {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    budget: row.budget,
    message: row.message,
    source: row.source,
    status: row.status,
    priority: row.priority,
    notes: row.notes,
    nextAction: row.next_action,
    nextFollowUpAt: row.next_follow_up_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getAdminProjects(): Promise<AdminDataResult<AdminProject>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { items: fallbackProjects(), source: "fallback" };

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("order_index", { ascending: true })
    .returns<ProjectRow[]>();

  if (error) {
    return { items: fallbackProjects(), source: "fallback", error: error.message };
  }

  return { items: (data ?? []).map(mapProject), source: "supabase" };
}

export async function getAdminProject(idOrSlug: string): Promise<AdminDataResult<AdminProject>> {
  const fallback = fallbackProjects();
  const fallbackMatch = fallback.find((project) => project.id === idOrSlug || project.slug === idOrSlug);
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { items: fallbackMatch ? [fallbackMatch] : [], source: "fallback" };
  }

  const idColumn = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idOrSlug)
    ? "id"
    : "slug";

  const { data, error } = await supabase.from("projects").select("*").eq(idColumn, idOrSlug).maybeSingle<ProjectRow>();

  if (error) {
    return { items: fallbackMatch ? [fallbackMatch] : [], source: "fallback", error: error.message };
  }

  return { items: data ? [mapProject(data)] : [], source: "supabase" };
}

export async function getAdminLeads(): Promise<AdminDataResult<AdminLead>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { items: [], source: "fallback" };

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<LeadRow[]>();

  if (error) {
    return { items: [], source: "fallback", error: error.message };
  }

  return { items: (data ?? []).map(mapLead), source: "supabase" };
}

export async function getAdminLead(id: string): Promise<AdminDataResult<AdminLead>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { items: [], source: "fallback" };

  const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle<LeadRow>();

  if (error) {
    return { items: [], source: "fallback", error: error.message };
  }

  return { items: data ? [mapLead(data)] : [], source: "supabase" };
}

export async function getPublicProjects(): Promise<AdminProject[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return fallbackProjects();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("status", "published")
    .order("order_index", { ascending: true })
    .returns<ProjectRow[]>();

  if (error || !data?.length) return fallbackProjects();

  return data.map(mapProject);
}
