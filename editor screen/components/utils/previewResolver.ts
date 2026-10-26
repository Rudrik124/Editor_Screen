import { ClipModel, TrackModel } from "../../types/editor.types";
import { getTransitionDefinition } from "../../plugins/transition/transition.catalog";

export interface ResolvedTransitionInfo {
  progress: number;
  typeIndex: number;
  color: string;
}

export interface ActiveClipsResolution {
  activeVideoClip: ClipModel | null;
  activeClipIndex: number;
  nextVideoClip: ClipModel | null;
  transitionInfo: ResolvedTransitionInfo | null;
  activeOverlayClip: ClipModel | null;
  videoClips: ClipModel[];
}

export function computeSourceTime(
  clip: ClipModel | null,
  time: number,
  transitionStart?: number
): number {
  if (!clip) return 0;
  let local: number;
  if (transitionStart !== undefined && time >= transitionStart) {
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
  const videoTrack = storeTracks.find((t) => t.id === "video");
  let videoClips = videoTrack && videoTrack.clipIds.length > 0
    ? videoTrack.clipIds.map((id) => storeClips[id]).filter(Boolean)
    : [];

  if (videoClips.length === 0) {
    videoClips = Object.values(storeClips).filter((c) => c.type === "video");
  }

  videoClips.sort((a, b) => a.start - b.start);

  let activeVideoClip: ClipModel | null = null;
  let activeClipIndex = -1;
  let nextVideoClip: ClipModel | null = null;
  let transitionInfo: ResolvedTransitionInfo | null = null;

  // 1. Check if current time falls in a transition window between adjacent clips
  for (let i = 0; i < videoClips.length - 1; i++) {
    const c1 = videoClips[i];
    const c2 = videoClips[i + 1];
    const trans = c1.transition || c2.transition;
    if (trans && trans.type !== "instant_cut") {
      const transDur = Math.max(0.1, trans.duration !== undefined ? trans.duration : 0.5);
      const cutPoint = c2.start;
      const transStart = cutPoint - transDur;
      const transEnd = cutPoint;
      if (currentTime >= transStart && currentTime < transEnd) {
        const progress = Math.max(0, Math.min(1, (currentTime - transStart) / transDur));
        const def = getTransitionDefinition(trans.type);
        activeVideoClip = c1;
        activeClipIndex = i;
        nextVideoClip = c2;
        transitionInfo = {
          progress,
          typeIndex: def.index,
          color: trans.color || "#000000",
        };
        break;
      }
    }
  }

  // 2. If not in a transition, find exact active clip under playhead
  if (!transitionInfo && videoClips.length > 0) {
    const exactIndex = videoClips.findIndex(
      (c) => currentTime >= c.start && currentTime < c.start + c.duration
    );

    if (exactIndex !== -1) {
      activeVideoClip = videoClips[exactIndex];
      activeClipIndex = exactIndex;
      nextVideoClip = exactIndex < videoClips.length - 1 ? videoClips[exactIndex + 1] : null;
    } else {
      // In a gap or outside clips
      activeVideoClip = null;
      activeClipIndex = -1;
      nextVideoClip = videoClips.find((c) => c.start > currentTime) || null;
    }
  }

  // 3. Resolve overlay / PIP clip
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
    activeClipIndex,
    nextVideoClip,
    transitionInfo,
    activeOverlayClip,
    videoClips,
  };
}

export function isImageMedia(url?: string | null, name?: string | null): boolean {
  if (!url && !name) return false;
  if (url && (url.startsWith("data:image/") || url.startsWith("blob:image/"))) return true;
  const testStr = ((name || "") + " " + (url || "")).toLowerCase();
  return /\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?.*)?$/i.test(testStr);
}

export function syncVideoElement(
  video: HTMLVideoElement | null,
  url: string | null | undefined,
  targetTime: number,
  isPlaying: boolean,
  playbackRate: number = 1.0
): void {
  if (!video || !url) return;

  if (video.src !== url && !video.src.endsWith(url)) {
    video.src = url;
    const onLoaded = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      try {
        if (targetTime > 0 && Number.isFinite(targetTime) && targetTime < (video.duration || 9999)) {
          video.currentTime = targetTime;
        }
      } catch {}
      if (isPlaying) {
        void video.play().catch(() => {});
      }
    };
    video.addEventListener("loadedmetadata", onLoaded);
    return;
  }

  if (video.playbackRate !== playbackRate) {
    video.playbackRate = playbackRate;
  }

  if (isPlaying) {
    if (video.paused && video.readyState >= 2) {
      void video.play().catch(() => {});
    }
    if (!video.seeking && video.readyState >= 2 && Math.abs(video.currentTime - targetTime) > 0.35) {
      video.currentTime = targetTime;
    }
  } else {
    if (!video.paused) {
      video.pause();
    }
    if (!video.seeking && video.readyState >= 1 && Math.abs(video.currentTime - targetTime) > 0.04) {
      video.currentTime = targetTime;
    }
  }
}
