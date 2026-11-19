// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { API_BASE } from "../services/backendApi";
import { useEditorStore } from "../store/editor.store";
import { ExportModal } from "./ExportModal";

it.each(["COMPLETED", "FAILED"] as const)(
  "offers a portrait 4K download only when the render reports completion (%s)",
  async (status) => {
    const mount = document.createElement("div");
    const root = createRoot(mount);
    const previousRatio = useEditorStore.getState().aspectRatio;
    const fetchExport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "portrait-job", status: "PENDING" }))
    );
    let emit: (data: object) => void = () => { throw new Error("Missing render socket"); };
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", fetchExport);
    vi.stubGlobal("WebSocket", class {
      onmessage?: (event: { data: string }) => void;
      constructor() {
        emit = (data) => this.onmessage?.({ data: JSON.stringify(data) });
      }
      close() {}
    });

    try {
      useEditorStore.setState({ aspectRatio: "9:16" });
      act(() => root.render(
        <ExportModal isOpen onClose={vi.fn()} onCustomizeWatermark={vi.fn()}
          watermarkUploading={false} canCustomizeWatermark={false}
          watermarkPermissionsError={null} onRefreshWatermarkPermissions={vi.fn()} />
      ));
      const click = (text: string) => {
        const button = [...mount.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
        expect(button).toBeDefined();
        button!.click();
      };
      act(() => click("4K"));
      expect(mount.querySelector("[aria-pressed=true]")?.textContent).toContain("2160 × 3840");
      act(() => click("60 FPS"));
      await act(async () => click("Start Export"));
      expect(fetchExport).toHaveBeenCalledWith(`${API_BASE}/render`, expect.any(Object));
      expect(JSON.parse(fetchExport.mock.calls[0][1].body)).toMatchObject({
        resolutionPreset: "4k", aspectRatio: "9:16", fps: 60,
      });

      act(() => emit({ status: "PROCESSING", progress: 99 }));
      expect(mount.querySelector("a[download]")).toBeNull();
      act(() => emit({
        status, progress: status === "COMPLETED" ? 100 : 99,
        error: "Export settings mismatch",
      }));
      const link = mount.querySelector("a[download]");
      if (status === "COMPLETED") {
        expect(link?.getAttribute("download")).toBe("veytrix_render_4k_export.mp4");
        expect(link?.getAttribute("href")).toBe(`${API_BASE}/render/jobs/portrait-job/download`);
      } else {
        expect(link).toBeNull();
        expect(mount.textContent).toContain("Export settings mismatch");
      }
    } finally {
      act(() => root.unmount());
      useEditorStore.setState({ aspectRatio: previousRatio });
      vi.unstubAllGlobals();
    }
  }
);
