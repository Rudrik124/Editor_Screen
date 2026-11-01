import { describe, it, expect } from "vitest";
import { evaluateClipEffectTransforms } from "./effect.interpolator";
import { FILTER_CATALOG, FILTER_INDEX_MAP } from "../plugins/filters/filters.catalog";
import { EFFECT_CATALOG } from "../plugins/effects/effects.catalog";
import { executeCommandMutation } from "../store/command.executor";
import { ClipModel, TrackModel } from "../types/editor.types";

describe("Phase 5.1 Effects & Filters Preview Pipeline", () => {
  it("defines all 20 categorized filters across 8 categories", () => {
    expect(FILTER_CATALOG).toHaveLength(20);
    const categories = new Set(FILTER_CATALOG.map((f) => f.category));
    expect(categories.size).toBe(8);

    expect(FILTER_INDEX_MAP["hollywood_gold"]).toBe(1);
    expect(FILTER_INDEX_MAP["comic_book"]).toBe(20);
  });

  it("defines all 20 effect animations", () => {
    expect(EFFECT_CATALOG).toHaveLength(20);
    const ids = EFFECT_CATALOG.map((e) => e.id);
    expect(ids).toContain("fade_in");
    expect(ids).toContain("zoom_bounce");
    expect(ids).toContain("wiggle");
    expect(ids).toContain("drop");
  });

  it("evaluates fade_in effect opacity correctly over time", () => {
    const base = { scale: 1, positionX: 0, positionY: 0, rotation: 0, opacity: 1 };
    const effects = [{ type: "fade_in", parameters: { duration: 1.0, startOpacity: 0.0, endOpacity: 1.0 } }];

    const atStart = evaluateClipEffectTransforms(effects, 0.0, 5.0, base);
    expect(atStart.opacity).toBeCloseTo(0.0, 2);

    const atEnd = evaluateClipEffectTransforms(effects, 1.0, 5.0, base);
    expect(atEnd.opacity).toBeCloseTo(1.0, 2);
  });

  it("evaluates physics drop and bounce displacement", () => {
    const base = { scale: 1, positionX: 0, positionY: 0, rotation: 0, opacity: 1 };
    const effects = [{ type: "drop", parameters: { distance: 200, speed: 2.0, bounce: 1.0 } }];

    const mid = evaluateClipEffectTransforms(effects, 0.5, 5.0, base);
    expect(mid.positionY).not.toBe(0);
  });

  it("evaluates continuous pulse oscillation", () => {
    const base = { scale: 1, positionX: 0, positionY: 0, rotation: 0, opacity: 1 };
    const effects = [{ type: "pulse", parameters: { intensity: 0.2, speed: 1.0 } }];

    const tQuarter = evaluateClipEffectTransforms(effects, 0.25, 5.0, base);
    expect(tQuarter.scale).toBeCloseTo(1.2, 2);
  });

  it("executes SET_FILTERS command without throwing reference errors", () => {
    const clip: ClipModel = {
      id: "clip-1",
      trackId: "video",
      name: "Test Clip",
      type: "video",
      start: 0,
      duration: 10,
    };
    const track: TrackModel = { id: "video", label: "Video", type: "video", clipIds: ["clip-1"] };
    const state = { tracks: [track], clips: { "clip-1": clip }, selectedClipId: "clip-1", duration: 10 };

    const result = executeCommandMutation(state, {
      id: "cmd-1",
      type: "SET_FILTERS",
      payload: { clipId: "clip-1", filters: [{ type: "hollywood_gold", intensity: 0.8 }] },
      timestamp: Date.now(),
    });

    expect(result).not.toBeNull();
    expect(result?.newState.clips?.["clip-1"].filters).toEqual([
      { type: "hollywood_gold", intensity: 0.8 },
    ]);
  });

  it("executes SET_EFFECTS command and supports inverse undo", () => {
    const clip: ClipModel = {
      id: "clip-1",
      trackId: "video",
      name: "Test Clip",
      type: "video",
      start: 0,
      duration: 10,
    };
    const track: TrackModel = { id: "video", label: "Video", type: "video", clipIds: ["clip-1"] };
    const state = { tracks: [track], clips: { "clip-1": clip }, selectedClipId: "clip-1", duration: 10 };

    const result = executeCommandMutation(state, {
      id: "cmd-2",
      type: "SET_EFFECTS",
      payload: { clipId: "clip-1", effects: [{ type: "spin", parameters: { speed: 2 } }] },
      timestamp: Date.now(),
    });

    expect(result).not.toBeNull();
    expect(result?.newState.clips?.["clip-1"].effects).toEqual([
      { type: "spin", parameters: { speed: 2 } },
    ]);
    expect(result?.inverse?.type).toBe("SET_EFFECTS");
  });
});
