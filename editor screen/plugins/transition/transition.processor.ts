import { useEditorStore } from "../../store/editor.store";
import { TransitionData } from "../../types/editor.types";
import { createAddTransitionCommand, createRemoveTransitionCommand } from "./transition.command";

export const TransitionProcessor = {
  addTransition: (clipId: string, transition: TransitionData): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const command = createAddTransitionCommand(clipId, transition);
    return state.dispatch(command);
  },

  removeTransition: (clipId: string): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked || !clip.transition) return false;

    const command = createRemoveTransitionCommand(clipId);
    return state.dispatch(command);
  },

  setDuration: (clipId: string, duration: number): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked || !clip.transition) return false;

    const updatedTransition: TransitionData = {
      ...clip.transition,
      duration: Math.max(0.1, Math.min(2.0, duration)),
    };

    const command = createAddTransitionCommand(clipId, updatedTransition);
    return state.dispatch(command);
  },
};
