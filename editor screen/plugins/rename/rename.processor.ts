import { useEditorStore } from "../../store/editor.store";
import { createRenameCommand } from "./rename.command";

export const RenameProcessor = {
  renameClip: (clipId: string, newName: string): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const command = createRenameCommand(clipId, newName, clip.name);
    return state.dispatch(command);
  },

  renameSelectedClip: (newName: string): boolean => {
    const state = useEditorStore.getState();
    const clipId = state.selectedClipId;
    if (!clipId) return false;

    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const command = createRenameCommand(clipId, newName, clip.name);
    return state.dispatch(command);
  },
};
