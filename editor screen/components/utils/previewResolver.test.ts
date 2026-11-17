import { describe, expect, it } from "vitest";
import { computeSourceTime, syncVideoElement } from "./previewResolver";
import { vi } from "vitest";
import { ClipModel } from "../../types/editor.types";

describe("source timing", () => {
  const clip = { start: 0, duration: 5, speed: 2, inPoint: 1, outPoint: 11 } as ClipModel;
  it("keeps advancing through the complete sped-up source range", () => {
    expect(computeSourceTime(clip, 4)).toBe(9);
    expect(computeSourceTime(clip, 5)).toBe(11);
  });
  it("uses the same source range in reverse and transitions", () => {
    expect(computeSourceTime({ ...clip, reverse: true }, 4)).toBe(3);
    expect(computeSourceTime(clip, 14, 10)).toBe(9);
  });
});

it("replaces stale metadata intent and avoids seeks during steady playback", () => {
  const listeners = new Set<() => void>();
  const video = {
    src: "", currentTime: 0, duration: 10, readyState: 0, seeking: false, playbackRate: 1,
    play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(),
    addEventListener: (_: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_: string, callback: () => void) => listeners.delete(callback),
  };
  syncVideoElement(video as unknown as HTMLVideoElement, "source.mp4", 4, true, 2);
  syncVideoElement(video as unknown as HTMLVideoElement, "source.mp4", 2, false, 2);
  for (const listener of listeners) listener();
  expect(video.play).not.toHaveBeenCalled();
  expect(video.currentTime).toBe(2);
  video.readyState = 2;
  video.currentTime = 2.1;
  syncVideoElement(video as unknown as HTMLVideoElement, "source.mp4", 2.15, true, 2);
  expect(video.currentTime).toBe(2.1);
  expect(video.playbackRate).toBe(2);
});
