import { ClipModel, TrackModel } from "../types/editor.types";

const API_BASE = "http://localhost:8000/api/v1";
const WS_BASE = "ws://localhost:8000/api/v1";

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
    const err = await response.json().catch(() => ({ detail: "Asset upload failed" }));
    throw new Error(err.detail || "Asset upload failed");
  }

  return response.json();
}

export interface ExportSettings {
  quality: "draft" | "standard" | "high";
  resolution: { width: number; height: number };
  fps: number;
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

export async function submitTimelineRender(
  projectId: string,
  tracks: TrackModel[],
  clips: Record<string, ClipModel>,
  settings: ExportSettings
): Promise<RenderJobResponse> {
  const clipList = Object.values(clips);
  const trackList = tracks.map((t) => ({
    id: t.id,
    label: t.label,
    type: t.type,
    clipIds: t.clipIds,
    orderIndex: 0,
    muted: false,
    hidden: false,
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
      speed: c.speed || 1.0,
      reverse: !!c.reverse,
      isFrozen: !!c.isFrozen,
      freezeTime: c.freezeTime,
      volume: c.volume !== undefined ? c.volume : 1.0,
      color: c.color,
    })),
    fps: settings.fps,
    width: settings.resolution.width,
    height: settings.resolution.height,
    quality: settings.quality,
  };

  const response = await fetch(`${API_BASE}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: "Render request failed" }));
    throw new Error(err.detail || "Render request failed");
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
