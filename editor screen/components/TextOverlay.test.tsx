// @vitest-environment jsdom
import { act } from "react";
import { createRoot, Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TextOverlay } from "./TextOverlay";
import { useLocalProject } from "../hooks/useLocalProject";
import { useEditorStore } from "../store/editor.store";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); localStorage.clear(); });

it("drags text with one commit, preserves grab offset, and supports keyboard movement", () => {
  const update = vi.fn();
  act(() => root.render(<TextOverlay element={{ id: "t", content: "Glow", fontSize: 32, color: "#00ffff", bold: false, italic: false, alignment: "center", x: 50, y: 50, start: 0, duration: 3, neon: true }}
    selected={true} locked={false} canvasWidth={1280} onSelect={() => {}} onUpdate={update} />));
  const element = container.firstElementChild as HTMLDivElement;
  Object.defineProperties(container, { clientWidth: { value: 500 }, clientHeight: { value: 300 } });
  Object.defineProperties(element, { offsetWidth: { value: 100 }, offsetHeight: { value: 50 } });
  element.setPointerCapture = vi.fn(); element.releasePointerCapture = vi.fn();
  act(() => element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 200, clientY: 100 })));
  act(() => element.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 280, clientY: 150 })));
  expect(update).not.toHaveBeenCalled();
  act(() => element.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })));
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith("t", { x: 70, y: 70 });
  expect(element.style.textShadow).toContain("24px");
  act(() => element.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
  expect(update).toHaveBeenLastCalledWith("t", { x: 51, y: 50 });
});

it("restores persisted text styling and placement after remount", () => {
  function Project() { return <span>{useLocalProject()}</span>; }
  act(() => root.render(<Project />));
  act(() => useEditorStore.setState({ tracks: [{ id: "text", type: "text", label: "Text", clipIds: ["t"] }], clips: {
    t: { id: "t", type: "text", trackId: "text", name: "Title", start: 1, duration: 3, text_data: { text: "Hello", x: 80, y: 20, preset: "neon" } },
  } }));
  expect(container.textContent).toBe("Saved locally");
  act(() => root.unmount());
  useEditorStore.setState({ clips: {} });
  root = createRoot(container);
  act(() => root.render(<Project />));
  expect(useEditorStore.getState().clips.t.text_data).toMatchObject({ text: "Hello", x: 80, y: 20, preset: "neon" });
});
