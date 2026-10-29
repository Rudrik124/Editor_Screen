import { describe, expect, it } from "vitest";
import { getAudioPlaybackRate, getAudioSourceRange } from "./audioTimeline";
import type { ClipModel } from "../types/editor.types";

describe("audio timeline stretching", () => {
  const clip: ClipModel = {
    id: "audio-clip",
    trackId: "audio",
    name: "Music",
    type: "audio",
    start: 0,
    duration: 10,
    inPoint: 0,
    outPoint: 10,
    baseDuration: 10,
  };

  it("calculates a slower playback rate when the timeline clip is extended", () => {
    expect(getAudioPlaybackRate({ ...clip, duration: 20 })).toBe(0.5);
  });

  it("keeps the original source range when its timeline duration is extended", () => {
    expect(getAudioSourceRange({ ...clip, duration: 20 })).toEqual({
      start: 0,
      end: 10,
      duration: 10,
    });
  });
});
