import { EditorStoreState } from "./editor.store";
import { ClipModel, TrackModel } from "../types/editor.types";

export const selectTracks = (state: EditorStoreState): TrackModel[] =>
  state.tracks;

export const selectClips = (
  state: EditorStoreState
): Record<string, ClipModel> => state.clips;

export const selectSelectedClipId = (
  state: EditorStoreState
): string | null => state.selectedClipId;

export const selectSelectedClip = (
  state: EditorStoreState
): ClipModel | null => {
  if (!state.selectedClipId) return null;
  return state.clips[state.selectedClipId] || null;
};

export const selectSpeedClip = (
  state: EditorStoreState
): ClipModel | null => {
  const activeClip = selectActiveClipAtCurrentTime(state);
  if (activeClip?.type === "video") return activeClip;

  const selectedClip = selectSelectedClip(state);
  return selectedClip?.type === "video" ? selectedClip : null;
};

export const selectCanUndo = (state: EditorStoreState): boolean =>
  state.history.length > 0;

export const selectCanRedo = (state: EditorStoreState): boolean =>
  state.future.length > 0;

export const selectClipsForTrack = (
  state: EditorStoreState,
  trackId: string
): ClipModel[] => {
  const track = state.tracks.find((t) => t.id === trackId);
  if (!track) return [];
  return track.clipIds
    .map((id) => state.clips[id])
    .filter((clip): clip is ClipModel => Boolean(clip));
};

export const selectActiveClipAtCurrentTime = (
  state: EditorStoreState
): ClipModel | null => {
  // 1. If a clip is selected, prioritize it
  if (state.selectedClipId && state.clips[state.selectedClipId]) {
    const selected = state.clips[state.selectedClipId];
    if (
      state.currentTime >= selected.start &&
      state.currentTime <= selected.start + selected.duration
    ) {
      return selected;
    }
  }

  // 2. Otherwise find active clip on video track under currentTime
  const videoTrack = state.tracks.find((t) => t.id === "video" || t.type === "video");
  if (videoTrack) {
    for (const clipId of videoTrack.clipIds) {
      const clip = state.clips[clipId];
      if (
        clip &&
        state.currentTime >= clip.start &&
        state.currentTime <= clip.start + clip.duration
      ) {
        return clip;
      }
    }
  }

  // 3. Fallback to explicitly selected clip if any
  return selectSelectedClip(state);
};

export const selectToolbarClip = (
  state: EditorStoreState
): ClipModel | null => {
  return selectSelectedClip(state) || selectActiveClipAtCurrentTime(state);
};
