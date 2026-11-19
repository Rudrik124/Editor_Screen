import React, { useState, useEffect, useRef } from "react";
import { X, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { useEditorStore } from "../store/editor.store";
import {
  submitTimelineRender,
  subscribeToJobProgress,
  ExportSettings,
  RenderJobResponse,
} from "../services/backendApi";
import {
  EXPORT_RESOLUTION_PRESETS,
  getExportResolution,
  type ExportResolutionPreset,
} from "../utils/exportResolution";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomizeWatermark: () => void;
  watermarkUploading: boolean;
  canCustomizeWatermark: boolean | null;
  watermarkPermissionsError: string | null;
  onRefreshWatermarkPermissions: () => void;
}

export function ExportModal({
  isOpen, onClose, onCustomizeWatermark, watermarkUploading, canCustomizeWatermark,
  watermarkPermissionsError, onRefreshWatermarkPermissions,
}: ExportModalProps) {
  const [resolutionPreset, setResolutionPreset] = useState<ExportResolutionPreset>("1080p");
  const [fps, setFps] = useState<number>(30);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [encodedFrames, setEncodedFrames] = useState(0);
  const [jobStatus, setJobStatus] = useState<string>("IDLE");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const tracks = useEditorStore((state) => state.tracks);
  const clips = useEditorStore((state) => state.clips);
  const watermark = useEditorStore((state) => state.watermark);
  const aspectRatio = useEditorStore((state) => state.aspectRatio);

  useEffect(() => {
    if (!isOpen) return;

    setIsExporting(false);
    setProgress(0);
    setEncodedFrames(0);
    setJobStatus("IDLE");
    setDownloadUrl(null);
    setErrorMessage(null);

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setEncodedFrames(0);
    setJobStatus("STARTING");
    setErrorMessage(null);
    setDownloadUrl(null);

    const state = useEditorStore.getState();
    const clipsList = Object.values(clips);
    const unuploadedClip = clipsList.find((c) =>
      ((c.type as string) === "video" || (c.type as string) === "image" || c.type === "audio" || c.type === "music") &&
      (!c.renderMediaUrl && (!c.mediaUrl || c.mediaUrl.startsWith("blob:")))
    );
    if (unuploadedClip) {
      setErrorMessage(`Clip "${unuploadedClip.name || unuploadedClip.id}" is still syncing with backend storage. Please wait a moment and try again.`);
      setIsExporting(false);
      setJobStatus("FAILED");
      return;
    }

    const settings: ExportSettings = {
      resolutionPreset,
      aspectRatio: state.aspectRatio,
      fps,
      coverUrl: state.coverUrl || undefined,
      watermark: state.watermark,
    };

    try {
      const job: RenderJobResponse = await submitTimelineRender(
        "current-project",
        tracks,
        clips,
        settings
      );

      setJobStatus(job.status);

      // Connect WebSocket for real-time progress events
      const rawApi = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";
      const apiBase = `${rawApi.replace(/\/+$/, "")}/api/v1`;
      let polling = true;
      let consecutiveErrors = 0;
      let consecutive404s = 0;
      let pollInFlight = false;

      const stopAll = () => {
        polling = false;
        if (pollingIntervalRef.current !== null) {
          window.clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        wsRef.current?.close();
        wsRef.current = null;
        setIsExporting(false);
      };

      const pollJob = async () => {
        if (!polling || pollInFlight) return;
        pollInFlight = true;
        try {
          const res = await fetch(`${apiBase}/render/jobs/${job.id}`);
          if (!polling) return;
          if (res.status === 404) {
            consecutive404s += 1;
            if (consecutive404s >= 4) {
              stopAll();
              setErrorMessage("Render job not found on server (backend may have restarted). Please retry.");
              setJobStatus("FAILED");
              return;
            }
            return;
          }

          if (!res.ok) {
            consecutiveErrors += 1;
            if (consecutiveErrors >= 6) {
              stopAll();
              setErrorMessage(`Render backend error (${res.status}). Please check backend console.`);
              setJobStatus("FAILED");
            }
            return;
          }

          consecutiveErrors = 0;
          consecutive404s = 0;
          const current: RenderJobResponse = await res.json();
          if (!polling) return;
          setProgress((previous) => Math.max(previous, current.progress));
          setEncodedFrames((previous) => Math.max(previous, current.currentFrame ?? 0));
          setJobStatus(current.status);

          if (current.status === "COMPLETED") {
            stopAll();
            setDownloadUrl(`${apiBase}/render/jobs/${job.id}/download`);
          } else if (current.status === "FAILED") {
            stopAll();
            setErrorMessage(current.error || "Rendering failed. Check backend terminal for details.");
          }
        } catch (fetchErr) {
          if (!polling) return;
          consecutiveErrors += 1;
          if (consecutiveErrors >= 6) {
            stopAll();
            setErrorMessage("Cannot connect to backend on http://localhost:8000. Is the server running?");
            setJobStatus("FAILED");
          }
        } finally {
          pollInFlight = false;
        }
      };

      pollingIntervalRef.current = window.setInterval(() => {
        void pollJob();
      }, 1000);

      wsRef.current = subscribeToJobProgress(
        job.id,
        (msg) => {
          if (!polling) return;
          setProgress((previous) => Math.max(previous, msg.progress));
          setEncodedFrames((previous) => Math.max(previous, msg.currentFrame ?? 0));
          setJobStatus(msg.status);
          if (msg.status === "COMPLETED") {
            stopAll();
            setDownloadUrl(`${apiBase}/render/jobs/${job.id}/download`);
          } else if (msg.status === "FAILED") {
            stopAll();
            setErrorMessage(msg.error || "Rendering failed. Check the backend terminal for details.");
          }
        },
        () => {
          // Fallback polling if WebSocket is unavailable
          void pollJob();
        }
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to start export.");
      setIsExporting(false);
      setJobStatus("FAILED");
    }
  };

  return (
    <div className="export-modal-overlay" onClick={onClose}>
      <div className="export-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="export-modal-header">
          <h3>Export Timeline Video</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="export-modal-body">
          {!isExporting && jobStatus !== "COMPLETED" && (
            <>
              <div className="setting-group">
                <label>Resolution Preset</label>
                <div className="preset-selector">
                  {EXPORT_RESOLUTION_PRESETS.map((preset) => {
                    const selected = resolutionPreset === preset;
                    const { width, height } = getExportResolution(aspectRatio, preset);
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={`preset-pill ${selected ? "active" : ""}`}
                        aria-pressed={selected}
                        onClick={() => setResolutionPreset(preset)}
                      >
                        {preset === "4k" ? "4K" : preset}
                        <small className="preset-dimensions">{width} × {height}</small>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="setting-group">
                <label>Frame Rate</label>
                <div className="preset-selector">
                  <button
                    className={`preset-pill ${fps === 30 ? "active" : ""}`}
                    onClick={() => setFps(30)}
                  >
                    30 FPS
                  </button>
                  <button
                    className={`preset-pill ${fps === 60 ? "active" : ""}`}
                    onClick={() => setFps(60)}
                  >
                    60 FPS
                  </button>
                </div>
              </div>
            </>
          )}

          {!isExporting && jobStatus !== "COMPLETED" && (
            <div className="export-watermark-settings">
              <label>
                <input
                  type="checkbox"
                  checked={canCustomizeWatermark === true ? watermark.enabled : true}
                  disabled={canCustomizeWatermark !== true}
                  onChange={(event) => useEditorStore.getState().setWatermark({
                    ...watermark,
                    enabled: event.currentTarget.checked,
                  })}
                />
                Watermark Enabled
              </label>
              <button type="button" disabled={canCustomizeWatermark !== true} onClick={onCustomizeWatermark}>
                Customize Watermark
              </button>
              {canCustomizeWatermark === false && <p>Custom watermarks and removal require Premium.</p>}
              {canCustomizeWatermark === null && !watermarkPermissionsError && <p role="status">Checking watermark permissions…</p>}
              {watermarkPermissionsError && (
                <p role="alert">
                  {watermarkPermissionsError}{" "}
                  <button type="button" onClick={onRefreshWatermarkPermissions}>Retry</button>
                </p>
              )}
              {watermarkUploading && <p role="status">Uploading watermark…</p>}
            </div>
          )}

          {(isExporting || jobStatus === "PROCESSING" || jobStatus === "STARTING") && (
            <div className="render-progress-section">
              <div className="progress-info">
                <span>{jobStatus === "PENDING" ? "Queued for export" : progress >= 99 ? "Finishing export" : encodedFrames > 0 ? "Rendering video" : "Preparing video"}</span>
                <span className="percentage">{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="status-note">
                {encodedFrames > 0 && progress < 99 ? `${encodedFrames.toLocaleString()} frames encoded` : null}
              </p>
            </div>
          )}

          {jobStatus === "COMPLETED" && downloadUrl && (
            <div className="completed-section">
              <div className="success-icon" style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
                <CheckCircle size={44} weight="fill" color="#10b981" />
              </div>
              <h4>Export Complete!</h4>
              <p>Your video has been rendered and encoded successfully.</p>
              <a
                href={downloadUrl}
                download={`veytrix_render_${resolutionPreset}_export.mp4`}
                className="download-button"
              >
                Download Video (.mp4)
              </a>
            </div>
          )}

          {errorMessage && (
            <div className="export-error-banner" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <WarningCircle size={16} weight="fill" color="#ef4444" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <div className="export-modal-footer">
          {jobStatus !== "COMPLETED" && (
            <>
              <button
                className="cancel-btn"
                onClick={onClose}
                disabled={isExporting}
              >
                Cancel
              </button>
              <button
                className="submit-export-btn"
                onClick={handleStartExport}
                disabled={isExporting || watermarkUploading || canCustomizeWatermark === null}
              >
                {isExporting ? "Exporting..." : "Start Export"}
              </button>
            </>
          )}
          {jobStatus === "COMPLETED" && (
            <button className="done-btn" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
