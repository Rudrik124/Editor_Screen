import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";
import { createDuplicateCommand } from "./duplicate.command";

export const DuplicateProcessor = {
  duplicateSelectedClip: (): boolean => {
    const state = useEditorStore.getState();
    const clip = selectToolbarClip(state);
    if (!clip) return false;

    const command = createDuplicateCommand(clip.id);
    return state.dispatch(command);
  },

  duplicateClip: (clipId: string): boolean => {
    const state = useEditorStore.getState();
    const command = createDuplicateCommand(clipId);
    return state.dispatch(command);
  },
};
