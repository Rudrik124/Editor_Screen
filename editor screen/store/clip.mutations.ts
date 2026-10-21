import { ClipModel, TrackModel } from "../types/editor.types";
import { EditorCommand } from "../types/command.types";

export interface TimelineStateSlice {
  tracks: TrackModel[];
  clips: Record<string, ClipModel>;
  selectedClipId: string | null;
  duration: number;
}

export function handleSplitClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, splitTime, newClipId } = command.payload as {
    clipId: string;
    splitTime: number;
    newClipId: string;
  };
  const clip = state.clips[clipId];
  if (!clip) return null;
  if (clip.locked) {
    console.warn(`Operation rejected: clip "${clip.name}" is locked.`);
    return null;
  }
  const track = state.tracks.find((t) => t.id === clip.trackId);
  if (!track || track.locked) {
    console.warn("Operation rejected: track is locked.");
    return null;
  }

  if (splitTime <= clip.start || splitTime >= clip.start + clip.duration) {
    console.warn("Operation rejected: split point out of clip bounds.");
    return null;
  }

  const leftDuration = splitTime - clip.start;
  const rightDuration = clip.duration - leftDuration;
  const originalDuration = clip.duration;

  const inPoint = clip.inPoint ?? 0;
  const outPoint = clip.outPoint ?? (inPoint + clip.duration);
  const baseDuration = clip.baseDuration ?? outPoint;
  const rawThumbnails = clip.rawThumbnails ?? clip.thumbnails;

  const updatedLeftClip: ClipModel = {
    ...clip,
    duration: leftDuration,
    inPoint: inPoint,
    outPoint: inPoint + leftDuration,
    baseDuration,
    rawThumbnails,
  };

  const newRightClip: ClipModel = {
    ...clip,
    id: newClipId,
    start: splitTime,
    duration: rightDuration,
    inPoint: inPoint + leftDuration,
    outPoint: outPoint,
    baseDuration,
    rawThumbnails,
    name: `${clip.name} (Part 2)`,
  };

  const clipIndex = track.clipIds.indexOf(clipId);
  const newClipIds = [...track.clipIds];
  newClipIds.splice(clipIndex + 1, 0, newClipId);

  const updatedTracks = state.tracks.map((t) =>
    t.id === track.id ? { ...t, clipIds: newClipIds } : t
  );

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "MERGE_CLIPS",
    payload: {
      originalClipId: clipId,
      mergedClipId: newClipId,
      originalDuration,
      trackId: track.id,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clipId]: updatedLeftClip,
        [newClipId]: newRightClip,
      },
      tracks: updatedTracks,
      selectedClipId: newClipId,
    },
    inverse,
  };
}

export function handleMergeClips(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const payload = command.payload as {
    originalClipId?: string;
    mergedClipId?: string;
    originalDuration?: number;
    trackId?: string;
    firstClipId?: string;
    secondClipId?: string;
  };

  const firstId = payload.firstClipId || payload.originalClipId;
  if (!firstId) return null;
  const firstClip = state.clips[firstId];
  if (!firstClip || firstClip.locked) return null;

  const targetTrackId = payload.trackId || firstClip.trackId;
  const track = state.tracks.find((t) => t.id === targetTrackId);
  if (!track || track.locked) return null;

  const firstIndex = track.clipIds.indexOf(firstId);
  const secondId =
    payload.secondClipId ||
    payload.mergedClipId ||
    (firstIndex >= 0 && firstIndex < track.clipIds.length - 1
      ? track.clipIds[firstIndex + 1]
      : null);
  if (!secondId) return null;

  const secondClip = state.clips[secondId];
  if (!secondClip || secondClip.locked) return null;

  const combinedDuration =
    payload.originalDuration ?? (firstClip.duration + secondClip.duration);
  const combinedOutPoint =
    secondClip.outPoint ?? (secondClip.inPoint ?? 0) + secondClip.duration;

  const mergedClip: ClipModel = {
    ...firstClip,
    duration: combinedDuration,
    outPoint: combinedOutPoint,
    name: firstClip.name.replace(/ \(Part \d+\)$/, ""),
  };

  const newClips = { ...state.clips };
  delete newClips[secondId];
  newClips[firstId] = mergedClip;

  const updatedTrackClipIds = track.clipIds.filter((id) => id !== secondId);
  const updatedTracks = state.tracks.map((t) =>
    t.id === targetTrackId ? { ...t, clipIds: updatedTrackClipIds } : t
  );

  return {
    newState: {
      clips: newClips,
      tracks: updatedTracks,
      selectedClipId: firstId,
    },
  };
}

export function handleDuplicateClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { originalClipId, newClipId } = command.payload as {
    originalClipId: string;
    newClipId: string;
  };
  const original = state.clips[originalClipId];
  if (!original) return null;
  const track = state.tracks.find((t) => t.id === original.trackId);
  if (!track || track.locked) {
    console.warn("Operation rejected: track is locked.");
    return null;
  }

  const duplicateClip: ClipModel = {
    ...original,
    id: newClipId,
    start: original.start + original.duration,
    name: `${original.name} (Copy)`,
    locked: false,
  };

  const clipIndex = track.clipIds.indexOf(originalClipId);
  const newClipIds = [...track.clipIds];
  newClipIds.splice(clipIndex + 1, 0, newClipId);

  const updatedTracks = state.tracks.map((t) =>
    t.id === track.id ? { ...t, clipIds: newClipIds } : t
  );

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "DELETE_CLIP",
    payload: {
      clipId: newClipId,
      trackId: track.id,
      clipSnapshot: duplicateClip,
      index: clipIndex + 1,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [newClipId]: duplicateClip,
      },
      tracks: updatedTracks,
      selectedClipId: newClipId,
    },
    inverse,
  };
}

export function handleDeleteClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, trackId } = command.payload as {
    clipId: string;
    trackId?: string;
  };
  const clip = state.clips[clipId];
  if (!clip) return null;
  if (clip.locked) {
    console.warn(`Operation rejected: clip "${clip.name}" is locked.`);
    return null;
  }

  const targetTrackId = trackId || clip.trackId;
  const track = state.tracks.find((t) => t.id === targetTrackId);
  if (!track || track.locked) {
    console.warn("Operation rejected: track is locked.");
    return null;
  }

  const index = track.clipIds.indexOf(clipId);
  const newClipIds = track.clipIds.filter((id) => id !== clipId);
  const newClips = { ...state.clips };
  delete newClips[clipId];

  // Ripple shift: on video tracks, pull subsequent clips forward to avoid blank holes
  if (track.type === "video") {
    const shiftAmount = clip.duration;
    for (const cid of newClipIds) {
      const c = newClips[cid];
      if (c && c.start >= clip.start) {
        newClips[cid] = {
          ...c,
          start: Math.max(0, c.start - shiftAmount),
        };
      }
    }
  }

  const updatedTracks = state.tracks.map((t) =>
    t.id === targetTrackId ? { ...t, clipIds: newClipIds } : t
  );

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "ADD_CLIP",
    payload: {
      clip,
      trackId: targetTrackId,
      index: index >= 0 ? index : 0,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: newClips,
      tracks: updatedTracks,
      selectedClipId:
        state.selectedClipId === clipId ? null : state.selectedClipId,
    },
    inverse,
  };
}

export function handleAddClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clip, trackId, index } = command.payload as {
    clip: ClipModel;
    trackId: string;
    index?: number;
  };
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track || track.locked) {
    console.warn("Operation rejected: track is locked.");
    return null;
  }

  const newClipIds = [...track.clipIds];
  if (typeof index === "number" && index >= 0) {
    newClipIds.splice(index, 0, clip.id);
  } else {
    newClipIds.push(clip.id);
  }

  const updatedTracks = state.tracks.map((t) =>
    t.id === trackId ? { ...t, clipIds: newClipIds } : t
  );

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "DELETE_CLIP",
    payload: {
      clipId: clip.id,
      trackId,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: {
        ...state.clips,
        [clip.id]: clip,
      },
      tracks: updatedTracks,
      selectedClipId: clip.id,
    },
    inverse,
  };
}
