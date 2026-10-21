import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";
import { createSplitCommand } from "./split.command";

export const SplitProcessor = {
  splitAtCurrentTime: (): boolean => {
    const state = useEditorStore.getState();
    const clip = selectActiveClipAtCurrentTime(state);
    if (!clip || clip.locked) return false;

    const splitTime = state.currentTime;
    if (splitTime <= clip.start || splitTime >= clip.start + clip.duration) {
      console.warn("Playhead must be within clip boundary to split.");
      return false;
    }

    const command = createSplitCommand(clip.id, splitTime);
    return state.dispatch(command);
  },


  splitClipAt: (clipId: string, time: number): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    if (time <= clip.start || time >= clip.start + clip.duration) {
      console.warn("Split time must be within clip boundary.");
      return false;
    }

    const command = createSplitCommand(clipId, time);
    return state.dispatch(command);
  },
};
