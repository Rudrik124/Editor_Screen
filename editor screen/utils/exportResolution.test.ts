import { describe, expect, it } from "vitest";
import { getExportResolution } from "./exportResolution";

describe("export resolution", () => {
  it("keeps high-quality portrait exports within the backend limits", () => {
    expect(getExportResolution({ width: 1080, height: 1920 }, "high")).toEqual({
      width: 1214,
      height: 2160,
    });
  });

  it("preserves existing dimensions when they fit the selected quality", () => {
    expect(getExportResolution({ width: 1920, height: 1080 }, "high")).toEqual({
      width: 2880,
      height: 1620,
    });
    expect(getExportResolution({ width: 1080, height: 1920 }, "standard")).toEqual({
      width: 1080,
      height: 1920,
    });
  });
});
