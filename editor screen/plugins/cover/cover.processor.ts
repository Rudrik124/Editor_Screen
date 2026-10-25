import { useEditorStore } from "../../store/editor.store";
import { createSetCoverCommand } from "./cover.command";

export const CoverProcessor = {
  setCoverFromCanvas: (canvas: HTMLCanvasElement | null, clipId?: string): boolean => {
    if (!canvas) return false;
    try {
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const cmd = createSetCoverCommand(dataUrl, clipId);
      return useEditorStore.getState().dispatch(cmd);
    } catch (e) {
      console.warn("Failed to capture cover from canvas:", e);
      return false;
    }
  },

  setCoverUrl: (coverUrl: string, clipId?: string): boolean => {
    const cmd = createSetCoverCommand(coverUrl, clipId);
    return useEditorStore.getState().dispatch(cmd);
  },
};
