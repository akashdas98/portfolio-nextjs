export const GLOBAL_FLAME_PULSE_CONTRACT = Object.freeze({
  attackMax: 78,
  attackMin: 36,
  dipOpacityMax: 0.12,
  dipOpacityMin: 0.06,
  fadeMax: 440,
  fadeMin: 190,
  gapMax: 165,
  gapMin: 45,
  riseOpacityMax: 0.32,
  riseOpacityMin: 0.16,
  riseProbability: 0.56,
});

export const DESKTOP_NEUTRAL_FLAME_ALPHA = 0x97 / 0xff;
const DECAY_SHOULDER_OFFSET = 0.58;
const DECAY_SHOULDER_SCALE = 0.48;

export type GlobalFlamePulse = {
  attackDuration: number;
  fadeDuration: number;
  gapDuration: number;
  mode: "dip" | "rise";
  peakOpacity: number;
  startedAt: number;
};

export type GlobalFlamePulseFrame = {
  mode: GlobalFlamePulse["mode"];
  opacity: number;
};

function sampleRange(minimum: number, maximum: number, random: () => number) {
  return minimum + Math.max(0, Math.min(1, random())) * (maximum - minimum);
}

export function sampleGlobalFlamePulse(
  startedAt: number,
  random: () => number = Math.random,
): GlobalFlamePulse {
  const mode = random() < GLOBAL_FLAME_PULSE_CONTRACT.riseProbability
    ? "rise" : "dip";
  const peakOpacity = mode === "rise"
    ? sampleRange(
      GLOBAL_FLAME_PULSE_CONTRACT.riseOpacityMin,
      GLOBAL_FLAME_PULSE_CONTRACT.riseOpacityMax,
      random,
    )
    : sampleRange(
      GLOBAL_FLAME_PULSE_CONTRACT.dipOpacityMin,
      GLOBAL_FLAME_PULSE_CONTRACT.dipOpacityMax,
      random,
    );

  return {
    attackDuration: sampleRange(
      GLOBAL_FLAME_PULSE_CONTRACT.attackMin,
      GLOBAL_FLAME_PULSE_CONTRACT.attackMax,
      random,
    ),
    fadeDuration: sampleRange(
      GLOBAL_FLAME_PULSE_CONTRACT.fadeMin,
      GLOBAL_FLAME_PULSE_CONTRACT.fadeMax,
      random,
    ),
    gapDuration: sampleRange(
      GLOBAL_FLAME_PULSE_CONTRACT.gapMin,
      GLOBAL_FLAME_PULSE_CONTRACT.gapMax,
      random,
    ),
    mode,
    peakOpacity,
    startedAt,
  };
}

export function advanceGlobalFlamePulse(
  pulse: GlobalFlamePulse | null,
  at: number,
  random: () => number = Math.random,
) {
  if (pulse === null) return sampleGlobalFlamePulse(at, random);
  const nextStartedAt = pulse.startedAt + pulse.attackDuration +
    pulse.fadeDuration + pulse.gapDuration;
  return at >= nextStartedAt ? sampleGlobalFlamePulse(at, random) : pulse;
}

export function evaluateGlobalFlamePulse(
  pulse: GlobalFlamePulse,
  at: number,
): GlobalFlamePulseFrame {
  const elapsed = at - pulse.startedAt;
  const totalDuration = pulse.attackDuration + pulse.fadeDuration;
  if (elapsed <= 0 || elapsed >= totalDuration) {
    return { mode: pulse.mode, opacity: 0 };
  }
  if (elapsed <= pulse.attackDuration) {
    return {
      mode: pulse.mode,
      opacity: pulse.peakOpacity * elapsed / pulse.attackDuration,
    };
  }

  const shoulderAt = totalDuration * DECAY_SHOULDER_OFFSET;
  if (elapsed <= shoulderAt) {
    const progress = (elapsed - pulse.attackDuration) /
      (shoulderAt - pulse.attackDuration);
    return {
      mode: pulse.mode,
      opacity: pulse.peakOpacity *
        (1 - (1 - DECAY_SHOULDER_SCALE) * progress),
    };
  }

  return {
    mode: pulse.mode,
    opacity: pulse.peakOpacity * DECAY_SHOULDER_SCALE *
      (1 - (elapsed - shoulderAt) / (totalDuration - shoulderAt)),
  };
}

export function compositeFlameAlpha(
  destinationAlpha: number,
  frame: GlobalFlamePulseFrame,
) {
  return frame.mode === "rise"
    ? destinationAlpha + (1 - destinationAlpha) * frame.opacity
    : destinationAlpha * (1 - frame.opacity);
}

export function globalFlamePulseAlpha(frame: GlobalFlamePulseFrame) {
  return compositeFlameAlpha(DESKTOP_NEUTRAL_FLAME_ALPHA, frame);
}
