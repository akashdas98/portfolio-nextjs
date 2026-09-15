export type EnvelopeWave = {
  active: boolean;
  amplitude: number;
  angle: number;
  attackDuration: number;
  decayDuration: number;
  startedAt: number;
  wavelength: number;
};

export type EnvelopeDirection = { angle: number; x: number; y: number };

export type EnvelopeEvaluatorConfig = {
  baseRadius: number;
  directions: readonly EnvelopeDirection[];
  maxDisplacement: number;
  tinyMaxDisplacement: number;
  warpStart: number;
};

export function createEnvelopeDirections(count: number): EnvelopeDirection[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return { angle, x: Math.cos(angle), y: Math.sin(angle) };
  });
}

export function smoothStep(progress: number) {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped * clamped * (3 - 2 * clamped);
}

export function evaluateEnvelopeDisplacements(
  largeWaves: readonly EnvelopeWave[],
  tinyWaves: readonly EnvelopeWave[],
  timestamp: number,
  config: EnvelopeEvaluatorConfig,
) {
  const displacements = new Array<number>(config.directions.length).fill(0);
  const step = Math.PI * 2 / config.directions.length;
  function addWave(wave: EnvelopeWave, limit: number) {
    if (!wave.active) return;
    const elapsed = timestamp - wave.startedAt;
    const progress = elapsed <= wave.attackDuration
      ? elapsed / wave.attackDuration
      : 1 - (elapsed - wave.attackDuration) / wave.decayDuration;
    const amplitude = wave.amplitude * smoothStep(progress);
    const halfAngle = wave.wavelength / config.baseRadius;
    const first = Math.ceil((wave.angle - halfAngle) / step);
    const last = Math.floor((wave.angle + halfAngle) / step);
    for (let sample = first; sample <= last; sample += 1) {
      const index = (sample % displacements.length + displacements.length) % displacements.length;
      const distance = Math.abs(sample * step - wave.angle) / halfAngle;
      const weight = (1 - distance * distance) ** 3;
      displacements[index] += (1 - displacements[index] / limit) * amplitude * weight;
    }
  }
  tinyWaves.forEach((wave) => addWave(wave, config.tinyMaxDisplacement));
  largeWaves.forEach((wave) => addWave(wave, config.maxDisplacement));
  return displacements;
}

export function envelopeContourRadius(
  offset: number,
  displacement: number,
  config: EnvelopeEvaluatorConfig,
) {
  const radius = offset * config.baseRadius;
  const distance = Math.max(0, Math.min(config.maxDisplacement, displacement));
  const edgeWeight = smoothStep((offset - config.warpStart) / (0.8 - config.warpStart));
  const outerProgress = Math.max(0, (offset - config.warpStart) / (1 - config.warpStart));
  const brightnessTransport = config.baseRadius * (1 - config.warpStart) *
    outerProgress * (1 - outerProgress);
  return radius + distance * edgeWeight +
    (distance / config.maxDisplacement) * brightnessTransport;
}

export function envelopeContourPath(
  offset: number,
  displacements: readonly number[],
  lensRadius: number,
  config: EnvelopeEvaluatorConfig,
) {
  const baseRadius = offset * config.baseRadius;
  const displacementScale = envelopeContourRadius(offset, 1, config) - baseRadius;
  return config.directions.map(({ x, y }, index) => {
    const radius = baseRadius + displacementScale * displacements[index];
    return `${index === 0 ? "M" : "L"}${(lensRadius + x * radius).toFixed(2)} ${(lensRadius + y * radius).toFixed(2)}`;
  }).join("") + "Z";
}
