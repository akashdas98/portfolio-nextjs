import { getBrowserGeometryDelivery } from "@/lib/pcb/browser-geometry";
export { IMPACT_SECTION_SELECTOR, MUTED_SECTION_SELECTOR, SPECIAL_IMPACT_SECTION_SELECTOR, sectionRanges, type ToneRange } from "@/lib/pcb/tone-ranges";

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

export type EnvelopeStop = {
  offset: number;
  opacity: number;
};

export const LENS_DIAMETER = 615;
export const LENS_RADIUS = LENS_DIAMETER / 2;
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

export function sampleFlameRadius() {
  const isLowerSize = Math.random() < FLAME_LOWER_SIZE_PROBABILITY;
  const normalizedSize = isLowerSize
    ? Math.random() * FLAME_LOWER_SIZE_BAND
    : FLAME_LOWER_SIZE_BAND +
      Math.random() * (1 - FLAME_LOWER_SIZE_BAND);

  return FLAME_MIN_RADIUS + normalizedSize * FLAME_RADIUS_RANGE;
}

export function loadLensGeometry(url: string, region: SourceRegion): Promise<LensPath[]> {
  return getBrowserGeometryDelivery().load(url, region);
}
