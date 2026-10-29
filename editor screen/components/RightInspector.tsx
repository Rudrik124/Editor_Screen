import React, { useState } from "react";
import {
  TextT,
  Trash,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  BoundingBox,
  Gauge,
  DiamondsFour,
  SpeakerHigh,
  SpeakerSlash,
  Scissors,
  ArrowsClockwise,
  Snowflake,
  ImageSquare,
  Info,
} from "@phosphor-icons/react";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";
import { useEditorStore } from "../store/editor.store";
import { OverlapInspector } from "../plugins/overlap";
import { KeyframeInspector } from "../plugins/keyframe";
import { SpeedProcessor } from "../plugins/speed";
import { ReverseProcessor } from "../plugins/reverse";
import { FreezeProcessor } from "../plugins/freeze";
import { CoverModal } from "../plugins/cover";
import { AudioProcessor } from "../plugins/audio";

interface RightInspectorProps {
  selectedText?: TextElement;
  onUpdateText: (id: string, changes: Partial<TextElement>) => void;
  onDeleteText: (id: string) => void;
}

type ClipTab = "transform" | "speed" | "keyframes" | "audio";

export function RightInspector({
  selectedText,
  onUpdateText,
  onDeleteText,
}: RightInspectorProps) {
  const [activeTab, setActiveTab] = useState<ClipTab>("transform");
  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [audioActionError, setAudioActionError] = useState<string | null>(null);

  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClip = useEditorStore((state) =>
    selectedClipId ? state.clips[selectedClipId] : null
  );
  const aspectRatio = useEditorStore((state) => state.aspectRatio);
  const duration = useEditorStore((state) => state.duration);
  const clips = useEditorStore((state) => state.clips);
  const totalClips = Object.keys(clips).length;

  return (
    <aside className="right-side panel">
      {/* 1. TEXT SELECTED */}
      {selectedText ? (
        <div className="inspector-content text-inspector-content">
          <div className="inspector-header">
            <span className="inspector-header-title">
              <TextT size={15} weight="bold" />
              <span>Text Inspector</span>
            </span>
            <button
              type="button"
              className="inspector-delete-btn"
              title="Delete text layer"
              onClick={() => onDeleteText(selectedText.id)}
            >
              <Trash size={14} weight="regular" />
              <span>Delete</span>
            </button>
          </div>

          <div className="inspector-body">
            <div className="control-group">
              <label className="control-label">Text Content</label>
              <textarea
                className="text-input-field"
                placeholder="Enter title text..."
                value={selectedText.content}
                rows={3}
                onChange={(e) =>
                  onUpdateText(selectedText.id, { content: e.target.value })
                }
              />
            </div>

            <div className="control-group">
              <div className="control-label-row">
                <label className="control-label">Font Size</label>
                <span className="control-val">{selectedText.fontSize || 32}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="120"
                value={selectedText.fontSize || 32}
                onChange={(e) =>
                  onUpdateText(selectedText.id, {
                    fontSize: parseInt(e.target.value, 10),
                  })
                }
                className="inspector-slider"
              />
            </div>

            <div className="control-group">
              <label className="control-label">Color & Styling</label>
              <div className="styling-row">
                <input
                  type="color"
                  value={selectedText.color || "#ffffff"}
                  onChange={(e) =>
                    onUpdateText(selectedText.id, { color: e.target.value })
                  }
                  className="color-picker-input"
                  title="Pick text color"
                />
                <button
                  type="button"
                  className={`style-btn ${selectedText.bold ? "active" : ""}`}
                  onClick={() =>
                    onUpdateText(selectedText.id, { bold: !selectedText.bold })
                  }
                  title="Toggle bold"
                >
                  <strong>B</strong>
                </button>
                <button
                  type="button"
                  className={`style-btn ${selectedText.italic ? "active" : ""}`}
                  onClick={() =>
                    onUpdateText(selectedText.id, { italic: !selectedText.italic })
                  }
                  title="Toggle italic"
                >
                  <em>I</em>
                </button>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">Alignment</label>
              <div className="align-buttons-row">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    className={`align-btn ${
                      (selectedText.alignment || "center") === align ? "active" : ""
                    }`}
                    onClick={() => onUpdateText(selectedText.id, { alignment: align })}
                    title={`Align ${align}`}
                  >
                    {align === "left" && <TextAlignLeft size={14} weight="regular" />}
                    {align === "center" && <TextAlignCenter size={14} weight="regular" />}
                    {align === "right" && <TextAlignRight size={14} weight="regular" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : selectedClip ? (
        /* 2. CLIP SELECTED */
        <div className="inspector-content clip-inspector-content">
          <div className="inspector-header">
            <div className="clip-name-wrap">
              <span className="clip-type-pill">{selectedClip.type.toUpperCase()}</span>
              <strong className="clip-name-title" title={selectedClip.name}>
                {selectedClip.name}
              </strong>
            </div>
            <span className="clip-duration-badge">{selectedClip.duration.toFixed(2)}s</span>
          </div>

          {/* Tab Navigation */}
          <div className="inspector-tabs">
            <button
              type="button"
              className={`inspector-tab ${activeTab === "transform" ? "active" : ""}`}
              onClick={() => setActiveTab("transform")}
            >
              <BoundingBox size={14} weight="regular" />
              <span>Basic</span>
            </button>
            <button
              type="button"
              className={`inspector-tab ${activeTab === "speed" ? "active" : ""}`}
              onClick={() => setActiveTab("speed")}
            >
              <Gauge size={14} weight="regular" />
              <span>Speed</span>
            </button>
            <button
              type="button"
              className={`inspector-tab ${activeTab === "keyframes" ? "active" : ""}`}
              onClick={() => setActiveTab("keyframes")}
            >
              <DiamondsFour size={14} weight="regular" />
              <span>Keys</span>
            </button>
            <button
              type="button"
              className={`inspector-tab ${activeTab === "audio" ? "active" : ""}`}
              onClick={() => setActiveTab("audio")}
            >
              <SpeakerHigh size={14} weight="regular" />
              <span>Audio</span>
            </button>
          </div>

          <div className="inspector-body">
            {/* TAB: TRANSFORM / OVERLAP */}
            {activeTab === "transform" && (
              <div className="tab-section">
                <OverlapInspector clipId={selectedClip.id} />
              </div>
            )}

            {/* TAB: SPEED & MOTION */}
            {activeTab === "speed" && (
              <div className="tab-section speed-inspector-section">
                <div className="control-group">
                  <div className="control-label-row">
                    <label className="control-label">Speed Multiplier</label>
                    <span className="control-val">{selectedClip.speed ?? 1.0}x</span>
                  </div>
                  <div className="speed-preset-buttons">
                    {[0.25, 0.5, 1.0, 1.5, 2.0, 4.0].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`speed-pill ${
                          (selectedClip.speed ?? 1.0) === preset ? "active" : ""
                        }`}
                        onClick={() => SpeedProcessor.setSelectedClipSpeed(preset)}
                      >
                        {preset}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="control-group" style={{ marginTop: "16px" }}>
                  <label className="control-label">Motion Effects</label>
                  <div className="motion-actions-grid">
                    <button
                      type="button"
                      className={`motion-btn ${selectedClip.reverse ? "active" : ""}`}
                      onClick={() => ReverseProcessor.toggleReverseClip(selectedClip.id)}
                    >
                      <ArrowsClockwise size={15} weight="regular" />
                      <span>Reverse Clip</span>
                      <span className="motion-status">
                        {selectedClip.reverse ? "ON" : "OFF"}
                      </span>
                    </button>

                    <button
                      type="button"
                      className={`motion-btn ${selectedClip.isFrozen ? "active" : ""}`}
                      onClick={() => FreezeProcessor.freezeAtCurrentTime(3.0)}
                    >
                      <Snowflake size={15} weight="regular" />
                      <span>Freeze Frame</span>
                      <span className="motion-status">+3s</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: KEYFRAMES */}
            {activeTab === "keyframes" && (
              <div className="tab-section">
                <KeyframeInspector clipId={selectedClip.id} />
              </div>
            )}

            {/* TAB: AUDIO */}
            {activeTab === "audio" && (
              <div className="tab-section audio-inspector-section">
                <div className="control-group">
                  <div className="control-label-row">
                    <label className="control-label">Volume</label>
                    <span className="control-val">
                      {Math.round((selectedClip.volume ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    value={Math.round((selectedClip.volume ?? 1) * 100)}
                    onChange={(event) => {
                      setAudioActionError(null);
                      const updated = AudioProcessor.setVolume(
                        selectedClip.id,
                        Number(event.target.value) / 100
                      );
                      if (!updated) setAudioActionError("Unable to update this clip volume.");
                    }}
                    className="inspector-slider"
                  />
                </div>

                <div className="audio-actions-row">
                  <button
                    type="button"
                    className="audio-action-btn"
                    disabled={!!selectedClip.locked}
                    onClick={() => {
                      setAudioActionError(null);
                      const updated = AudioProcessor.setClipMuted(
                        selectedClip.id,
                        !(selectedClip.muted ?? false)
                      );
                      if (!updated) setAudioActionError("Unable to change mute state.");
                    }}
                  >
                    <SpeakerSlash size={14} weight="regular" />
                    <span>{selectedClip.muted ? "Unmute Clip" : "Mute Clip"}</span>
                  </button>
                  <button
                    type="button"
                    className="audio-action-btn"
                    disabled={selectedClip.type !== "video" || !!selectedClip.locked}
                    title={
                      selectedClip.type === "video"
                        ? "Create a separate audio clip on the Audio Track"
                        : "Extract Audio is available for video clips"
                    }
                    onClick={() => {
                      setAudioActionError(null);
                      const updated = AudioProcessor.extractAudio(selectedClip.id);
                      if (!updated) {
                        setAudioActionError(
                          "Audio extraction failed. Select an unlocked video clip and ensure an unlocked Audio Track exists."
                        );
                      }
                    }}
                  >
                    <Scissors size={14} weight="regular" />
                    <span>Extract Audio</span>
                  </button>
                </div>
                {audioActionError && (
                  <p className="control-error" role="alert">
                    {audioActionError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* 3. NOTHING SELECTED - PROJECT OVERVIEW */
        <div className="inspector-content project-inspector-content">
          <div className="project-overview-card">
            <div className="project-card-header">
              <span className="project-tag">PROJECT SUMMARY</span>
              <h3 className="project-overview-title">Canvas Settings</h3>
            </div>

            <div className="project-specs-list">
              <div className="spec-row">
                <span className="spec-label">Resolution</span>
                <span className="spec-val">1920 × 1080</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Frame Rate</span>
                <span className="spec-val">30 FPS</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Aspect Ratio</span>
                <span className="spec-val-badge">{aspectRatio}</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Duration</span>
                <span className="spec-val">{duration.toFixed(2)}s</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Total Clips</span>
                <span className="spec-val">{totalClips}</span>
              </div>
            </div>

            <div className="cover-snapshot-section">
              <label className="control-label">Cover Frame</label>
              <button
                type="button"
                className="cover-trigger-btn"
                onClick={() => setCoverModalOpen(true)}
              >
                <ImageSquare size={16} weight="regular" />
                <span>Set Project Cover Poster</span>
              </button>
            </div>

            <div className="quick-tip-box">
              <Info size={16} weight="regular" className="tip-icon" />
              <span className="tip-text">
                Click any clip or text on the timeline to inspect and edit its properties.
              </span>
            </div>
          </div>
        </div>
      )}

      <CoverModal
        isOpen={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        clipId={selectedClipId || undefined}
      />
    </aside>
  );
}
