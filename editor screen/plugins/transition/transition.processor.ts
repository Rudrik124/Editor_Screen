import { useEditorStore } from "../../store/editor.store";
import { TransitionData } from "../../types/editor.types";
import { createAddTransitionCommand, createRemoveTransitionCommand } from "./transition.command";

export const TransitionProcessor = {
  addTransition: (clipId: string, transition: TransitionData): boolean => {
    const state = useEditorStore.getState();
    let targetClipId = clipId;
    let clip = state.clips[clipId];

    if (!clip) {
      targetClipId = state.selectedClipId || Object.keys(state.clips)[0];
      clip = state.clips[targetClipId];
    }
    if (!clip || clip.locked) return false;

    // If the clip is the last clip on its track, the transition belongs to the preceding clip (at the cut)
    const track = state.tracks.find((t) => t.id === clip.trackId || t.clipIds.includes(targetClipId));
    if (track) {
      const idx = track.clipIds.indexOf(targetClipId);
      if (idx > 0 && idx === track.clipIds.length - 1) {
        targetClipId = track.clipIds[idx - 1];
        clip = state.clips[targetClipId] || clip;
      }
    }

    const command = createAddTransitionCommand(targetClipId, transition);
    return state.dispatch(command);
  },

  removeTransition: (clipId: string): boolean => {
    const state = useEditorStore.getState();
    let targetClipId = clipId;
    let clip = state.clips[clipId];
    if (!clip) return false;

    if (!clip.transition) {
      const track = state.tracks.find((t) => t.id === clip.trackId || t.clipIds.includes(clipId));
      if (track) {
        const idx = track.clipIds.indexOf(clipId);
        if (idx > 0 && state.clips[track.clipIds[idx - 1]]?.transition) {
          targetClipId = track.clipIds[idx - 1];
          clip = state.clips[targetClipId];
        }
      }
    }

    if (!clip || clip.locked || !clip.transition) return false;

    const command = createRemoveTransitionCommand(targetClipId);
    return state.dispatch(command);
  },

  setDuration: (clipId: string, duration: number): boolean => {
    const state = useEditorStore.getState();
    let targetClipId = clipId;
    let clip = state.clips[clipId];
    if (!clip) return false;

    if (!clip.transition) {
      const track = state.tracks.find((t) => t.id === clip.trackId || t.clipIds.includes(clipId));
      if (track) {
        const idx = track.clipIds.indexOf(clipId);
        if (idx > 0 && state.clips[track.clipIds[idx - 1]]?.transition) {
          targetClipId = track.clipIds[idx - 1];
          clip = state.clips[targetClipId];
        }
      }
    }

    if (!clip || clip.locked || !clip.transition) return false;

    const updatedTransition: TransitionData = {
      ...clip.transition,
      duration: Math.max(0.0, Math.min(2.0, duration)),
    };

    const command = createAddTransitionCommand(targetClipId, updatedTransition);
    return state.dispatch(command);
  },
};
