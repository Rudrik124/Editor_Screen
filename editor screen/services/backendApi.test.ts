import { afterEach, describe, expect, it, vi } from "vitest";
import { submitTimelineRender } from "./backendApi";

describe("render API errors", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("includes FastAPI validation locations in the export error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: [
              {
                loc: ["body", "clips", 0, "speed"],
                msg: "Input should be less than or equal to 100",
              },
            ],
          }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    await expect(
      submitTimelineRender("project", [], {}, {
        quality: "standard",
        resolution: { width: 1920, height: 1080 },
        fps: 30,
      })
    ).rejects.toThrow(
      "clips[0].speed: Input should be less than or equal to 100 (HTTP 422)."
    );
  });
});
