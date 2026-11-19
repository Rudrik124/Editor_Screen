import { describe, expect, it } from "vitest";
import type { AspectRatio } from "../types/editor.types";
import { EXPORT_RESOLUTION_PRESETS, getExportResolution } from "./exportResolution";

describe("getExportResolution", () => {
  it.each([
    ["16:9", [[1280, 720], [1920, 1080], [3840, 2160]]],
    ["9:16", [[720, 1280], [1080, 1920], [2160, 3840]]],
    ["1:1", [[720, 720], [1080, 1080], [2160, 2160]]],
    ["4:5", [[576, 720], [864, 1080], [1728, 2160]]],
    ["21:9", [[1680, 720], [2520, 1080], [3840, 1646]]],
  ] satisfies [AspectRatio, [number, number][]][])(
    "matches the API dimension contract for %s",
    (ratio, dimensions) => {
      expect(EXPORT_RESOLUTION_PRESETS.map((preset) => getExportResolution(ratio, preset))).toEqual(
        dimensions.map(([width, height]) => ({ width, height }))
      );
    }
  );
});
