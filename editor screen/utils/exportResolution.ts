import type { AspectRatio } from "../types/editor.types";

export const EXPORT_RESOLUTION_PRESETS = ["720p", "1080p", "4k"] as const;
export type ExportResolutionPreset = (typeof EXPORT_RESOLUTION_PRESETS)[number];

// Matches the backend's TimelineExportRequest resolution contract.
const EXPORT_DIMENSIONS: Record<AspectRatio, Record<ExportResolutionPreset, readonly [number, number]>> = {
  "16:9": { "720p": [1280, 720], "1080p": [1920, 1080], "4k": [3840, 2160] },
  "9:16": { "720p": [720, 1280], "1080p": [1080, 1920], "4k": [2160, 3840] },
  "1:1": { "720p": [720, 720], "1080p": [1080, 1080], "4k": [2160, 2160] },
  "4:5": { "720p": [576, 720], "1080p": [864, 1080], "4k": [1728, 2160] },
  "21:9": { "720p": [1680, 720], "1080p": [2520, 1080], "4k": [3840, 1646] },
};

export function getExportResolution(aspectRatio: AspectRatio, preset: ExportResolutionPreset) {
  const [width, height] = EXPORT_DIMENSIONS[aspectRatio][preset];
  return { width, height };
}
