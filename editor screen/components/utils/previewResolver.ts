import { ClipModel, TrackModel } from "../../types/editor.types";
import { getTransitionDefinition } from "../../plugins/transition/transition.catalog";

export interface ResolvedTransitionInfo {
  progress: number;
  typeIndex: number;
  color: string;
}

export interface ActiveClipsResolution {
  activeVideoClip: ClipModel | null;
  nextVideoClip: ClipModel | null;
  transitionInfo: ResolvedTransitionInfo | null;
  activeOverlayClip: ClipModel | null;
}

export function computeSourceTime(
  clip: ClipModel | null,
  time: number,
  transitionStart?: number
): number {
  if (!clip) return time;
  let local: number;
  if (transitionStart !== undefined && time >= transitionStart) {
    // When playing as incoming clip in a transition, time flows forward from transitionStart
    local = Math.max(0, Math.min(clip.duration, (time - transitionStart) * (clip.speed ?? 1.0)));
  } else {
    local = Math.max(0, Math.min(clip.duration, time - clip.start));
  }
  if (clip.isFrozen) return clip.freezeTime ?? clip.inPoint ?? 0;
  const inPoint = clip.inPoint ?? 0;
  const speed = clip.speed ?? 1.0;
  if (clip.reverse) {
    const outPoint = clip.outPoint ?? inPoint + clip.duration;
    return Math.max(inPoint, outPoint - local * speed);
  }
  return inPoint + local * speed;
}

export function resolveActiveClips(
  storeTracks: TrackModel[],
  storeClips: Record<string, ClipModel>,
  currentTime: number
): ActiveClipsResolution {
  // 1. Resolve video clips on main track, or fall back to any available video clips
  const videoTrack = storeTracks.find((t) => t.id === "video");
  let videoClips = videoTrack && videoTrack.clipIds.length > 0
    ? videoTrack.clipIds.map((id) => storeClips[id]).filter(Boolean)
    : [];

  if (videoClips.length === 0) {
    videoClips = Object.values(storeClips).filter((c) => c.type === "video");
  }

  let activeVideoClip: ClipModel | null = null;
  let nextVideoClip: ClipModel | null = null;
  let transitionInfo: ResolvedTransitionInfo | null = null;

  if (videoClips.length > 0) {
    const currentIndex = videoClips.findIndex(
      (c) => currentTime >= c.start && currentTime < c.start + c.duration
    );

    if (currentIndex === -1) {
      activeVideoClip = videoClips[0];
    } else {
      activeVideoClip = videoClips[currentIndex];
      nextVideoClip = currentIndex < videoClips.length - 1 ? videoClips[currentIndex + 1] : null;

      if (activeVideoClip.transition && nextVideoClip) {
        const transDur = activeVideoClip.transition.duration || 0.5;
        const transStart = activeVideoClip.start + activeVideoClip.duration - transDur;
        if (currentTime >= transStart && currentTime <= activeVideoClip.start + activeVideoClip.duration) {
          const progress = Math.max(0, Math.min(1, (currentTime - transStart) / transDur));
          const def = getTransitionDefinition(activeVideoClip.transition.type);
          transitionInfo = {
            progress,
            typeIndex: def.index,
            color: activeVideoClip.transition.color || "#000000",
          };
        }
      }
    }
  }

  // 2. Resolve overlay / PIP clip
  let activeOverlayClip: ClipModel | null = null;
  const overlayTracks = storeTracks.filter((t) => t.id.includes("overlay"));
  for (const track of overlayTracks) {
    const clips = track.clipIds.map((id) => storeClips[id]).filter(Boolean);
    const hit = clips.find(
      (c) => currentTime >= c.start && currentTime < c.start + c.duration
    );
    if (hit) {
      activeOverlayClip = hit;
      break;
    }
  }

  return {
    activeVideoClip,
    nextVideoClip,
    transitionInfo,
    activeOverlayClip,
  };
}

export function syncVideoElement(
  video: HTMLVideoElement | null,
  url: string | null | undefined,
  targetTime: number,
  isPlaying: boolean
): void {
  if (!video || !url) return;
  if (video.src !== url && !video.src.endsWith(url)) {
    video.src = url;
  }
  if (isPlaying) {
    if (video.paused) {
      void video.play().catch(() => {});
    }
    if (Math.abs(video.currentTime - targetTime) > 0.8) {
      video.currentTime = targetTime;
    }
  } else {
    if (!video.paused) {
      video.pause();
    }
    if (Math.abs(video.currentTime - targetTime) > 0.04) {
      video.currentTime = targetTime;
    }
  }
}
