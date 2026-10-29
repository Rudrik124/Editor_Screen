import { ClipModel } from "../types/editor.types";

export interface AudioSourceRange {
  start: number;
  end: number;
  duration: number;
}

export function getAudioSourceRange(
  clip: ClipModel,
  mediaDuration = Number.POSITIVE_INFINITY
): AudioSourceRange {
  const start = Math.max(0, clip.inPoint ?? 0);
  const expectedEnd =
    clip.outPoint ??
    clip.baseDuration ??
    start + clip.duration * (clip.speed ?? 1);
  const end = Math.max(start, Math.min(mediaDuration, expectedEnd));

  return { start, end, duration: end - start };
}

export function getAudioPlaybackRate(
  clip: ClipModel,
  mediaDuration = Number.POSITIVE_INFINITY
): number {
  const sourceRange = getAudioSourceRange(clip, mediaDuration);
  return sourceRange.duration / Math.max(0.01, clip.duration);
}
