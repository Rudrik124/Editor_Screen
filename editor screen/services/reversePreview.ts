import { useEffect, useMemo, useState } from "react";
import { ClipModel } from "../types/editor.types";
import { API_BASE } from "./backendApi";

export function reverseKey(clip: ClipModel): string {
  return JSON.stringify([clip.assetId, clip.renderMediaUrl ?? clip.mediaUrl, clip.inPoint ?? 0,
    clip.outPoint ?? (clip.inPoint ?? 0) + clip.duration * (clip.speed ?? 1)]);
}

interface PreviewJob { id: string; status: string; progress: number; error?: string }
interface Preview { url?: string; progress: number; error?: string }

async function json(response: Response): Promise<PreviewJob> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : `Reverse preparation failed (${response.status})`);
  }
  return response.json();
}

export function useReversePreviews(clips: Record<string, ClipModel>) {
  const [previews, setPreviews] = useState<Record<string, Preview>>({});
  const [revision, setRevision] = useState(0);
  const keys = JSON.stringify(Object.values(clips).filter(c => c.reverse && !c.isFrozen && c.type === "video" && c.mediaType !== "image")
    .map(reverseKey).sort());
  const requests = useMemo(() => [...new Map(Object.values(clips)
    .filter(c => c.reverse && !c.isFrozen && c.type === "video" && c.mediaType !== "image")
    .map(c => [reverseKey(c), c])).entries()], [keys]);
  useEffect(() => {
    const controller = new AbortController();
    const urls: string[] = [];
    let currentJob: string | undefined;
    const update = (key: string, value: Preview) => {
      if (!controller.signal.aborted) setPreviews(previous => ({ ...previous, [key]: value }));
    };
    setPreviews({});
    void (async () => {
      for (const [key, clip] of requests) {
        if (controller.signal.aborted) break;
        try {
          const assetId = clip.renderMediaUrl?.match(/\/uploads\/([0-9a-f-]{36})_/i)?.[1] ?? clip.assetId;
          if (!assetId) throw new Error("Upload this source again to prepare reverse playback.");
          update(key, { progress: 0 });
          const start = clip.inPoint ?? 0;
          let job = await json(await fetch(`${API_BASE}/preview/reverse`, {
            method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
            body: JSON.stringify({ assetId, start, end: clip.outPoint ?? start + clip.duration * (clip.speed ?? 1) }),
          }));
          currentJob = job.id;
          const deadline = performance.now() + 660_000;
          let delay = 300;
          while (job.status !== "Completed") {
            if (job.status === "Failed" || job.status === "Cancelled") throw new Error(job.error ?? "Reverse preparation failed");
            if (performance.now() > deadline) throw new Error("Reverse preparation timed out. Retry or select a shorter clip.");
            update(key, { progress: job.progress });
            await new Promise<void>((resolve, reject) => {
              const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
              const timer = setTimeout(() => { controller.signal.removeEventListener("abort", abort); resolve(); }, delay);
              controller.signal.addEventListener("abort", abort, { once: true });
              if (controller.signal.aborted) abort();
            });
            delay = Math.min(2000, delay * 1.5);
            job = await json(await fetch(`${API_BASE}/preview/${job.id}`, { signal: controller.signal }));
          }
          const response = await fetch(`${API_BASE}/preview/${job.id}/media`, { signal: controller.signal });
          if (!response.ok) throw new Error("Unable to load prepared reverse preview");
          const blob = await response.blob();
          if (controller.signal.aborted) break;
          const url = URL.createObjectURL(blob);
          urls.push(url);
          update(key, { url, progress: 100 });
          currentJob = undefined;
        } catch (error) {
          if (currentJob) void fetch(`${API_BASE}/preview/${currentJob}`, { method: "DELETE" });
          currentJob = undefined;
          update(key, { progress: 0, error: error instanceof Error ? error.message : "Reverse preparation failed" });
        }
      }
    })();
    return () => {
      controller.abort();
      if (currentJob) void fetch(`${API_BASE}/preview/${currentJob}`, { method: "DELETE" });
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [requests, revision]);
  return { previews, retry: () => setRevision(value => value + 1) };
}
