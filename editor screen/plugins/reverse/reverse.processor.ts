import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";
import { createReverseCommand } from "./reverse.command";

export const ReverseProcessor = {
  toggleReverseClip: (clipId: string): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const command = createReverseCommand(clipId);
    return state.dispatch(command);
  },

  toggleReverseSelectedClip: (): boolean => {
    const state = useEditorStore.getState();
    const clip = selectActiveClipAtCurrentTime(state);
    if (!clip) return false;

    return ReverseProcessor.toggleReverseClip(clip.id);
  },
};
