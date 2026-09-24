export type PublicCircuitBackgroundProps = {
  imageUrl: string;
  lensImageUrl?: string;
  sourceWidth: number;
  sourceHeight: number;
};

export type InitialPointerInput = {
  clientX: number;
  clientY: number;
  pointerType: string;
};

export type SourceRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LensPath = {
  source: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ToneRange = {
  bottom: number;
  top: number;
};

export type EnvelopeStop = {
  offset: number;
  opacity: number;
};

export const LENS_DIAMETER = 615;
export const LENS_RADIUS = LENS_DIAMETER / 2;
export const MUTED_SECTION_SELECTOR = ".case-section-muted, .selected-work-section, .about-section, .contact-section";
export const IMPACT_SECTION_SELECTOR = ".case-impact-section";
export const POINTER_TRAIL_DURATION = 560;
export const BLUE_ENVELOPE_STOPS: EnvelopeStop[] = [
  { offset: 0, opacity: 0.96 },
  { offset: 0.08, opacity: 0.94 },
  { offset: 0.3, opacity: 0.82 },
  { offset: 0.5, opacity: 0.62 },
  { offset: 0.68, opacity: 0.38 },
  { offset: 0.8, opacity: 0.2 },
  { offset: 0.9, opacity: 0.08 },
  { offset: 0.96, opacity: 0.01 },
];

export const PINK_ENVELOPE_STOPS: EnvelopeStop[] = [
  { offset: 0, opacity: 0.94 },
  { offset: 0.08, opacity: 0.92 },
  { offset: 0.3, opacity: 0.8 },
  { offset: 0.5, opacity: 0.6 },
  { offset: 0.68, opacity: 0.37 },
  { offset: 0.8, opacity: 0.19 },
  { offset: 0.9, opacity: 0.075 },
  { offset: 0.96, opacity: 0.01 },
];

const FLAME_RADIUS_SCALE = 1.8;
const FLAME_MIN_RADIUS = 24 * FLAME_RADIUS_SCALE;
const FLAME_RADIUS_RANGE = 42 * FLAME_RADIUS_SCALE;
const FLAME_LOWER_SIZE_BAND = 0.3;
const FLAME_LOWER_SIZE_PROBABILITY = 0.09;
const lensGeometryCache = new Map<string, Promise<LensPath[]>>();

export function sampleFlameRadius() {
  const isLowerSize = Math.random() < FLAME_LOWER_SIZE_PROBABILITY;
  const normalizedSize = isLowerSize
    ? Math.random() * FLAME_LOWER_SIZE_BAND
    : FLAME_LOWER_SIZE_BAND +
      Math.random() * (1 - FLAME_LOWER_SIZE_BAND);

  return FLAME_MIN_RADIUS + normalizedSize * FLAME_RADIUS_RANGE;
}

export function loadLensGeometry(url: string, region: SourceRegion) {
  const params = new URLSearchParams({ source: url });
  for (const [name, value] of Object.entries(region)) params.set(name, String(value));
  const key = params.toString();
  const cached = lensGeometryCache.get(key);
  if (cached) return cached;
  // The server indexes the immutable source once. A device receives only the
  // exact paths needed for its current tile or interaction, with measured-space
  // conservative bounds; it never parses a hidden full-page SVG for getBBox.
  const request = fetch(`/api/pcb?${key}`).then(async (response) => {
    if (!response.ok) throw new Error(`PCB projection failed: ${response.status}`);
    const result = await response.json() as { paths: LensPath[] };
    return result.paths;
  }).catch((error) => {
    lensGeometryCache.delete(key);
    throw error;
  });
  if (lensGeometryCache.size >= 128) {
    const oldest = lensGeometryCache.keys().next().value;
    if (oldest !== undefined) lensGeometryCache.delete(oldest);
  }
  lensGeometryCache.set(key, request);
  return request;
}

export function sectionRanges(
  page: HTMLElement,
  pageDocumentTop: number,
  selector: string,
) {
  return Array.from(page.querySelectorAll<HTMLElement>(":scope > section"))
    .filter((section) => section.matches(selector))
    .map((section) => {
      const rect = section.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY - pageDocumentTop,
        bottom: rect.bottom + window.scrollY - pageDocumentTop,
      };
    });
}
