import React from "react";
import { TimelineClip as TimelineClipData } from "../../types/editor.types";

export function badgeStyle(color: string): React.CSSProperties {
  return {
    fontSize: "8px",
    fontWeight: 700,
    background: "#181a1f",
    color,
    padding: "1px 3px",
    borderRadius: "2px",
    border: `1px solid ${color}44`,
    lineHeight: "1",
  };
}

export function getClipVisibleThumbnails(clip: TimelineClipData): string[] {
  const sourceThumbnails = clip.rawThumbnails || clip.thumbnails;
  if (!sourceThumbnails || sourceThumbnails.length === 0) return [];

  const totalFrames = sourceThumbnails.length;
  const inPoint = clip.inPoint ?? 0;
  const outPoint = clip.outPoint ?? (inPoint + clip.duration);
  const totalDuration = Math.max(
    clip.baseDuration ?? 0,
    outPoint,
    clip.duration,
    0.01
  );

  // 1. Frozen clip: repeat the frame at freezeTime across the whole clip
  if (clip.isFrozen) {
    const freezeTime = clip.freezeTime ?? inPoint;
    const freezeRatio = Math.max(0, Math.min(1, freezeTime / totalDuration));
    const frameIndex = Math.min(
      totalFrames - 1,
      Math.floor(freezeRatio * totalFrames)
    );
    const frozenFrame = sourceThumbnails[frameIndex] || sourceThumbnails[0];
    const frameCount = Math.max(2, Math.round(clip.duration * 2));
    return Array(frameCount).fill(frozenFrame);
  }

  // 2. Normal / Sliced / Trimmed segment
  const startRatio = Math.max(0, Math.min(1, inPoint / totalDuration));
  const endRatio = Math.max(0, Math.min(1, outPoint / totalDuration));

  let startIndex = Math.floor(startRatio * totalFrames);
  let endIndex = Math.ceil(endRatio * totalFrames);

  startIndex = Math.max(0, Math.min(totalFrames - 1, startIndex));
  endIndex = Math.max(startIndex + 1, Math.min(totalFrames, endIndex));

  let slice = sourceThumbnails.slice(startIndex, endIndex);
  if (slice.length === 0) {
    slice = [sourceThumbnails[startIndex] || sourceThumbnails[0]];
  }

  // 3. Reverse playback
  if (clip.reverse) {
    slice = [...slice].reverse();
  }

  return slice;
}
