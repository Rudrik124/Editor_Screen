import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";
import { createDeleteCommand } from "./delete.command";

export const DeleteProcessor = {
  deleteSelectedClip: (): boolean => {
    const state = useEditorStore.getState();
    const clip = selectActiveClipAtCurrentTime(state);
    if (!clip || clip.locked) return false;

    const command = createDeleteCommand(clip.id, clip.trackId);
    return state.dispatch(command);
  },

  deleteClip: (clipId: string): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const command = createDeleteCommand(clipId, clip.trackId);
    return state.dispatch(command);
  },
};
