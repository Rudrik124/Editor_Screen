// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { VeytrixEditor } from "./VeytrixEditor";
import { useEditorStore } from "./store/editor.store";
import { getRenderCapabilities, uploadWatermarkAsset, type UploadedWatermarkResponse } from "./services/backendApi";

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
  uploadWatermarkAsset: vi.fn(),
  getRenderCapabilities: vi.fn().mockResolvedValue({ canCustomizeWatermark: true }),
}));

it("toggles playback after import and hands off export customization to the preview", async () => {
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

    const click = (button: HTMLElement) => act(() => button.click());
    const findButton = (label: string) => Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === label)!;
    const exportButton = container.querySelector<HTMLButtonElement>("#header-export-trigger")!;
    click(exportButton);
    const toggle = container.querySelector<HTMLInputElement>(".export-watermark-settings input")!;
    expect(toggle.checked).toBe(true);
    click(findButton("60 FPS"));
    click(toggle);
    expect(container.querySelector(".watermark-overlay")).toBeNull();
    click(findButton("Customize Watermark"));
    expect(container.querySelector(".export-modal-overlay")).toBeNull();
    const overlay = container.querySelector<HTMLDivElement>(".watermark-overlay.is-selected")!;
    expect(overlay.querySelector(".watermark-resize")).toBeTruthy();
    const watermarkButton = overlay.querySelector("button")!;
    act(() => watermarkButton.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(useEditorStore.getState().watermark.x).toBeCloseTo(0.81);

    vi.spyOn(overlay.parentElement!, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 800, 450));
    overlay.setPointerCapture = vi.fn();
    const pointer = (target: Element, type: string, clientX: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX });
      Object.defineProperty(event, "pointerId", { value: 1 });
      act(() => { target.dispatchEvent(event); });
    };
    pointer(watermarkButton, "pointerdown", 650);
    pointer(overlay, "pointermove", 570);
    expect(parseFloat(overlay.style.left)).toBeCloseTo(71);
    expect(useEditorStore.getState().watermark.x).toBeCloseTo(0.81);
    pointer(overlay, "pointerup", 570);
    expect(useEditorStore.getState().watermark.x).toBeCloseTo(0.71);

    pointer(overlay.querySelector(".watermark-resize")!, "pointerdown", 690);
    pointer(overlay, "pointermove", 730);
    expect(parseFloat(overlay.style.width)).toBeCloseTo(20);
    pointer(overlay, "pointerup", 730);
    expect(useEditorStore.getState().watermark.width).toBeCloseTo(0.2);

    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL() { return "blob:pending-logo"; }
      static revokeObjectURL = revokeObjectURL;
    });
    expect(overlay.querySelector("img")?.src).toMatch(/\/veytrix-watermark\.png$/);
    const logoInput = container.querySelector<HTMLInputElement>(".watermark-controls input[type=file]")!;
    Object.defineProperty(logoInput, "files", { value: [new File([], "logo.png", { type: "image/png" })] });
    vi.mocked(uploadWatermarkAsset).mockRejectedValueOnce(new Error("Invalid watermark"));
    await act(async () => { logoInput.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(useEditorStore.getState().watermark.source).toBe("official");
    expect(container.querySelector(".watermark-error")?.textContent).toBe("Invalid watermark");

    let finishUpload!: (response: UploadedWatermarkResponse) => void;
    vi.mocked(uploadWatermarkAsset).mockReturnValueOnce(new Promise((resolve) => { finishUpload = resolve; }));
    act(() => { logoInput.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(overlay.querySelector("img")?.src).toBe("blob:pending-logo");
    expect(useEditorStore.getState().watermark.source).toBe("official");
    click(exportButton);
    expect(findButton("Start Export").disabled).toBe(true);
    await act(async () => {
      finishUpload({ assetId: "custom-logo", previewUrl: "/uploads/logo.png", width: 100, height: 100 });
    });
    expect(useEditorStore.getState().watermark).toMatchObject({ source: "custom", assetId: "custom-logo" });
    expect(overlay.querySelector("img")?.src).toMatch(/\/uploads\/logo\.png$/);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:pending-logo");
    expect(findButton("Start Export").disabled).toBe(false);
    expect(findButton("60 FPS").classList.contains("active")).toBe(true);
    expect(container.querySelector<HTMLInputElement>(".export-watermark-settings input")?.checked).toBe(true);
    click(container.querySelector<HTMLButtonElement>(".export-modal-header .close-btn")!);
    vi.mocked(getRenderCapabilities).mockResolvedValueOnce({ canCustomizeWatermark: false });
    await act(async () => exportButton.click());
    expect(findButton("Customize Watermark").disabled).toBe(true);
    expect(container.querySelector<HTMLInputElement>(".export-watermark-settings input")?.disabled).toBe(true);
    expect(container.querySelector(".watermark-overlay.is-locked img")?.getAttribute("src"))
      .toMatch(/\/veytrix-watermark\.png$/);
    expect(useEditorStore.getState().watermark.source).toBe("custom");
  } finally {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    try { localStorage?.clear?.(); } catch {}
  }
});
