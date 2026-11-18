// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { VeytrixEditor } from "./VeytrixEditor";
import { useEditorStore } from "./store/editor.store";

vi.mock("./renderer/audio.engine", () => ({
  AudioEngine: class {
    handleStateChange() {}
    async destroy() {}
  },
}));

vi.mock("./left-side toolbar/functionality/Video/functionality/createVideoAsset", () => ({
  createVideoAsset: async (file: File) => ({
    id: "uploaded-video",
    name: file.name,
    url: "blob:uploaded-video",
    duration: 10,
    thumbnails: [],
  }),
}));

vi.mock("./services/backendApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("./services/backendApi")>(),
  uploadAsset: async () => ({ mediaUrl: "/uploads/video.mp4" }),
}));

it("toggles playback with Space immediately after importing a video", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const pressSpace = (target: HTMLElement, repeat = false) => {
    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true, repeat });
    act(() => { target.dispatchEvent(event); });
    return event.defaultPrevented;
  };

  try {
    act(() => root.render(<VeytrixEditor />));
    const fileInput = container.querySelector<HTMLInputElement>(".media-file-input")!;
    Object.defineProperty(fileInput, "files", { value: [new File([], "video.mp4", { type: "video/mp4" })] });
    await act(async () => { fileInput.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(useEditorStore.getState().clips["video-uploaded-video"]).toMatchObject({
      mediaUrl: "blob:uploaded-video",
    });

    for (const isPlaying of [true, false, true]) {
      expect(pressSpace(fileInput)).toBe(true);
      expect(useEditorStore.getState().isPlaying).toBe(isPlaying);
      act(() => {
        container.querySelectorAll("video").forEach((video) => {
          video.dispatchEvent(new Event("loadedmetadata"));
        });
      });
    }
    expect(play).toHaveBeenCalled();

    const playButton = container.querySelector<HTMLButtonElement>("[data-playback-toggle]")!;
    playButton.focus();
    expect(pressSpace(playButton)).toBe(true);
    expect(useEditorStore.getState().isPlaying).toBe(false);
    expect(pressSpace(playButton, true)).toBe(true);
    expect(useEditorStore.getState().isPlaying).toBe(false);

    const textInput = document.createElement("input");
    const otherButton = document.createElement("button");
    container.append(textInput, otherButton);
    otherButton.focus();
    expect(pressSpace(otherButton)).toBe(true);
    expect(useEditorStore.getState().isPlaying).toBe(true);
    textInput.focus();
    expect(pressSpace(textInput)).toBe(false);
    expect(useEditorStore.getState().isPlaying).toBe(true);
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  }
});
