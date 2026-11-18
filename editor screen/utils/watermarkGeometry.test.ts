import { expect, it } from "vitest";
import { DEFAULT_WATERMARK, fitWatermarkToFrame, restoreWatermark } from "./watermarkGeometry";

it.each([16 / 9, 9 / 16, 1])("fits the official square logo at aspect ratio %s", (aspectRatio) => {
  const frame = fitWatermarkToFrame(DEFAULT_WATERMARK, aspectRatio, 1);
  expect(frame.width).toBe(0.15);
  expect(frame.height).toBeCloseTo(frame.width * aspectRatio);
  expect(frame.x + frame.width).toBeCloseTo(0.97);
  expect(frame.y + frame.height).toBeCloseTo(0.97);
});

it("fits a tall logo inside a landscape frame", () => {
  const frame = fitWatermarkToFrame({ x: 0, y: 1, width: 0.6 }, 16 / 9, 1 / 8);
  expect(frame.x).toBe(0.03);
  expect(frame.y).toBeCloseTo(0.03);
  expect(frame.y + frame.height).toBeCloseTo(0.97);
});

it("defaults old projects to the official logo and discards temporary URLs", () => {
  expect(restoreWatermark(undefined)).toEqual(DEFAULT_WATERMARK);
  expect(restoreWatermark({
    source: "custom",
    assetId: "logo",
    previewUrl: "blob:temporary",
    enabled: false,
    opacity: 0,
  })).toEqual({ ...DEFAULT_WATERMARK, enabled: false, opacity: 0 });
});
