export const TOUCH_LOCAL_FLAME_CONTRACT = Object.freeze({
  attackMax: 90,
  attackMin: 45,
  centralPlacementProbability: 0.4,
  desktopCentralRadius: 72,
  desktopEnvelopeRadius: 247.5,
  desktopLensDiameter: 615,
  fadeMax: 1_200,
  fadeMin: 720,
  lowerSizeBand: 0.3,
  lowerSizeProbability: 0.09,
  radiusRange: 75.6,
  radiusMin: 43.2,
  riseOpacityMax: 0.96,
  riseOpacityMin: 0.78,
  riseProbability: 0.6,
  slotCount: 10,
  spawnDelayMax: 168,
  spawnDelayMin: 72,
});

export type TouchLocalFlame = {
  attackDuration: number;
  fadeDuration: number;
  mode: "dip" | "rise";
  peakOpacity: number;
  radius: number;
  slot: number;
  startedAt: number;
  x: number;
  y: number;
};

function sampleRange(minimum: number, maximum: number, random: () => number) {
  return minimum + Math.max(0, Math.min(1, random())) * (maximum - minimum);
}

export function sampleTouchLocalFlame(
  slot: number,
  startedAt: number,
  touchLensDiameter: number,
  random: () => number = Math.random,
): TouchLocalFlame {
  const scale = touchLensDiameter / TOUCH_LOCAL_FLAME_CONTRACT.desktopLensDiameter;
  const center = touchLensDiameter / 2;
  const centralRadius = TOUCH_LOCAL_FLAME_CONTRACT.desktopCentralRadius * scale;
  const maximumDistance = TOUCH_LOCAL_FLAME_CONTRACT.desktopEnvelopeRadius * 0.82 * scale;
  const centralPlacement = random() <
    TOUCH_LOCAL_FLAME_CONTRACT.centralPlacementProbability;
  const placementRadius = centralPlacement ? centralRadius : maximumDistance;
  const distance = Math.sqrt(Math.max(0, Math.min(1, random()))) * placementRadius;
  const angle = random() * Math.PI * 2;
  const centralBoost = Math.max(0, 1 - distance / centralRadius);
  const mode = random() < TOUCH_LOCAL_FLAME_CONTRACT.riseProbability
    ? "rise" : "dip";
  const peakOpacity = mode === "rise"
    ? Math.min(
      1,
      sampleRange(
        TOUCH_LOCAL_FLAME_CONTRACT.riseOpacityMin,
        TOUCH_LOCAL_FLAME_CONTRACT.riseOpacityMax,
        random,
      ) + centralBoost * 0.04,
    )
    : sampleRange(0.057, 0.107, random) + centralBoost * 0.043;
  const attackDuration = sampleRange(
    TOUCH_LOCAL_FLAME_CONTRACT.attackMin,
    TOUCH_LOCAL_FLAME_CONTRACT.attackMax,
    random,
  );
  const fadeDuration = sampleRange(
    TOUCH_LOCAL_FLAME_CONTRACT.fadeMin,
    TOUCH_LOCAL_FLAME_CONTRACT.fadeMax,
    random,
  );
  const lowerSize = random() < TOUCH_LOCAL_FLAME_CONTRACT.lowerSizeProbability;
  const normalizedSize = lowerSize
    ? random() * TOUCH_LOCAL_FLAME_CONTRACT.lowerSizeBand
    : TOUCH_LOCAL_FLAME_CONTRACT.lowerSizeBand +
      random() * (1 - TOUCH_LOCAL_FLAME_CONTRACT.lowerSizeBand);
  const radius = (
    TOUCH_LOCAL_FLAME_CONTRACT.radiusMin +
    normalizedSize * TOUCH_LOCAL_FLAME_CONTRACT.radiusRange
  ) * scale;

  return {
    attackDuration,
    fadeDuration,
    mode,
    peakOpacity,
    radius,
    slot,
    startedAt,
    x: center + Math.cos(angle) * distance,
    y: center + Math.sin(angle) * distance,
  };
}

function interpolate(
  elapsed: number,
  startAt: number,
  startValue: number,
  endAt: number,
  endValue: number,
) {
  if (endAt === startAt) return endValue;
  const progress = (elapsed - startAt) / (endAt - startAt);
  return startValue + (endValue - startValue) * progress;
}

export function touchLocalFlamePhaseOpacity(flame: TouchLocalFlame, at: number) {
  const elapsed = at - flame.startedAt;
  const attack = flame.attackDuration;
  const total = attack + flame.fadeDuration;
  const shoulder = attack + flame.fadeDuration * 0.3;
  const tail = attack + flame.fadeDuration * 0.7;
  if (elapsed <= 0 || elapsed >= total) return 0;
  if (elapsed <= attack) return elapsed / attack;
  if (elapsed <= shoulder) return interpolate(elapsed, attack, 1, shoulder, 0.72);
  if (elapsed <= tail) return interpolate(elapsed, shoulder, 0.72, tail, 0.34);
  return interpolate(elapsed, tail, 0.34, total, 0);
}

export function touchLocalFlameIsActive(flame: TouchLocalFlame, at: number) {
  return at < flame.startedAt + flame.attackDuration + flame.fadeDuration;
}

export function sampleTouchLocalFlameSpawnDelay(
  random: () => number = Math.random,
) {
  return sampleRange(
    TOUCH_LOCAL_FLAME_CONTRACT.spawnDelayMin,
    TOUCH_LOCAL_FLAME_CONTRACT.spawnDelayMax,
    random,
  );
}

export function activeTouchLocalFlames(
  slots: ReadonlyArray<TouchLocalFlame | null>,
  at: number,
) {
  return slots.filter(
    (flame): flame is TouchLocalFlame =>
      flame !== null && touchLocalFlameIsActive(flame, at),
  );
}
