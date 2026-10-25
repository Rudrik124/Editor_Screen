import { useEditorStore } from "../../store/editor.store";
import {
  createSetOverlapCommand,
  createSetClipTransformCommand,
  SetClipTransformPayload,
} from "./overlap.command";

export type PipPreset = "top-right" | "top-left" | "bottom-right" | "bottom-left" | "center" | "reset";

export const OverlapProcessor = {
  moveToOverlayTrack: (clipId: string): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    // Find or target overlay-clip track
    let overlayTrack = state.tracks.find((t) => t.id === "overlay-clip");
    if (!overlayTrack) {
      overlayTrack = state.tracks.find((t) => t.id.includes("overlay"));
    }
    const targetTrackId = overlayTrack ? overlayTrack.id : "overlay-clip";

    const cmd = createSetOverlapCommand({
      clipId,
      trackId: targetTrackId,
      scale: 0.4,
      positionX: 250,
      positionY: -150,
    });
    return state.dispatch(cmd);
  },

  setTransform: (payload: SetClipTransformPayload): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[payload.clipId];
    if (!clip || clip.locked) return false;

    const cmd = createSetClipTransformCommand(payload);
    return state.dispatch(cmd);
  },

  applyPipPreset: (clipId: string, preset: PipPreset): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    let scale = 0.35;
    let positionX = 0;
    let positionY = 0;

    switch (preset) {
      case "top-right":
        positionX = 260;
        positionY = -150;
        break;
      case "top-left":
        positionX = -260;
        positionY = -150;
        break;
      case "bottom-right":
        positionX = 260;
        positionY = 150;
        break;
      case "bottom-left":
        positionX = -260;
        positionY = 150;
        break;
      case "center":
        scale = 0.5;
        positionX = 0;
        positionY = 0;
        break;
      case "reset":
        scale = 1.0;
        positionX = 0;
        positionY = 0;
        break;
    }

    return OverlapProcessor.setTransform({
      clipId,
      scale,
      positionX,
      positionY,
    });
  },
};
