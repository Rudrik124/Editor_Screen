import { AspectRatio, ClipModel, KeyframeData, TransitionData } from "../types/editor.types";
import { EditorCommand } from "../types/command.types";
import { TimelineStateSlice } from "./clip.mutations";
import { useEditorStore } from "./editor.store";

export function handleAddTransition(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, transition } = command.payload as {
    clipId: string;
    transition: TransitionData;
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked) return null;

  const previousTransition = clip.transition;
  const updatedClip: ClipModel = {
    ...clip,
    transition,
  };

  const inverse: EditorCommand = previousTransition
    ? {
        id: `inv-${command.id}`,
        type: "ADD_TRANSITION",
        payload: { clipId, transition: previousTransition },
        timestamp: Date.now(),
      }
    : {
        id: `inv-${command.id}`,
        type: "REMOVE_TRANSITION",
        payload: { clipId },
        timestamp: Date.now(),
      };

  return {
    newState: {
      clips: { ...state.clips, [clipId]: updatedClip },
    },
    inverse,
  };
}

export function handleRemoveTransition(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId } = command.payload as { clipId: string };
  const clip = state.clips[clipId];
  if (!clip || clip.locked || !clip.transition) return null;

  const previousTransition = clip.transition;
  const updatedClip: ClipModel = {
    ...clip,
    transition: undefined,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "ADD_TRANSITION",
    payload: { clipId, transition: previousTransition },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: { ...state.clips, [clipId]: updatedClip },
    },
    inverse,
  };
}

export function handleSetOverlap(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, trackId, scale = 0.5, positionX = 0, positionY = 0 } = command.payload as {
    clipId: string;
    trackId: string;
    scale?: number;
    positionX?: number;
    positionY?: number;
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked) return null;

  const prevTrackId = clip.trackId;
  const prevScale = clip.scale ?? 1.0;
  const prevX = clip.positionX ?? 0;
  const prevY = clip.positionY ?? 0;

  // Move clip from old track to target track in tracks array
  const updatedTracks = state.tracks.map((t) => {
    if (t.id === prevTrackId) {
      return { ...t, clipIds: t.clipIds.filter((id) => id !== clipId) };
    }
    if (t.id === trackId && !t.clipIds.includes(clipId)) {
      return { ...t, clipIds: [...t.clipIds, clipId] };
    }
    return t;
  });

  const updatedClip: ClipModel = {
    ...clip,
    trackId,
    scale,
    positionX,
    positionY,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "SET_OVERLAP",
    payload: {
      clipId,
      trackId: prevTrackId,
      scale: prevScale,
      positionX: prevX,
      positionY: prevY,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      tracks: updatedTracks,
      clips: { ...state.clips, [clipId]: updatedClip },
    },
    inverse,
  };
}

export function handleSetClipTransform(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, scale, positionX, positionY, rotation, opacity } = command.payload as {
    clipId: string;
    scale?: number;
    positionX?: number;
    positionY?: number;
    rotation?: number;
    opacity?: number;
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked) return null;

  const prev = {
    scale: clip.scale ?? 1.0,
    positionX: clip.positionX ?? 0,
    positionY: clip.positionY ?? 0,
    rotation: clip.rotation ?? 0,
    opacity: clip.opacity ?? 1.0,
  };

  const updatedClip: ClipModel = {
    ...clip,
    scale: scale !== undefined ? scale : clip.scale,
    positionX: positionX !== undefined ? positionX : clip.positionX,
    positionY: positionY !== undefined ? positionY : clip.positionY,
    rotation: rotation !== undefined ? rotation : clip.rotation,
    opacity: opacity !== undefined ? opacity : clip.opacity,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "SET_CLIP_TRANSFORM",
    payload: {
      clipId,
      ...prev,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: { ...state.clips, [clipId]: updatedClip },
    },
    inverse,
  };
}

export function handleAddKeyframe(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, keyframe } = command.payload as {
    clipId: string;
    keyframe: KeyframeData;
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked) return null;

  const currentKeyframes = clip.keyframes || [];
  // Replace if exists at exact same timeOffset and property, else insert sorted
  const filtered = currentKeyframes.filter(
    (k) => !(k.property === keyframe.property && Math.abs(k.timeOffset - keyframe.timeOffset) < 0.01)
  );
  const updatedKeyframes = [...filtered, keyframe].sort((a, b) => a.timeOffset - b.timeOffset);

  const updatedClip: ClipModel = {
    ...clip,
    keyframes: updatedKeyframes,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "REMOVE_KEYFRAME",
    payload: { clipId, keyframeId: keyframe.id },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: { ...state.clips, [clipId]: updatedClip },
    },
    inverse,
  };
}

export function handleRemoveKeyframe(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, keyframeId } = command.payload as {
    clipId: string;
    keyframeId: string;
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked || !clip.keyframes) return null;

  const targetKf = clip.keyframes.find((k) => k.id === keyframeId);
  if (!targetKf) return null;

  const updatedKeyframes = clip.keyframes.filter((k) => k.id !== keyframeId);
  const updatedClip: ClipModel = {
    ...clip,
    keyframes: updatedKeyframes,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "ADD_KEYFRAME",
    payload: { clipId, keyframe: targetKf },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: { ...state.clips, [clipId]: updatedClip },
    },
    inverse,
  };
}

export function handleSetRatio(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { aspectRatio } = command.payload as { aspectRatio: AspectRatio };
  const currentRatio = useEditorStore.getState().aspectRatio;

  useEditorStore.getState().setAspectRatio(aspectRatio);

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "SET_RATIO",
    payload: { aspectRatio: currentRatio },
    timestamp: Date.now(),
  };

  return {
    newState: {},
    inverse,
  };
}

export function handleSetCover(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, coverUrl } = command.payload as {
    clipId?: string;
    coverUrl: string;
  };

  const previousCover = useEditorStore.getState().coverUrl;
  useEditorStore.getState().setCoverUrl(coverUrl);

  let updatedClips = state.clips;
  if (clipId && state.clips[clipId]) {
    const clip = state.clips[clipId];
    updatedClips = {
      ...state.clips,
      [clipId]: {
        ...clip,
        metadata: { ...(clip.metadata || {}), coverUrl },
      },
    };
  }

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "SET_COVER",
    payload: { clipId, coverUrl: previousCover || "" },
    timestamp: Date.now(),
  };

  return {
    newState: { clips: updatedClips },
    inverse,
  };
}

export function handleReplaceClip(
  state: TimelineStateSlice,
  command: EditorCommand
): { newState: Partial<TimelineStateSlice>; inverse?: EditorCommand } | null {
  const { clipId, newMediaUrl, newRenderMediaUrl, newAssetId, newName, newDuration, newThumbnails } = command.payload as {
    clipId: string;
    newMediaUrl: string;
    newRenderMediaUrl?: string;
    newAssetId?: string;
    newName?: string;
    newDuration?: number;
    newThumbnails?: string[];
  };

  const clip = state.clips[clipId];
  if (!clip || clip.locked) return null;

  const previous = {
    mediaUrl: clip.mediaUrl,
    renderMediaUrl: clip.renderMediaUrl,
    assetId: clip.assetId,
    name: clip.name,
    baseDuration: clip.baseDuration,
    thumbnails: clip.thumbnails,
  };

  const resolvedRenderMediaUrl =
    newRenderMediaUrl ??
    (newMediaUrl.startsWith("blob:") ? clip.renderMediaUrl : newMediaUrl);

  const updatedClip: ClipModel = {
    ...clip,
    mediaUrl: newMediaUrl,
    renderMediaUrl: resolvedRenderMediaUrl,
    assetId: newAssetId ?? clip.assetId,
    name: newName ?? clip.name,
    baseDuration: newDuration ?? clip.baseDuration,
    thumbnails: newThumbnails ?? clip.thumbnails,
  };

  const inverse: EditorCommand = {
    id: `inv-${command.id}`,
    type: "REPLACE_CLIP",
    payload: {
      clipId,
      newMediaUrl: previous.mediaUrl || "",
      newRenderMediaUrl: previous.renderMediaUrl,
      newAssetId: previous.assetId,
      newName: previous.name,
      newDuration: previous.baseDuration,
      newThumbnails: previous.thumbnails,
    },
    timestamp: Date.now(),
  };

  return {
    newState: {
      clips: { ...state.clips, [clipId]: updatedClip },
    },
    inverse,
  };
}
