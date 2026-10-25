import { ClipModel, KeyframeData, KeyframeProperty } from "../types/editor.types";

function applyEasing(t: number, type: string = "linear"): number {
  const clamped = Math.max(0, Math.min(1, t));
  switch (type) {
    case "easeIn":
      return clamped * clamped;
    case "easeOut":
      return clamped * (2 - clamped);
    case "easeInOut":
      return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped;
    case "linear":
    default:
      return clamped;
  }
}

export function interpolateKeyframeValue(
  keyframes: KeyframeData[],
  property: KeyframeProperty,
  timeOffset: number,
  fallbackValue: number
): number {
  const propKeyframes = keyframes
    .filter((k) => k.property === property)
    .sort((a, b) => a.timeOffset - b.timeOffset);

  if (propKeyframes.length === 0) return fallbackValue;

  // Before first keyframe
  if (timeOffset <= propKeyframes[0].timeOffset) {
    return propKeyframes[0].value;
  }

  // After last keyframe
  const lastKf = propKeyframes[propKeyframes.length - 1];
  if (timeOffset >= lastKf.timeOffset) {
    return lastKf.value;
  }

  // Find surrounding segment
  for (let i = 0; i < propKeyframes.length - 1; i++) {
    const kA = propKeyframes[i];
    const kB = propKeyframes[i + 1];
    if (timeOffset >= kA.timeOffset && timeOffset <= kB.timeOffset) {
      const segDuration = kB.timeOffset - kA.timeOffset;
      if (segDuration <= 0.0001) return kB.value;

      const rawProgress = (timeOffset - kA.timeOffset) / segDuration;
      const easedProgress = applyEasing(rawProgress, kB.interpolation || "linear");
      return kA.value + (kB.value - kA.value) * easedProgress;
    }
  }

  return fallbackValue;
}

export interface EvaluatedTransform {
  opacity: number;
  scale: number;
  positionX: number;
  positionY: number;
  rotation: number;
  volume: number;
}

export function evaluateClipTransforms(
  clip: ClipModel,
  localTime: number
): EvaluatedTransform {
  const keyframes = clip.keyframes || [];

  return {
    opacity: interpolateKeyframeValue(
      keyframes,
      "opacity",
      localTime,
      clip.opacity !== undefined ? clip.opacity : 1.0
    ),
    scale: interpolateKeyframeValue(
      keyframes,
      "scale",
      localTime,
      clip.scale !== undefined ? clip.scale : 1.0
    ),
    positionX: interpolateKeyframeValue(
      keyframes,
      "positionX",
      localTime,
      clip.positionX !== undefined ? clip.positionX : 0.0
    ),
    positionY: interpolateKeyframeValue(
      keyframes,
      "positionY",
      localTime,
      clip.positionY !== undefined ? clip.positionY : 0.0
    ),
    rotation: interpolateKeyframeValue(
      keyframes,
      "rotation",
      localTime,
      clip.rotation !== undefined ? clip.rotation : 0.0
    ),
    volume: interpolateKeyframeValue(
      keyframes,
      "volume",
      localTime,
      clip.volume !== undefined ? clip.volume : 1.0
    ),
  };
}
