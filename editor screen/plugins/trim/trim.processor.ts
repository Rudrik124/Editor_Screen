import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";
import { createTrimCommand } from "./trim.command";

export const TrimProcessor = {
  trimClip: (clipId: string, edge: "left" | "right", newTime: number): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const command = createTrimCommand(clipId, edge, newTime);
    return state.dispatch(command);
  },

  trimSelectedClip: (edge: "left" | "right", newTime: number): boolean => {
    const state = useEditorStore.getState();
    const clip = selectToolbarClip(state);
    if (!clip || clip.locked) return false;

    return TrimProcessor.trimClip(clip.id, edge, newTime);
  },
};
