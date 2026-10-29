import { describe, expect, it } from "vitest";
import { handleTrimClip } from "./phase2.mutations";
import type { TimelineStateSlice } from "./clip.mutations";
import { getAudioPlaybackRate } from "../utils/audioTimeline";

describe("audio clip trimming", () => {
  const state: TimelineStateSlice = {
    tracks: [
      { id: "audio", label: "Audio", type: "audio", clipIds: ["music"] },
      { id: "video", label: "Video", type: "video", clipIds: [] },
    ],
    clips: {
      music: {
        id: "music",
        trackId: "audio",
        name: "Music",
        type: "audio",
        start: 0,
        duration: 10,
        inPoint: 0,
        outPoint: 10,
        baseDuration: 10,
      },
    },
    selectedClipId: "music",
    duration: 10,
  };

  it("extends audio clips while preserving their pitch through a lower playback rate", () => {
    const result = handleTrimClip(state, {
      id: "trim-audio",
      type: "TRIM_CLIP",
      payload: { clipId: "music", edge: "right", newTime: 20 },
      timestamp: Date.now(),
    });
    const extendedClip = result?.newState.clips?.music;

    expect(extendedClip).toMatchObject({ duration: 20, outPoint: 10 });
    expect(getAudioPlaybackRate(extendedClip!)).toBe(0.5);
  });

  it("keeps video trim bounded by the media source", () => {
    const videoState: TimelineStateSlice = {
      ...state,
      tracks: [{ id: "video", label: "Video", type: "video", clipIds: ["footage"] }],
      clips: {
        footage: {
          ...state.clips.music,
          id: "footage",
          trackId: "video",
          type: "video",
        },
      },
    };
    const result = handleTrimClip(videoState, {
      id: "trim-video",
      type: "TRIM_CLIP",
      payload: { clipId: "footage", edge: "right", newTime: 20 },
      timestamp: Date.now(),
    });

    expect(result?.newState.clips?.footage).toMatchObject({
      duration: 10,
      outPoint: 10,
    });
  });
});
