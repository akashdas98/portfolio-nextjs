import type { CaseStudyBackground } from "./schema";
import { supabaseUrl } from "@/lib/supabase/config";

function encodeObjectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function getCaseStudyBackgroundUrl(background: CaseStudyBackground) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(background.bucket)}/${encodeObjectPath(background.objectPath)}`;
}

export function getCaseStudyBackgroundLensUrl(background: CaseStudyBackground) {
  const baseUrl = supabaseUrl.replace(/\/$/, "");
  const objectPath = background.lensObjectPath ?? background.objectPath;
  return `${baseUrl}/storage/v1/object/public/${encodeURIComponent(background.bucket)}/${encodeObjectPath(objectPath)}`;
}
