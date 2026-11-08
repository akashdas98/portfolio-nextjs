import type { PcbRegion } from "./spatial";
import { HOME_PCB_SOURCE, HOME_PCB_REVISION } from "./home-identity.ts";

export const PCB_BOOTSTRAP_SOURCE_HEIGHT = 2_048;
export const PCB_BOOTSTRAP_PADDING = 16;

export function createPcbSourceParams(source: string) {
  const params = new URLSearchParams({ source });
  if (source === HOME_PCB_SOURCE) params.set("v", HOME_PCB_REVISION);
  return params;
}

/** Stable source coordinates let preload and hydrated consumers share one URL. */
export function buildPcbGeometryUrl(source: string, region: PcbRegion) {
  if (typeof source !== "string" || source.length === 0 || source.length > 4_096 ||
    !region || [region.x, region.y, region.width, region.height].some((value) =>
      typeof value !== "number" || !Number.isFinite(value)) ||
    Math.abs(region.x) > 100_000 || Math.abs(region.y) > 100_000 ||
    region.width <= 0 || region.height <= 0 ||
    region.width > 65_536 || region.height > 65_536) {
    throw new Error("Invalid PCB geometry request.");
  }
  const params = createPcbSourceParams(source);
  for (const name of ["x", "y", "width", "height"] as const) {
    params.set(name, String(region[name]));
  }
  return `/api/pcb?${params}`;
}

/** A bounded first source band, independent of viewport or client detection. */
export function createPcbBootstrap(source: string, sourceWidth: number, sourceHeight: number) {
  if ([sourceWidth, sourceHeight].some((value) =>
    typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 50_000)) {
    throw new Error("Invalid PCB bootstrap source dimensions.");
  }
  const region: PcbRegion = {
    x: -PCB_BOOTSTRAP_PADDING,
    y: -PCB_BOOTSTRAP_PADDING,
    width: sourceWidth + PCB_BOOTSTRAP_PADDING * 2,
    height: Math.min(sourceHeight, PCB_BOOTSTRAP_SOURCE_HEIGHT) + PCB_BOOTSTRAP_PADDING * 2,
  };
  return { source, region, href: buildPcbGeometryUrl(source, region) };
}
