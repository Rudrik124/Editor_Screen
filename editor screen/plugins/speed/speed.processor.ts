import { useEditorStore } from "../../store/editor.store";
import { selectToolbarClip } from "../../store/store.selectors";
import { createSetSpeedCommand } from "./speed.command";

export const SpeedProcessor = {
  setClipSpeed: (clipId: string, speed: number): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const command = createSetSpeedCommand(clipId, speed);
    return state.dispatch(command);
  },

  setSelectedClipSpeed: (speed: number): boolean => {
    const state = useEditorStore.getState();
    const clip = selectToolbarClip(state);
    if (!clip) return false;

    return SpeedProcessor.setClipSpeed(clip.id, speed);
  },
};
