import React, { useState, useEffect, useRef } from "react";
import { useEditorStore } from "../store/editor.store";
import {
  submitTimelineRender,
  subscribeToJobProgress,
  ExportSettings,
  RenderJobResponse,
} from "../services/backendApi";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportModal({ isOpen, onClose }: ExportModalProps) {
  const [quality, setQuality] = useState<"draft" | "standard" | "high">("standard");
  const [fps, setFps] = useState<number>(30);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [jobStatus, setJobStatus] = useState<string>("IDLE");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const tracks = useEditorStore((state) => state.tracks);
  const clips = useEditorStore((state) => state.clips);

  useEffect(() => {
    if (!isOpen) return;

    setQuality("standard");
    setFps(30);
    setIsExporting(false);
    setProgress(0);
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
    setJobStatus("STARTING");
    setErrorMessage(null);
    setDownloadUrl(null);

    const resolutionMap = {
      draft: { width: 1280, height: 720 },
      standard: { width: 1920, height: 1080 },
      high: { width: 3840, height: 2160 },
    };

    const settings: ExportSettings = {
      quality,
      resolution: resolutionMap[quality],
      fps,
    };

    try {
      const job: RenderJobResponse = await submitTimelineRender(
        "current-project",
        tracks,
        clips,
        settings
      );

      setJobStatus("PROCESSING");

      // Connect WebSocket for real-time progress events
      const rawApi = (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";
      const apiBase = `${rawApi.replace(/\/+$/, "")}/api/v1`;
      let polling = true;
      const pollJob = async () => {
        try {
          const res = await fetch(`${apiBase}/render/jobs/${job.id}`);
          if (!res.ok) return;
          const current: RenderJobResponse = await res.json();
          setProgress(current.progress);
          setJobStatus(current.status);
          if (current.status === "COMPLETED") {
            polling = false;
            setDownloadUrl(`${apiBase}/render/jobs/${job.id}/download`);
            setIsExporting(false);
          } else if (current.status === "FAILED") {
            polling = false;
            setErrorMessage(current.error || "Rendering failed. Check the backend terminal for details.");
            setIsExporting(false);
          }
        } catch {
          // The WebSocket remains the primary progress channel.
        }
      };
      pollingIntervalRef.current = window.setInterval(() => {
        if (polling) void pollJob();
      }, 1000);

      wsRef.current = subscribeToJobProgress(
        job.id,
        (msg) => {
          setProgress(msg.progress);
          setJobStatus(msg.status);
          if (msg.status === "COMPLETED") {
            polling = false;
            if (pollingIntervalRef.current !== null) {
              window.clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setDownloadUrl(`${apiBase}/render/jobs/${job.id}/download`);
            setIsExporting(false);
          } else if (msg.status === "FAILED") {
            polling = false;
            if (pollingIntervalRef.current !== null) {
              window.clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            setErrorMessage(msg.error || "Rendering failed. Check the backend terminal for details.");
            setIsExporting(false);
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
            ✕
          </button>
        </div>

        <div className="export-modal-body">
          {!isExporting && jobStatus !== "COMPLETED" && (
            <>
              <div className="setting-group">
                <label>Resolution Preset</label>
                <div className="preset-selector">
                  <button
                    className={`preset-pill ${quality === "draft" ? "active" : ""}`}
                    onClick={() => setQuality("draft")}
                  >
                    720p (Draft)
                  </button>
                  <button
                    className={`preset-pill ${quality === "standard" ? "active" : ""}`}
                    onClick={() => setQuality("standard")}
                  >
                    1080p Full HD
                  </button>
                  <button
                    className={`preset-pill ${quality === "high" ? "active" : ""}`}
                    onClick={() => setQuality("high")}
                  >
                    4K Ultra HD
                  </button>
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

          {(isExporting || jobStatus === "PROCESSING" || jobStatus === "STARTING") && (
            <div className="render-progress-section">
              <div className="progress-info">
                <span>Rendering Video...</span>
                <span className="percentage">{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <p className="status-note">
                Compiling FFmpeg sub-graphs and stitching media clips...
              </p>
            </div>
          )}

          {jobStatus === "COMPLETED" && downloadUrl && (
            <div className="completed-section">
              <div className="success-icon">✓</div>
              <h4>Export Complete!</h4>
              <p>Your video has been rendered and encoded successfully.</p>
              <a
                href={downloadUrl}
                download="veytrix_export.mp4"
                className="download-button"
              >
                Download Video (.mp4)
              </a>
            </div>
          )}

          {errorMessage && (
            <div className="export-error-banner">
              ⚠️ {errorMessage}
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
                disabled={isExporting}
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
