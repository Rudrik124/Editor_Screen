import { useEditorStore } from "../../store/editor.store";
import { selectActiveClipAtCurrentTime } from "../../store/store.selectors";
import { createLockCommand, createUnlockCommand } from "./lock.command";

export const LockProcessor = {
  toggleLockSelectedClip: (): boolean => {
    const state = useEditorStore.getState();
    const clip = selectActiveClipAtCurrentTime(state);
    if (!clip) return false;

    const command = clip.locked
      ? createUnlockCommand(clip.id)
      : createLockCommand(clip.id);

    return state.dispatch(command);
  },


  setClipLock: (clipId: string, locked: boolean): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip) return false;

    const command = locked
      ? createLockCommand(clipId)
      : createUnlockCommand(clipId);

    return state.dispatch(command);
  },
};
