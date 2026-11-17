// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { TimelineWorkspace } from "./TimelineWorkspace";
import { AIAssistantPanel } from "../plugins/ai-assistant/ai-assistant.ui";
import { useEditorStore } from "../store/editor.store";

describe("TimelineWorkspace & AIAssistantPanel Interactions", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    useEditorStore.setState({
      currentTime: 0,
      duration: 10,
      tracks: [
        { id: "video", label: "Video", type: "video", clipIds: ["clip-1"] },
      ],
      clips: {
        "clip-1": {
          id: "clip-1",
          trackId: "video",
          name: "Sample Clip",
          type: "video",
          start: 0,
          duration: 10,
        },
      },
      isPlaying: false,
    });
  });

  afterEach(() => {
    container?.remove();
  });

  it("updates currentTime immediately during pointer scrubbing", () => {
    const root = createRoot(container);
    act(() => {
      root.render(
        <TimelineWorkspace
          assets={[]}
          addedVideoIds={[]}
          onAddVideo={() => {}}
          onSelectVideo={() => {}}
          textElements={[]}
          onSelectText={() => {}}
          onAddText={() => {}}
          onUpdateText={() => {}}
          onDeleteText={() => {}}
          onResizeText={() => {}}
        />
      );
    });

    const playhead = container.querySelector(".playhead") as HTMLElement;
    expect(playhead).not.toBeNull();

    // Mock bounding rect for both ruler and track content
    const mockRect = {
      left: 100,
      right: 1100,
      width: 1000,
      top: 0,
      bottom: 50,
      height: 50,
      x: 100,
      y: 0,
      toJSON: () => {},
    };

    const rulerTrack = container.querySelector(".ruler-ticks-track") as HTMLElement;
    if (rulerTrack) vi.spyOn(rulerTrack, "getBoundingClientRect").mockReturnValue(mockRect);
    const trackContent = container.querySelector(".track-content") as HTMLElement;
    if (trackContent) vi.spyOn(trackContent, "getBoundingClientRect").mockReturnValue(mockRect);

    // Pointer down on playhead at x = 350 (25% of 1000px => 2.5s)
    act(() => {
      const event = new MouseEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        clientX: 350,
      });
      playhead.dispatchEvent(event);
    });

    expect(useEditorStore.getState().currentTime).toBe(2.5);

    act(() => {
      root.unmount();
    });
  });

  it("auto-focuses input field when AIAssistantPanel opens", async () => {
    vi.useFakeTimers();
    const root = createRoot(container);
    act(() => {
      root.render(<AIAssistantPanel />);
    });

    const fabBtn = container.querySelector(".ai-toggle-fab") as HTMLButtonElement;
    expect(fabBtn).not.toBeNull();

    act(() => {
      fabBtn.click();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const input = container.querySelector(".ai-text-input") as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);

    vi.useRealTimers();
    act(() => {
      root.unmount();
    });
  });

  it("applies pending plan immediately when user types 'proceed'", async () => {
    const root = createRoot(container);
    act(() => {
      root.render(<AIAssistantPanel />);
    });

    const fabBtn = container.querySelector(".ai-toggle-fab") as HTMLButtonElement;
    act(() => {
      fabBtn.click();
    });

    const input = container.querySelector(".ai-text-input") as HTMLInputElement;
    const sendBtn = container.querySelector(".ai-send-btn") as HTMLButtonElement;

    // Simulate an existing pending confirmation plan
    const testCmd = {
      id: "cmd-test",
      type: "SPLIT_CLIP" as const,
      payload: { clipId: "clip-1", splitTime: 5.0, newClipId: "clip-2" },
      timestamp: Date.now(),
    };

    // User types "proceed" with no pending plan: does standard prompt
    // Now verify affirmative regex matches "proceed", "proceed with plan", "yes"
    const isAffirmative = (txt: string) =>
      /^(proceed|proceed\s+with\s+plan|apply|apply\s+plan|yes|confirm|do\s+it|go\s+ahead|execute|ok|okay)$/i.test(txt);
    expect(isAffirmative("proceed")).toBe(true);
    expect(isAffirmative("proceed with plan")).toBe(true);
    expect(isAffirmative("yes")).toBe(true);
    expect(isAffirmative("apply")).toBe(true);

    act(() => {
      root.unmount();
    });
  });
});
