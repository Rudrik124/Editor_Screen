import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "./editor.store";
import { ClipModel } from "../types/editor.types";

const clip: ClipModel = { id: "v", trackId: "video", type: "video", name: "Footage", start: 2, duration: 4,
  inPoint: 1, outPoint: 9, speed: 2, baseDuration: 20, effects: [{ type: "blur" }], filters: [{ type: "sepia" }] };
function dispatch(type: "SET_OVERLAP" | "TRIM_CLIP" | "SET_SPEED" | "UPDATE_TEXT", payload: Record<string, unknown>) {
  return useEditorStore.getState().dispatch({ id: crypto.randomUUID(), type, payload, timestamp: Date.now() });
}
beforeEach(() => useEditorStore.setState({
  tracks: [{ id: "video", type: "video", label: "Video", clipIds: ["v"] }, { id: "overlay-clip", type: "video", label: "PIP", clipIds: [] }, { id: "text", type: "text", label: "Text", clipIds: ["t"] }],
  clips: { v: { ...clip }, t: { id: "t", trackId: "text", type: "text", name: "Text", start: 0, duration: 3, text_data: { text: "Hello", x: 50, y: 50, preset: "neon" } } },
  history: [], future: [], duration: 6,
}));

describe("editor regression commands", () => {
  it("moves PIP back without losing effects, and undoes both moves", () => {
    expect(dispatch("SET_OVERLAP", { clipId: "v", trackId: "overlay-clip", scale: 0.4, positionX: 250 })).toBe(true);
    expect(dispatch("SET_OVERLAP", { clipId: "v", trackId: "video", scale: 1 })).toBe(true);
    expect(useEditorStore.getState().clips.v).toMatchObject({ trackId: "video", effects: clip.effects, filters: clip.filters });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().clips.v).toMatchObject({ trackId: "overlay-clip", scale: 0.4 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().clips.v).toMatchObject(clip);
  });
  it("supports targetTrackId alias 'overlay' and 'pip' with auto-applied defaults", () => {
    expect(dispatch("SET_OVERLAP", { clipId: "v", targetTrackId: "pip" })).toBe(true);
    expect(useEditorStore.getState().clips.v).toMatchObject({
      trackId: "overlay-clip",
      scale: 0.4,
      positionX: 250,
      positionY: -150
    });
    expect(useEditorStore.getState().tracks.find(t => t.id === "overlay-clip")?.clipIds).toContain("v");
  });
  it("rejects missing/locked destinations and overlapping video without changing state", () => {
    expect(dispatch("SET_OVERLAP", { clipId: "v", trackId: "missing" })).toBe(false);
    dispatch("SET_OVERLAP", { clipId: "v", trackId: "overlay-clip" });
    useEditorStore.setState(state => ({ clips: { ...state.clips, other: { ...clip, id: "other" } }, tracks: state.tracks.map(t => t.id === "video" ? { ...t, clipIds: ["other"] } : t) }));
    expect(dispatch("SET_OVERLAP", { clipId: "v", trackId: "video" })).toBe(false);
    expect(useEditorStore.getState().clips.v.trackId).toBe("overlay-clip");
  });
  it("preserves same-track membership", () => {
    dispatch("SET_OVERLAP", { clipId: "v", trackId: "video", scale: 1 });
    expect(useEditorStore.getState().tracks[0].clipIds).toEqual(["v"]);
  });
  it("changes speed within the retained range and restores it", () => {
    dispatch("SET_SPEED", { clipId: "v", speed: 4 });
    expect(useEditorStore.getState().clips.v).toMatchObject({ duration: 2, inPoint: 1, outPoint: 9 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().clips.v).toMatchObject(clip);
  });
  it.each(["left", "right"] as const)("trims reversed %s source range and restores exact range", edge => {
    useEditorStore.setState(state => ({ clips: { ...state.clips, v: { ...clip, reverse: true } } }));
    dispatch("TRIM_CLIP", { clipId: "v", edge, newTime: 4 });
    expect(useEditorStore.getState().clips.v).toMatchObject(edge === "left" ? { start: 4, duration: 2, inPoint: 1, outPoint: 5 } : { start: 2, duration: 2, inPoint: 5, outPoint: 9 });
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().clips.v).toMatchObject({ ...clip, reverse: true });
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().clips.v.duration).toBe(2);
  });
  it("updates text placement as one undoable command", () => {
    dispatch("UPDATE_TEXT", { clipId: "t", textData: { text: "Hello", x: 80, y: 20, preset: "neon" }, start: 0, duration: 3 });
    expect(useEditorStore.getState().history).toHaveLength(1);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().clips.t.text_data).toMatchObject({ x: 50, y: 50, preset: "neon" });
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().clips.t.text_data).toMatchObject({ x: 80, y: 20 });
  });
});
