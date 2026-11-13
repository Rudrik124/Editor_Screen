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

  it("packages textData for caption and text clips in export payload", async () => {
    let capturedBody: any = null;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url, init) => {
        capturedBody = JSON.parse(init.body);
        return Promise.resolve(
          new Response(JSON.stringify({ jobId: "job-123" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      })
    );

    const captionClip: any = {
      id: "cap-1",
      trackId: "text",
      name: "Sub test",
      type: "text",
      start: 1.0,
      duration: 2.5,
      text_data: {
        text: "Sub test",
        fontSize: 32,
        color: "#ffffff",
        x: 50,
        y: 85,
        alignment: "center",
      },
    };

    await submitTimelineRender("project", [], { "cap-1": captionClip }, {
      quality: "standard",
      resolution: { width: 1920, height: 1080 },
      fps: 30,
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody.clips).toHaveLength(1);
    expect(capturedBody.clips[0].textData).toEqual({
      content: "Sub test",
      fontSize: 32,
      color: "#ffffff",
      x: 50,
      y: 85,
      preset: "none",
      alignment: "center",
    });
  });
});
