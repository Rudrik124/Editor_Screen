import { ClipModel } from "../types/editor.types";
import { EditorCommand } from "../types/command.types";
import { TimelineStateSlice } from "./clip.mutations";
import { getAudioPlaybackRate, getAudioSourceRange } from "../utils/audioTimeline";

export function handleTrimClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, edge, newTime, oldState } = command.payload as {
    clipId: string;
    edge: "left" | "right";
    newTime: number;
    oldState?: {
      start: number;
      duration: number;
      inPoint?: number;
      outPoint?: number;
    };
  };

  const clip = state.clips[clipId];
  if (!clip) return null;
  if (clip.locked) {
    console.warn(`Operation rejected: clip "${clip.name}" is locked.`);
    return null;
  }

  const prevStart = oldState ? oldState.start : clip.start;
  const prevDuration = oldState ? oldState.duration : clip.duration;
  const prevIn = oldState ? oldState.inPoint : clip.inPoint;
  const prevOut = oldState ? oldState.outPoint : clip.outPoint;

  let newStart = clip.start;
  let newDuration = clip.duration;
  let newIn = clip.inPoint ?? 0;
  let newOut = clip.outPoint;
  const speed = clip.speed ?? 1;
  const sourceDuration = clip.baseDuration ?? clip.outPoint;
  const maxSourceOut =
    sourceDuration !== undefined && Number.isFinite(sourceDuration)
      ? sourceDuration
      : undefined;

  const currentEnd = clip.start + clip.duration;
  const isAudioClip = clip.type === "audio" || clip.type === "music";

  if (edge === "left") {
    const minStart = Math.max(0, newTime);
    if (minStart >= currentEnd - 0.1) return null; // Min 0.1s
    const delta = minStart - clip.start;
    newStart = minStart;
    newDuration = currentEnd - minStart;
    if (isAudioClip) {
      const sourceRange = getAudioSourceRange(clip);
      newIn = Math.min(
        sourceRange.end,
        sourceRange.start + delta * getAudioPlaybackRate(clip)
      );
      newOut = clip.outPoint;
    } else {
      newIn = Math.max(0, (clip.inPoint ?? 0) + delta * speed);
      newOut = newIn + newDuration * speed;
    }
  } else {
    if (newTime <= clip.start + 0.1) return null; // Min 0.1s
    const requestedDuration = newTime - clip.start;
    const maxDuration = isAudioClip
      ? Math.max(
          0,
          (maxSourceOut ?? getAudioSourceRange(clip).end) - newIn
        ) / 0.1
      : maxSourceOut === undefined
        ? requestedDuration
        : Math.max(0, (maxSourceOut - newIn) / speed);
    newDuration = Math.min(requestedDuration, maxDuration);
    if (newDuration <= 0.1) return null;
    newOut = isAudioClip
      ? Math.min(maxSourceOut ?? Number.POSITIVE_INFINITY, newIn + newDuration * speed)
      : newIn + newDuration * speed;
  }

  const updatedClip: ClipModel = {
    ...clip,
    start: newStart,
    duration: newDuration,
    inPoint: newIn,
    outPoint: newOut,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "TRIM_CLIP",
    payload: {
      clipId,
      edge,
      newTime: edge === "left" ? prevStart : prevStart + prevDuration,
      oldState: {
        start: newStart,
        duration: newDuration,
        inPoint: newIn,
        outPoint: newOut,
      },
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: updatedClip,
      },
    },
    inverse,
  };
}

export function handleSetSpeed(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, speed } = command.payload as {
    clipId: string;
    speed: number;
  };

  const clip = state.clips[clipId];
  if (!clip) return null;
  if (clip.locked) {
    console.warn(`Operation rejected: clip "${clip.name}" is locked.`);
    return null;
  }

  const cleanSpeed = Math.max(0.1, Math.min(4.0, Number(speed) || 1.0));
  const oldSpeed = clip.speed ?? 1.0;
  const baseDuration = clip.baseDuration ?? clip.duration * oldSpeed;
  const newDuration = baseDuration / cleanSpeed;

  const updatedClip: ClipModel = {
    ...clip,
    speed: cleanSpeed,
    baseDuration,
    duration: newDuration,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "SET_SPEED",
    payload: {
      clipId,
      speed: oldSpeed,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: updatedClip,
      },
    },
    inverse,
  };
}

export function handleReverseClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId } = command.payload as { clipId: string };
  const clip = state.clips[clipId];
  if (!clip) return null;
  if (clip.locked) {
    console.warn(`Operation rejected: clip "${clip.name}" is locked.`);
    return null;
  }

  const newReverse = !clip.reverse;
  const updatedClip: ClipModel = {
    ...clip,
    reverse: newReverse,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "REVERSE_CLIP",
    payload: { clipId },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: updatedClip,
      },
    },
    inverse,
  };
}

export function handleFreezeClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, freezeAt, freezeDuration = 2.0, freezeClipId, rightClipId } =
    command.payload as {
      clipId: string;
      freezeAt: number;
      freezeDuration?: number;
      freezeClipId: string;
      rightClipId: string;
    };

  const clip = state.clips[clipId];
  if (!clip) return null;
  if (clip.locked) {
    console.warn(`Operation rejected: clip "${clip.name}" is locked.`);
    return null;
  }

  const track = state.tracks.find((t) => t.id === clip.trackId);
  if (!track || track.locked) return null;

  if (freezeAt <= clip.start || freezeAt >= clip.start + clip.duration) {
    console.warn("Freeze position must be within clip duration.");
    return null;
  }

  const leftDuration = freezeAt - clip.start;
  const rightDuration = clip.duration - leftDuration;
  const inPoint = clip.inPoint ?? 0;
  const outPoint = clip.outPoint ?? (inPoint + clip.duration);
  const baseDuration = clip.baseDuration ?? outPoint;
  const rawThumbnails = clip.rawThumbnails ?? clip.thumbnails;
  const speed = clip.speed ?? 1.0;
  const freezeOffset = inPoint + leftDuration * speed;

  const leftClip: ClipModel = {
    ...clip,
    duration: leftDuration,
    inPoint,
    outPoint: freezeOffset,
    baseDuration,
    rawThumbnails,
  };

  const freezeClip: ClipModel = {
    ...clip,
    id: freezeClipId,
    name: `${clip.name} (Freeze)`,
    start: freezeAt,
    duration: freezeDuration,
    isFrozen: true,
    freezeTime: freezeOffset,
    inPoint: freezeOffset,
    outPoint: freezeOffset,
    baseDuration,
    rawThumbnails,
    color: "#283e50",
  };

  const rightClip: ClipModel = {
    ...clip,
    id: rightClipId,
    name: `${clip.name} (Part 2)`,
    start: freezeAt + freezeDuration,
    duration: rightDuration,
    inPoint: freezeOffset,
    outPoint,
    baseDuration,
    rawThumbnails,
  };

  const clipIndex = track.clipIds.indexOf(clipId);
  const subsequentClipIds = track.clipIds.slice(clipIndex + 1);
  const shiftedClips: Record<string, ClipModel> = {};
  for (const id of subsequentClipIds) {
    const c = state.clips[id];
    if (c) {
      shiftedClips[id] = {
        ...c,
        start: c.start + freezeDuration,
      };
    }
  }

  const newClipIds = [...track.clipIds];
  newClipIds.splice(clipIndex + 1, 0, freezeClipId, rightClipId);

  const updatedTracks = state.tracks.map((t) =>
    t.id === track.id ? { ...t, clipIds: newClipIds } : t
  );

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "RESTORE_FREEZE_CLIPS",
    payload: {
      originalClipId: clipId,
      freezeClipId,
      rightClipId,
      originalClip: clip,
      trackId: track.id,
      freezeDuration,
      subsequentClipIds,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        ...shiftedClips,
        [clipId]: leftClip,
        [freezeClipId]: freezeClip,
        [rightClipId]: rightClip,
      },
      tracks: updatedTracks,
      selectedClipId: freezeClipId,
      duration: (state.duration || 0) + freezeDuration,
    },
    inverse,
  };
}

export function handleRestoreFreezeClips(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice> } | null {
  const {
    originalClipId,
    freezeClipId,
    rightClipId,
    originalClip,
    trackId,
    freezeDuration = 0,
    subsequentClipIds = [],
  } = command.payload as {
    originalClipId: string;
    freezeClipId: string;
    rightClipId: string;
    originalClip: ClipModel;
    trackId: string;
    freezeDuration?: number;
    subsequentClipIds?: string[];
  };

  const newClips = { ...state.clips };
  delete newClips[freezeClipId];
  delete newClips[rightClipId];
  newClips[originalClipId] = originalClip;

  for (const id of subsequentClipIds) {
    const c = newClips[id];
    if (c) {
      newClips[id] = {
        ...c,
        start: c.start - freezeDuration,
      };
    }
  }

  const updatedTracks = state.tracks.map((t) => {
    if (t.id === trackId) {
      return {
        ...t,
        clipIds: t.clipIds.filter(
          (id) => id !== freezeClipId && id !== rightClipId
        ),
      };
    }
    return t;
  });

  return {
    newState: {
      clips: newClips,
      tracks: updatedTracks,
      selectedClipId: originalClipId,
      duration: Math.max(1.0, (state.duration || 0) - freezeDuration),
    },
  };
}
