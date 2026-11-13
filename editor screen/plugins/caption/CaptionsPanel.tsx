import React, { useState, useMemo } from "react";
import { ClosedCaptioning, DownloadSimple, Trash, Plus, CircleNotch, WarningCircle, Check } from "@phosphor-icons/react";
import { useEditorStore } from "../../store/editor.store";
import { CaptionProcessor } from "./caption.processor";
import { CaptionItem } from "../../types/editor.types";
import { resolveActiveClips } from "../../components/utils/previewResolver";
import "./captions.ui.css";

interface CaptionsPanelProps {
  clipId?: string;
}

export function CaptionsPanel({ clipId }: CaptionsPanelProps) {
  const storeTracks = useEditorStore((state) => state.tracks);
  const storeClips = useEditorStore((state) => state.clips);
  const storeCurrentTime = useEditorStore((state) => state.currentTime);
  const storeSelectedClipId = useEditorStore((state) => state.selectedClipId);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);

  const activeClipUnderPlayhead = useMemo(() => {
    return resolveActiveClips(storeTracks, storeClips, storeCurrentTime).activeVideoClip;
  }, [storeTracks, storeClips, storeCurrentTime]);

  const targetClipId = clipId || storeSelectedClipId || activeClipUnderPlayhead?.id || null;
  const clip = targetClipId ? storeClips[targetClipId] : null;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("en");

  // Retrieve all captions: from clip.captions OR directly from text track clips
  const captions: CaptionItem[] = useMemo(() => {
    if (clip?.captions && clip.captions.length > 0) {
      return [...clip.captions].sort((a, b) => a.startTime - b.startTime);
    }
    const textTrack = storeTracks.find((t) => t.id === "text" || t.type === "text");
    if (textTrack && textTrack.clipIds.length > 0) {
      return textTrack.clipIds
        .map((id) => storeClips[id])
        .filter(Boolean)
        .map((c) => ({
          id: c.id,
          text: c.text_data?.text || c.content || c.name || "",
          startTime: c.start,
          endTime: c.start + c.duration,
        }))
        .sort((a, b) => a.startTime - b.startTime);
    }
    return [];
  }, [clip, storeTracks, storeClips]);

  const handleAutoCaption = async () => {
    if (!targetClipId) {
      setError("Please select or add a video clip first.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await CaptionProcessor.autoTranscribe(targetClipId, language);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-transcription failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportSrt = () => {
    if (captions.length === 0) return;
    CaptionProcessor.downloadSrt(captions, `${clip?.name || "video"}_captions.srt`);
  };

  const handleUpdateText = (captionId: string, newText: string) => {
    if (!targetClipId) return;
    CaptionProcessor.updateCaption(targetClipId, captionId, { text: newText });
  };

  const handleUpdateTiming = (captionId: string, startTime: number, endTime: number) => {
    if (!targetClipId) return;
    CaptionProcessor.updateCaption(targetClipId, captionId, {
      startTime: Math.max(0, startTime),
      endTime: Math.max(startTime + 0.1, endTime),
    });
  };

  const handleDeleteCaption = (captionId: string) => {
    if (!targetClipId) return;
    CaptionProcessor.removeCaption(targetClipId, captionId);
  };

  const handleAddManual = () => {
    if (!targetClipId) return;
    const start = Math.round(storeCurrentTime * 10) / 10;
    const end = Math.round((start + 2.0) * 10) / 10;
    CaptionProcessor.addManualCaption(targetClipId, "New subtitle caption", start, end);
  };

  return (
    <div className="captions-panel">
      {/* Top action bar: Auto Caption + Export SRT */}
      <div className="captions-action-bar">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={isLoading}
          style={{
            background: "rgba(0, 0, 0, 0.4)",
            color: "#fff",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            borderRadius: "6px",
            fontSize: "11px",
            padding: "8px 6px",
          }}
          title="Transcription Language"
          aria-label="Language"
        >
          <option value="en">English (EN)</option>
          <option value="es">Spanish (ES)</option>
          <option value="fr">French (FR)</option>
          <option value="de">German (DE)</option>
          <option value="ja">Japanese (JA)</option>
          <option value="hi">Hindi (HI)</option>
        </select>

        <button
          type="button"
          className="caption-auto-btn"
          onClick={handleAutoCaption}
          disabled={isLoading || !clip}
          title="Auto-transcribe speech to text using Whisper"
        >
          {isLoading ? (
            <>
              <CircleNotch size={14} className="animate-spin" />
              <span>Transcribing...</span>
            </>
          ) : (
            <>
              <ClosedCaptioning size={15} weight="bold" />
              <span>Auto Caption</span>
            </>
          )}
        </button>

        <button
          type="button"
          className="caption-export-btn"
          onClick={handleExportSrt}
          disabled={captions.length === 0}
          title="Export standard .srt subtitle file"
        >
          <DownloadSimple size={13} weight="bold" />
          <span>Export SRT</span>
        </button>
      </div>

      {error && (
        <div style={{ color: "#f87171", fontSize: "11px", display: "flex", gap: "6px", alignItems: "center" }}>
          <WarningCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Caption summary and add button */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted, #94a3b8)" }}>
          {captions.length} {captions.length === 1 ? "Caption" : "Captions"}
        </span>
        <button
          type="button"
          onClick={handleAddManual}
          disabled={!clip}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--accent-primary, #06b6d4)",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <Plus size={12} weight="bold" />
          <span>Add Caption</span>
        </button>
      </div>

      {/* Caption list */}
      {captions.length > 0 ? (
        <div className="captions-list">
          {captions.map((cap, idx) => (
            <div key={cap.id || idx} className="caption-card">
              <div className="caption-card-header">
                <div className="caption-timing-box">
                  <span
                    style={{ cursor: "pointer", color: "var(--accent-primary, #06b6d4)" }}
                    onClick={() => setCurrentTime(cap.startTime)}
                    title="Jump to this caption"
                  >
                    #{idx + 1}
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    className="caption-time-input"
                    value={cap.startTime}
                    onChange={(e) =>
                      handleUpdateTiming(cap.id, parseFloat(e.target.value) || 0, cap.endTime)
                    }
                    title="Start time (seconds)"
                  />
                  <span>→</span>
                  <input
                    type="number"
                    step="0.1"
                    className="caption-time-input"
                    value={cap.endTime}
                    onChange={(e) =>
                      handleUpdateTiming(cap.id, cap.startTime, parseFloat(e.target.value) || 0)
                    }
                    title="End time (seconds)"
                  />
                  <span>s</span>
                </div>
                <button
                  type="button"
                  className="caption-del-btn"
                  onClick={() => handleDeleteCaption(cap.id)}
                  title="Delete caption"
                >
                  <Trash size={12} />
                </button>
              </div>
              <textarea
                className="caption-text-area"
                value={cap.text}
                onChange={(e) => handleUpdateText(cap.id, e.target.value)}
                placeholder="Caption text..."
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="caption-empty-box">
          <ClosedCaptioning size={24} style={{ opacity: 0.4 }} />
          <span>No captions generated yet.</span>
          <span style={{ fontSize: "10px", opacity: 0.7 }}>
            Click &quot;Auto Caption&quot; to transcribe spoken speech into synchronized subtitles.
          </span>
        </div>
      )}
    </div>
  );
}

