export type ExportQuality = "draft" | "standard" | "high";

export interface ExportDimensions {
  width: number;
  height: number;
}

const MAX_EXPORT_WIDTH = 3840;
const MAX_EXPORT_HEIGHT = 2160;

export function getExportResolution(
  baseDimensions: ExportDimensions,
  quality: ExportQuality
): ExportDimensions {
  const scale = quality === "draft" ? 0.667 : quality === "high" ? 1.5 : 1;
  const width = Math.max(320, Math.round((baseDimensions.width * scale) / 2) * 2);
  const height = Math.max(240, Math.round((baseDimensions.height * scale) / 2) * 2);
  const limitScale = Math.min(
    1,
    MAX_EXPORT_WIDTH / width,
    MAX_EXPORT_HEIGHT / height
  );

  return {
    width: Math.floor((width * limitScale) / 2) * 2,
    height: Math.floor((height * limitScale) / 2) * 2,
  };
}
