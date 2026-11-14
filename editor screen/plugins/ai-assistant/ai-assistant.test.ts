import { describe, it, expect } from "vitest";
import { getClipManifest, buildSystemPrompt } from "./ai-assistant.tools";

describe("Phase 6 — AI Assistant Tools & Prompts", () => {
  it("extracts clean manifest from clips", () => {
    const state = {
      duration: 12.0,
      currentTime: 3.5,
      aspectRatio: "16:9",
      selectedClipId: "clip-1",
      tracks: [],
      clips: {
        "clip-1": {
          id: "clip-1",
          trackId: "v1",
          name: "Intro Clip",
          type: "video" as const,
          start: 0,
          duration: 6,
          speed: 1.0,
          volume: 1.0,
          locked: false,
          muted: false,
        },
      },
    };

    const manifest = getClipManifest(state);
    expect(manifest).toHaveLength(1);
    expect(manifest[0].id).toBe("clip-1");
    expect(manifest[0].name).toBe("Intro Clip");
    expect(manifest[0].duration).toBe(6);
  });

  it("builds formatted system prompt with timeline state", () => {
    const state = {
      duration: 20.0,
      currentTime: 4.0,
      aspectRatio: "9:16",
      selectedClipId: "clip-2",
      tracks: [],
      clips: {},
    };

    const prompt = buildSystemPrompt(state);
    expect(prompt).toContain("Veytrix AI");
    expect(prompt).toContain("Duration: 20s");
    expect(prompt).toContain("Aspect Ratio: 9:16");
    expect(prompt).toContain("Selected Clip: clip-2");
  });
});
