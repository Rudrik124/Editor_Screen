// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { reverseKey, useReversePreviews } from "./reversePreview";
import { ClipModel } from "../types/editor.types";

const clip: ClipModel = { id: "v", type: "video", trackId: "video", name: "Test", start: 0, duration: 2, reverse: true,
  assetId: "legacy-client-id", renderMediaUrl: "/uploads/12345678-1234-1234-1234-123456789abc_source.mp4", inPoint: 1, outPoint: 5, speed: 2 };
afterEach(() => vi.unstubAllGlobals());

it("prepares by uploaded asset identity, caches a playable blob, and revokes it on unmount", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const create = vi.fn().mockReturnValue("blob:reverse");
  const revoke = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
  const fetchMock = vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith("/media")
    ? { ok: true, blob: () => Promise.resolve(new Blob(["video"])) }
    : { ok: true, json: () => Promise.resolve({ id: "job", status: "Completed", progress: 100 }) }));
  vi.stubGlobal("fetch", fetchMock);
  const container = document.createElement("div");
  const root = createRoot(container);
  function Preview() { const { previews } = useReversePreviews({ v: clip }); return <span>{previews[reverseKey(clip)]?.url}</span>; }
  await act(async () => root.render(<Preview />));
  expect(container.textContent).toBe("blob:reverse");
  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ assetId: "12345678-1234-1234-1234-123456789abc", start: 1, end: 5 });
  act(() => root.unmount());
  expect(revoke).toHaveBeenCalledWith("blob:reverse");
});

it("ignores a completed download after the reversed clip is removed", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const create = vi.fn();
  vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: vi.fn() });
  let finish!: (blob: Blob) => void;
  vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string) => Promise.resolve(url.endsWith("/media")
    ? { ok: true, blob: () => new Promise<Blob>(resolve => { finish = resolve; }) }
    : { ok: true, json: () => Promise.resolve({ id: "job", status: "Completed", progress: 100 }) })));
  const container = document.createElement("div"); const root = createRoot(container);
  function Preview({ clips }: { clips: Record<string, ClipModel> }) { useReversePreviews(clips); return null; }
  await act(async () => root.render(<Preview clips={{ v: clip }} />));
  await act(async () => root.render(<Preview clips={{}} />));
  await act(async () => finish(new Blob(["obsolete"])));
  expect(create).not.toHaveBeenCalled();
  act(() => root.unmount());
});
