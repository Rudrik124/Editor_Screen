import type { WatermarkGeometry, WatermarkSettings } from "../types/editor.types";

const inset = 0.03;
const minimumWidth = 0.03;
const maximumWidth = 0.6;

export const DEFAULT_WATERMARK: Readonly<WatermarkSettings> = {
  enabled: true,
  source: "official",
  x: 1,
  y: 1,
  width: 0.15,
  opacity: 0.85,
};

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

export function fitWatermarkToFrame(
  geometry: WatermarkGeometry,
  frameAspectRatio: number,
  logoAspectRatio: number,
): WatermarkGeometry & { height: number } {
  const heightPerWidth = frameAspectRatio / logoAspectRatio;
  const usableFraction = 1 - inset * 2;
  const maxWidth = Math.min(maximumWidth, usableFraction / heightPerWidth);
  const width = clamp(geometry.width, Math.min(minimumWidth, maxWidth), maxWidth);
  const height = width * heightPerWidth;

  return {
    x: clamp(geometry.x, inset, usableFraction + inset - width),
    y: clamp(geometry.y, inset, usableFraction + inset - height),
    width,
    height,
  };
}

function readFraction(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 1) : fallback;
}

export function restoreWatermark(value: unknown): WatermarkSettings {
  if (!value || typeof value !== "object") return { ...DEFAULT_WATERMARK };

  const saved = value as Record<string, unknown>;
  const geometry = {
    enabled: typeof saved.enabled === "boolean" ? saved.enabled : DEFAULT_WATERMARK.enabled,
    x: readFraction(saved.x, DEFAULT_WATERMARK.x),
    y: readFraction(saved.y, DEFAULT_WATERMARK.y),
    width: clamp(readFraction(saved.width, DEFAULT_WATERMARK.width), minimumWidth, maximumWidth),
    opacity: readFraction(saved.opacity, DEFAULT_WATERMARK.opacity),
  };

  if (
    saved.source === "custom" &&
    typeof saved.assetId === "string" && saved.assetId.trim() &&
    typeof saved.previewUrl === "string" && /^(?:\/(?!\/)|https?:\/\/)/i.test(saved.previewUrl)
  ) {
    return { ...geometry, source: "custom", assetId: saved.assetId, previewUrl: saved.previewUrl };
  }

  return { ...geometry, source: "official" };
}
