export type AdminProjectStatus = "draft" | "published" | "archived";

export type AdminProjectMetric = {
  value: string;
  label: string;
};

export type AdminProject = {
  id: string;
  slug: string;
  name: string;
  url: string;
  category: string;
  title: string;
  challenge: string;
  delivery: string;
  capabilities: string[];
  metrics: AdminProjectMetric[];
  orderIndex: number;
  status: AdminProjectStatus;
  updatedAt: string | null;
};

export type LeadStatus = "new" | "replied" | "qualified" | "proposal_sent" | "won" | "lost" | "archived";
export type LeadPriority = "low" | "normal" | "high";

export type AdminLead = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  budget: string | null;
  message: string;
  source: string;
  status: LeadStatus;
  priority: LeadPriority;
  notes: string | null;
  nextAction: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminDataResult<T> = {
  items: T[];
  source: "supabase" | "fallback";
  error?: string;
};
