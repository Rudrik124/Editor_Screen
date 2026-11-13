import { describe, it, expect } from "vitest";
import { formatSrtTimestamp, generateSrtContent, CaptionProcessor } from "./caption.processor";
import { executeCommandMutation } from "../../store/command.executor";
import { ClipModel, TrackModel } from "../../types/editor.types";

describe("Feature #20 — Caption (Auto-Transcribe) Pipeline", () => {
  it("formats SRT timestamps with exact zero padding and millisecond precision", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(1.5)).toBe("00:00:01,500");
    expect(formatSrtTimestamp(65.123)).toBe("00:01:05,123");
    expect(formatSrtTimestamp(3661.05)).toBe("01:01:01,050");
  });

  it("generates standard SubRip (.srt) subtitle string from caption items", () => {
    const captions = [
      { id: "cap-1", text: "Welcome to Veytrix", startTime: 1.0, endTime: 3.5 },
      { id: "cap-2", text: "Auto-caption feature", startTime: 3.8, endTime: 5.2 },
    ];
    const srt = generateSrtContent(captions);
    expect(srt).toContain("1\n00:00:01,000 --> 00:00:03,500\nWelcome to Veytrix");
    expect(srt).toContain("2\n00:00:03,800 --> 00:00:05,200\nAuto-caption feature");
  });

  it("executes ADD_CAPTION mutation to auto-create text track clips with text_data", () => {
    const videoClip: ClipModel = {
      id: "video-1",
      trackId: "video",
      name: "Main Video",
      type: "video",
      start: 0,
      duration: 10,
    };
    const videoTrack: TrackModel = { id: "video", label: "Video", type: "video", clipIds: ["video-1"] };
    const state = {
      tracks: [videoTrack],
      clips: { "video-1": videoClip },
      selectedClipId: "video-1",
      duration: 10,
    };

    const captions = [
      { id: "cap-item-1", text: "Hello World", startTime: 0.5, endTime: 2.5 },
      { id: "cap-item-2", text: "Next line of speech", startTime: 3.0, endTime: 5.0 },
    ];

    const result = executeCommandMutation(state, {
      id: "cmd-add-cap-1",
      type: "ADD_CAPTION",
      payload: {
        clipId: "video-1",
        captions,
      },
      timestamp: Date.now(),
    });

    expect(result).not.toBeNull();
    const newState = result!.newState;

    // 1. Text track auto-created
    const textTrack = newState.tracks?.find((t) => t.id === "text");
    expect(textTrack).toBeDefined();
    expect(textTrack?.clipIds).toHaveLength(2);

    // 2. Each caption word group becomes a ClipModel with text_data and timed start_time/end_time
    const cap1 = newState.clips?.["cap-item-1"];
    expect(cap1).toBeDefined();
    expect(cap1?.type).toBe("text");
    expect(cap1?.text_data?.text).toBe("Hello World");
    expect(cap1?.start).toBe(0.5);
    expect(cap1?.duration).toBe(2.0);
    expect(cap1?.start_time).toBe(0.5);
    expect(cap1?.end_time).toBe(2.5);

    // 3. Captions attached to source video clip
    expect(newState.clips?.["video-1"].captions).toHaveLength(2);

    // 4. Inverse undo command generated
    expect(result?.inverse?.type).toBe("REMOVE_CAPTION");
  });

  it("executes UPDATE_CAPTION mutation to edit text and retime timestamps", () => {
    const captionClip: ClipModel = {
      id: "cap-1",
      trackId: "text",
      name: "Original text",
      content: "Original text",
      text_data: { text: "Original text" },
      type: "text",
      start: 1.0,
      duration: 2.0,
    };
    const videoClip: ClipModel = {
      id: "video-1",
      trackId: "video",
      name: "Main Video",
      type: "video",
      start: 0,
      duration: 10,
      captions: [{ id: "cap-1", text: "Original text", startTime: 1.0, endTime: 3.0 }],
    };
    const state = {
      tracks: [
        { id: "video", label: "Video", type: "video" as const, clipIds: ["video-1"] },
        { id: "text", label: "Text", type: "text" as const, clipIds: ["cap-1"] },
      ],
      clips: { "video-1": videoClip, "cap-1": captionClip },
      selectedClipId: "video-1",
      duration: 10,
    };

    const result = executeCommandMutation(state, {
      id: "cmd-upd-cap-1",
      type: "UPDATE_CAPTION",
      payload: {
        clipId: "video-1",
        captionId: "cap-1",
        updates: {
          text: "Edited subtitle text",
          startTime: 1.5,
          endTime: 4.0,
        },
      },
      timestamp: Date.now(),
    });

    expect(result).not.toBeNull();
    const updatedClip = result!.newState.clips?.["cap-1"];
    expect(updatedClip?.name).toBe("Edited subtitle text");
    expect(updatedClip?.start).toBe(1.5);
    expect(updatedClip?.duration).toBe(2.5);
    expect(updatedClip?.text_data?.text).toBe("Edited subtitle text");

    const updatedSource = result!.newState.clips?.["video-1"];
    expect(updatedSource?.captions?.[0].text).toBe("Edited subtitle text");
  });

  it("handles AI Tool prompts matching caption and subtitle queries", async () => {
    // When no clip is present, AI tool reports clear error without crashing
    const res1 = await CaptionProcessor.executeAiTool("generate captions for the video");
    expect(res1.success).toBe(false); // No video clip loaded in test environment
    expect(res1.message).toContain("Select a video clip");

    const res2 = await CaptionProcessor.executeAiTool("add subtitles in English");
    expect(res2.success).toBe(false);
    expect(res2.message).toContain("Select a video clip");

    const resInvalid = await CaptionProcessor.executeAiTool("draw a blue cat");
    expect(resInvalid.success).toBe(false);
    expect(resInvalid.message).toBe("Unrecognized caption tool prompt.");
  });
});

