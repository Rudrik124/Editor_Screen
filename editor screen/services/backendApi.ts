import { ClipModel, TrackModel } from "../types/editor.types";
import { getAudioPlaybackRate } from "../utils/audioTimeline";

const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";
const API_BASE = `${RAW_API_URL.replace(/\/+$/, "")}/api/v1`;
const WS_BASE = `${RAW_API_URL.replace(/\/+$/, "").replace(/^http/, "ws")}/api/v1`;

export interface UploadedAssetResponse {
  assetId: string;
  filename: string;
  mediaUrl: string;
  localPath: string;
  sizeBytes: number;
  probe: Record<string, unknown>;
}

export async function uploadAsset(file: File): Promise<UploadedAssetResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}/assets/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Asset upload failed"));
  }

  return response.json();
}

export interface ExportSettings {
  quality: "draft" | "standard" | "high";
  resolution: { width: number; height: number };
  fps: number;
  coverUrl?: string | null;
}

export interface RenderJobResponse {
  id: string;
  projectId?: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  outputUrl?: string;
  error?: string;
}

export interface ProgressMessage {
  type: string;
  jobId: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  currentFrame?: number;
  fps?: number;
  error?: string;
}

interface ApiValidationError {
  loc?: Array<string | number>;
  msg?: string;
}

function formatApiErrorDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;
  if (!Array.isArray(detail)) return null;

  const messages = detail.map((entry: unknown) => {
    if (!entry || typeof entry !== "object") return String(entry);
    const validationError = entry as ApiValidationError;
    const location = validationError.loc
      ?.filter((part) => part !== "body")
      .map((part, index, parts) =>
        typeof part === "number" ? `[${part}]` : `${index > 0 ? "." : ""}${part}`
      )
      .join("");
    return [location, validationError.msg].filter(Boolean).join(": ");
  });

  return messages.filter(Boolean).join("; ") || null;
}

async function getApiErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  let detail: unknown;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "detail" in body) {
      detail = body.detail;
    }
  } catch {
    return `${fallback} (HTTP ${response.status}).`;
  }

  return `${formatApiErrorDetail(detail) || fallback} (HTTP ${response.status}).`;
}

export async function submitTimelineRender(
  projectId: string,
  tracks: TrackModel[],
  clips: Record<string, ClipModel>,
  settings: ExportSettings
): Promise<RenderJobResponse> {
  const clipList = Object.values(clips).sort((a, b) => a.start - b.start);
  const trackList = tracks.map((t) => ({
    id: t.id,
    label: t.label,
    type: t.type,
    clipIds: t.clipIds,
    orderIndex: 0,
    muted: t.muted ?? false,
    hidden: t.hidden ?? false,
    locked: !!t.locked,
  }));

  const payload = {
    projectId,
    tracks: trackList,
    clips: clipList.map((c) => ({
      id: c.id,
      trackId: c.trackId,
      name: c.name,
      type: c.type,
      start: c.start,
      duration: c.duration,
      inPoint: c.inPoint || 0.0,
      outPoint: c.outPoint,
      mediaUrl: c.renderMediaUrl || c.mediaUrl,
      assetId: c.assetId,
      speed:
        c.type === "audio" || c.type === "music"
          ? getAudioPlaybackRate(c)
          : c.speed || 1.0,
      reverse: !!c.reverse,
      isFrozen: !!c.isFrozen,
      freezeTime: c.freezeTime,
      volume: c.volume !== undefined ? c.volume : 1.0,
      muted: c.muted ?? false,
      color: c.color,
      // Phase 3: Transition, Keyframes, Layering Transforms
      transition: c.transition
        ? {
            type: c.transition.type,
            duration: c.transition.duration !== undefined ? c.transition.duration : 0.5,
            color: c.transition.color,
          }
        : undefined,
      keyframes: c.keyframes || [],
      opacity: c.opacity !== undefined ? c.opacity : 1.0,
      scale: c.scale !== undefined ? c.scale : 1.0,
      positionX: c.positionX ?? 0.0,
      positionY: c.positionY ?? 0.0,
      rotation: c.rotation ?? 0.0,
    })),
    fps: settings.fps,
    width: settings.resolution.width,
    height: settings.resolution.height,
    quality: settings.quality,
    coverUrl: settings.coverUrl || undefined,
  };

  const response = await fetch(`${API_BASE}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Render request failed"));
  }

  return response.json();
}

export function subscribeToJobProgress(
  jobId: string,
  onMessage: (msg: ProgressMessage) => void,
  onError?: (err: Event) => void
): WebSocket {
  const ws = new WebSocket(`${WS_BASE}/render/jobs/${jobId}/ws`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.warn("Unable to parse WebSocket message:", event.data);
    }
  };

  if (onError) {
    ws.onerror = onError;
  }

  return ws;
}

export async function saveProjectTimeline(
  projectId: string,
  title: string,
  tracks: TrackModel[],
  clips: Record<string, ClipModel>,
  playheadTime: number,
  duration: number
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/timeline/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        title,
        tracks,
        clips: Object.values(clips),
        playheadTime,
        duration,
      }),
    });
    return res.ok;
  } catch (e) {
    console.warn("Failed to auto-save timeline to backend:", e);
    return false;
  }
}

export async function loadProjectTimeline(projectId: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/timeline/${projectId}`);
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.warn("Failed to load timeline from backend:", e);
    return null;
  }
}
