import { useEditorStore } from "../../store/editor.store";
import { AspectRatio } from "../../types/editor.types";
import { createSetRatioCommand } from "./ratio.command";

export interface RatioPresetInfo {
  id: AspectRatio;
  label: string;
  width: number;
  height: number;
  cssRatio: string;
}

export const RATIO_PRESETS: RatioPresetInfo[] = [
  { id: "16:9", label: "16:9 (Landscape)", width: 1920, height: 1080, cssRatio: "16 / 9" },
  { id: "9:16", label: "9:16 (TikTok/Reels)", width: 1080, height: 1920, cssRatio: "9 / 16" },
  { id: "1:1", label: "1:1 (Square)", width: 1080, height: 1080, cssRatio: "1 / 1" },
  { id: "4:5", label: "4:5 (Portrait)", width: 1080, height: 1350, cssRatio: "4 / 5" },
  { id: "21:9", label: "21:9 (Ultrawide)", width: 2560, height: 1080, cssRatio: "21 / 9" },
];

export const RatioProcessor = {
  setRatio: (aspectRatio: AspectRatio): boolean => {
    const cmd = createSetRatioCommand(aspectRatio);
    return useEditorStore.getState().dispatch(cmd);
  },

  getDimensions: (aspectRatio: AspectRatio): { width: number; height: number } => {
    const preset = RATIO_PRESETS.find((p) => p.id === aspectRatio) || RATIO_PRESETS[0];
    return { width: preset.width, height: preset.height };
  },

  getCssRatio: (aspectRatio: AspectRatio): string => {
    const preset = RATIO_PRESETS.find((p) => p.id === aspectRatio) || RATIO_PRESETS[0];
    return preset.cssRatio;
  },
};
