import { useEditorStore } from "../../store/editor.store";
import { KeyframeData, KeyframeProperty } from "../../types/editor.types";
import { createAddKeyframeCommand, createRemoveKeyframeCommand } from "./keyframe.command";

export const KeyframeProcessor = {
  addKeyframe: (clipId: string, keyframe: KeyframeData): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const cmd = createAddKeyframeCommand(clipId, keyframe);
    return state.dispatch(cmd);
  },

  addKeyframeAtPlayhead: (
    clipId: string,
    property: KeyframeProperty,
    value: number,
    interpolation: "linear" | "easeIn" | "easeOut" | "easeInOut" = "linear"
  ): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const timeOffset = Math.max(0, Math.min(clip.duration, state.currentTime - clip.start));
    const keyframe: KeyframeData = {
      id: `kf-pt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timeOffset,
      property,
      value,
      interpolation,
    };

    return KeyframeProcessor.addKeyframe(clipId, keyframe);
  },

  removeKeyframe: (clipId: string, keyframeId: string): boolean => {
    const state = useEditorStore.getState();
    const clip = state.clips[clipId];
    if (!clip || clip.locked) return false;

    const cmd = createRemoveKeyframeCommand(clipId, keyframeId);
    return state.dispatch(cmd);
  },
};
