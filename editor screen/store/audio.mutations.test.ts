import { describe, expect, it } from "vitest";
import { handleSetAudioVolume, handleMuteClip, handleMuteTrack, handleExtractAudio } from "./audio.mutations";
import type { TimelineStateSlice } from "./clip.mutations";
import { useEditorStore } from "./editor.store";

describe("audio state mutations", () => {
  const baseState: TimelineStateSlice = {
    tracks: [
      { id: "video-track", label: "Video", type: "video", clipIds: ["video-1"], locked: false, muted: false },
      { id: "audio-track", label: "Audio", type: "audio", clipIds: [], locked: false, muted: false },
    ],
    clips: {
      "video-1": {
        id: "video-1",
        trackId: "video-track",
        type: "video",
        name: "Intro Clip",
        start: 0,
        duration: 5,
        locked: false,
        muted: false,
        volume: 1,
        color: "#22c55e",
        assetId: "asset-1",
        mediaUrl: "/video.mp4",
      },
    },
    selectedClipId: "video-1",
    duration: 20,
  };

  it("updates clip volume within bounds and provides inverse", () => {
    const result = handleSetAudioVolume(baseState, {
      id: "cmd-volume",
      type: "SET_AUDIO_VOLUME",
      payload: { clipId: "video-1", volume: 0.72 },
      timestamp: Date.now(),
    });

    expect(result).not.toBeNull();
    expect(result?.newState.clips?.["video-1"]).toMatchObject({ volume: 0.72 });
    expect(result?.inverse?.payload).toMatchObject({ volume: 1 });
  });

  it("mutes and unmutes a clip through the command payload", () => {
    const result = handleMuteClip(baseState, {
      id: "cmd-mute",
      type: "MUTE_CLIP",
      payload: { clipId: "video-1", muted: true },
      timestamp: Date.now(),
    });

    expect(result).not.toBeNull();
    expect(result?.newState.clips?.["video-1"]).toMatchObject({ muted: true });
    expect(result?.inverse?.payload).toMatchObject({ muted: false });
  });

  it("mutes and unmutes a track through the command payload", () => {
    const result = handleMuteTrack(baseState, {
      id: "cmd-track-mute",
      type: "MUTE_TRACK",
      payload: { trackId: "audio-track", muted: true },
      timestamp: Date.now(),
    });

    expect(result).not.toBeNull();
    expect(result?.newState.tracks?.[1]).toMatchObject({ muted: true });
    expect(result?.inverse?.payload).toMatchObject({ trackId: "audio-track", muted: false });
  });

  it("extracts audio into a dedicated audio track clip", () => {
    const result = handleExtractAudio(baseState, {
      id: "cmd-extract",
      type: "EXTRACT_AUDIO",
      payload: { clipId: "video-1", newClipId: "audio-1" },
      timestamp: Date.now(),
    });

    expect(result).not.toBeNull();
    expect(result?.newState.clips?.["audio-1"]).toMatchObject({
      type: "audio",
      trackId: "audio-track",
      muted: false,
    });
    expect(result?.newState.clips?.["video-1"]).toMatchObject({ muted: true });
    expect(result?.newState.tracks?.[1]).toMatchObject({ clipIds: ["audio-1"] });
  });

  it("only increments the playback seek revision for intentional seeks", () => {
    const store = useEditorStore.getState();
    const initialRevision = store.seekRevision;

    store.setCurrentTime(1, false);
    expect(useEditorStore.getState().seekRevision).toBe(initialRevision);

    useEditorStore.getState().setCurrentTime(2);
    expect(useEditorStore.getState().seekRevision).toBe(initialRevision + 1);
  });
});
