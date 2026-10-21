import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";
import { createFreezeCommand } from "./freeze.command";

export const FreezeProcessor = {
  freezeAtCurrentTime: (duration = 2.0): boolean => {
    const state = useEditorStore.getState();
    const clip = selectActiveClipAtCurrentTime(state);
    if (!clip || clip.locked) return false;

    const freezeAt = state.currentTime;
    if (freezeAt <= clip.start || freezeAt >= clip.start + clip.duration) {
      console.warn("Playhead must be within clip boundary to freeze frame.");
      return false;
    }

    const command = createFreezeCommand(clip.id, freezeAt, duration);
    return state.dispatch(command);
  },


  freezeClipAt: (clipId: string, freezeAt: number, duration = 2.0): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const command = createFreezeCommand(clipId, freezeAt, duration);
    return state.dispatch(command);
  },
};
