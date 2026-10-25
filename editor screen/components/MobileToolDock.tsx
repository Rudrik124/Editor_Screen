import React, { useState } from "react";
import {
  Scissors,
  FolderSimple,
  MusicNotes,
  TextT,
  Sparkle,
  Crop,
  ImageSquare,
  Copy,
  ArrowsClockwise,
  Snowflake,
  Trash,
  Plus,
  VideoCamera,
  ChatText,
  DeviceMobile,
  Monitor,
  Square,
  FilmStrip,
  Check,
} from "@phosphor-icons/react";
import { useEditorStore } from "../store/editor.store";
import { SplitProcessor } from "../plugins/split";
import { ReverseProcessor } from "../plugins/reverse";
import { FreezeProcessor } from "../plugins/freeze";
import { DuplicateProcessor } from "../plugins/duplicate";
import { DeleteProcessor } from "../plugins/delete";
import { TransitionModal } from "../plugins/transition";
import { CoverModal } from "../plugins/cover";
import { AspectRatio, VideoAsset } from "../types/editor.types";

interface MobileToolDockProps {
  onMediaSelected: (file: File) => void;
  onAddText: () => void;
  videoAssets: VideoAsset[];
  onAddVideo: (asset: VideoAsset) => void;
}

type MobileSheetType = "none" | "edit" | "media" | "text" | "ratio" | "audio";

const RATIO_PRESETS: { ratio: AspectRatio; label: string; icon: React.ReactNode }[] = [
  { ratio: "9:16", label: "9:16 Vertical (TikTok/Reels)", icon: <DeviceMobile size={18} weight="regular" /> },
  { ratio: "16:9", label: "16:9 Landscape (YouTube)", icon: <Monitor size={18} weight="regular" /> },
  { ratio: "1:1", label: "1:1 Square (Instagram)", icon: <Square size={18} weight="regular" /> },
  { ratio: "4:5", label: "4:5 Portrait (Social)", icon: <DeviceMobile size={18} weight="regular" /> },
  { ratio: "21:9", label: "21:9 Cinema (Ultrawide)", icon: <FilmStrip size={18} weight="regular" /> },
];

export function MobileToolDock({
  onMediaSelected,
  onAddText,
  videoAssets,
  onAddVideo,
}: MobileToolDockProps) {
  const [activeSheet, setActiveSheet] = useState<MobileSheetType>("none");
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);

  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClip = useEditorStore((state) =>
    selectedClipId ? state.clips[selectedClipId] : null
  );
  const aspectRatio = useEditorStore((state) => state.aspectRatio);
  const setAspectRatio = useEditorStore((state) => state.setAspectRatio);

  const handleSplit = () => {
    SplitProcessor.splitAtCurrentTime();
    setActiveSheet("none");
  };

  const handleDuplicate = () => {
    if (selectedClipId) DuplicateProcessor.duplicateClip(selectedClipId);
    setActiveSheet("none");
  };

  const handleDelete = () => {
    if (selectedClipId) DeleteProcessor.deleteClip(selectedClipId);
    setActiveSheet("none");
  };

  const handleReverse = () => {
    if (selectedClipId) ReverseProcessor.toggleReverseClip(selectedClipId);
  };

  const handleFreeze = () => {
    FreezeProcessor.freezeAtCurrentTime(3.0);
    setActiveSheet("none");
  };

  const renderSheetTitle = () => {
    switch (activeSheet) {
      case "edit":
        return (
          <>
            <Scissors size={15} weight="bold" />
            <span>Clip Editing Tools</span>
          </>
        );
      case "media":
        return (
          <>
            <FolderSimple size={15} weight="bold" />
            <span>Import & Media</span>
          </>
        );
      case "audio":
        return (
          <>
            <MusicNotes size={15} weight="bold" />
            <span>Audio Controls</span>
          </>
        );
      case "text":
        return (
          <>
            <TextT size={15} weight="bold" />
            <span>Text Overlays</span>
          </>
        );
      default:
        return (
          <>
            <Crop size={15} weight="bold" />
            <span>Canvas Aspect Ratio</span>
          </>
        );
    }
  };

  return (
    <>
      {/* Fixed Bottom Dock Bar */}
      <nav className="mobile-tool-dock" aria-label="Mobile Editing Tools">
        <button
          type="button"
          className={`dock-btn ${activeSheet === "edit" || selectedClip ? "highlight" : ""}`}
          onClick={() => setActiveSheet("edit")}
        >
          <span className="dock-icon">
            <Scissors size={18} weight="regular" />
          </span>
          <span className="dock-label">Edit</span>
        </button>

        <button
          type="button"
          className={`dock-btn ${activeSheet === "media" ? "active" : ""}`}
          onClick={() => setActiveSheet("media")}
        >
          <span className="dock-icon">
            <FolderSimple size={18} weight="regular" />
          </span>
          <span className="dock-label">Media</span>
        </button>

        <button
          type="button"
          className={`dock-btn ${activeSheet === "audio" ? "active" : ""}`}
          onClick={() => setActiveSheet("audio")}
        >
          <span className="dock-icon">
            <MusicNotes size={18} weight="regular" />
          </span>
          <span className="dock-label">Audio</span>
        </button>

        <button
          type="button"
          className={`dock-btn ${activeSheet === "text" ? "active" : ""}`}
          onClick={() => setActiveSheet("text")}
        >
          <span className="dock-icon">
            <TextT size={18} weight="regular" />
          </span>
          <span className="dock-label">Text</span>
        </button>

        <button
          type="button"
          className="dock-btn"
          onClick={() => setTransitionOpen(true)}
        >
          <span className="dock-icon">
            <Sparkle size={18} weight="regular" />
          </span>
          <span className="dock-label">Transition</span>
        </button>

        <button
          type="button"
          className={`dock-btn ${activeSheet === "ratio" ? "active" : ""}`}
          onClick={() => setActiveSheet("ratio")}
        >
          <span className="dock-icon">
            <Crop size={18} weight="regular" />
          </span>
          <span className="dock-label">Ratio</span>
        </button>

        <button
          type="button"
          className="dock-btn"
          onClick={() => setCoverOpen(true)}
        >
          <span className="dock-icon">
            <ImageSquare size={18} weight="regular" />
          </span>
          <span className="dock-label">Cover</span>
        </button>
      </nav>

      {/* Slide-Up Bottom Drawer Sheet */}
      {activeSheet !== "none" && (
        <div className="mobile-drawer-overlay" onClick={() => setActiveSheet("none")}>
          <div
            className="mobile-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="drawer-header">
              <span className="drawer-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {renderSheetTitle()}
              </span>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setActiveSheet("none")}
              >
                Done
              </button>
            </div>

            {/* Drawer Body Content */}
            <div className="drawer-body">
              {/* EDIT SHEET */}
              {activeSheet === "edit" && (
                <div className="drawer-actions-grid">
                  <button
                    type="button"
                    className="drawer-action-btn"
                    onClick={handleSplit}
                  >
                    <span className="btn-icon">
                      <Scissors size={20} weight="regular" />
                    </span>
                    <span className="btn-text">Split</span>
                    <span className="btn-sub">Cut at playhead</span>
                  </button>

                  <button
                    type="button"
                    className="drawer-action-btn"
                    onClick={handleDuplicate}
                    disabled={!selectedClipId}
                  >
                    <span className="btn-icon">
                      <Copy size={20} weight="regular" />
                    </span>
                    <span className="btn-text">Duplicate</span>
                    <span className="btn-sub">Clone selected clip</span>
                  </button>

                  <button
                    type="button"
                    className="drawer-action-btn"
                    onClick={handleReverse}
                    disabled={!selectedClipId}
                  >
                    <span className="btn-icon">
                      <ArrowsClockwise size={20} weight="regular" />
                    </span>
                    <span className="btn-text">Reverse</span>
                    <span className="btn-sub">
                      {selectedClip?.reverse ? "Status: ON" : "Status: OFF"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className="drawer-action-btn"
                    onClick={handleFreeze}
                    disabled={!selectedClipId}
                  >
                    <span className="btn-icon">
                      <Snowflake size={20} weight="regular" />
                    </span>
                    <span className="btn-text">Freeze</span>
                    <span className="btn-sub">+3s freeze frame</span>
                  </button>

                  <button
                    type="button"
                    className="drawer-action-btn delete-btn"
                    onClick={handleDelete}
                    disabled={!selectedClipId}
                  >
                    <span className="btn-icon">
                      <Trash size={20} weight="regular" />
                    </span>
                    <span className="btn-text">Delete</span>
                    <span className="btn-sub">Remove clip</span>
                  </button>
                </div>
              )}

              {/* MEDIA SHEET */}
              {activeSheet === "media" && (
                <div className="drawer-media-wrap">
                  <label className="drawer-upload-card">
                    <input
                      type="file"
                      accept="video/*,image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          onMediaSelected(file);
                          setActiveSheet("none");
                        }
                      }}
                    />
                    <span className="upload-icon">
                      <Plus size={22} weight="bold" />
                    </span>
                    <strong>Upload from Device</strong>
                    <span>Videos and photos</span>
                  </label>

                  {videoAssets.length > 0 && (
                    <div className="drawer-asset-list">
                      <div className="drawer-section-title">Imported Clips ({videoAssets.length})</div>
                      {videoAssets.map((asset) => (
                        <div key={asset.id} className="drawer-asset-item">
                          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <VideoCamera size={14} weight="regular" />
                            <span>{asset.name}</span>
                          </span>
                          <button
                            type="button"
                            className="asset-quick-add"
                            onClick={() => {
                              onAddVideo(asset);
                              setActiveSheet("none");
                            }}
                          >
                            + Add to Timeline
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* AUDIO SHEET */}
              {activeSheet === "audio" && (
                <div className="drawer-audio-wrap">
                  <label className="drawer-upload-card">
                    <input
                      type="file"
                      accept="audio/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          onMediaSelected(file);
                          setActiveSheet("none");
                        }
                      }}
                    />
                    <span className="upload-icon">
                      <MusicNotes size={22} weight="bold" />
                    </span>
                    <strong>Import Sound / Music</strong>
                    <span>MP3, WAV, AAC</span>
                  </label>
                </div>
              )}

              {/* TEXT SHEET */}
              {activeSheet === "text" && (
                <div className="drawer-text-wrap">
                  <button
                    type="button"
                    className="drawer-text-btn"
                    onClick={() => {
                      onAddText();
                      setActiveSheet("none");
                    }}
                  >
                    <TextT size={16} weight="bold" />
                    <span>+ Add Default Title</span>
                  </button>
                  <button
                    type="button"
                    className="drawer-text-btn"
                    onClick={() => {
                      onAddText();
                      setActiveSheet("none");
                    }}
                  >
                    <ChatText size={16} weight="regular" />
                    <span>+ Add Subtitle / Lower Third</span>
                  </button>
                </div>
              )}

              {/* RATIO SHEET */}
              {activeSheet === "ratio" && (
                <div className="drawer-ratio-list">
                  {RATIO_PRESETS.map((p) => (
                    <div
                      key={p.ratio}
                      className={`drawer-ratio-item ${aspectRatio === p.ratio ? "active" : ""}`}
                      onClick={() => {
                        setAspectRatio(p.ratio);
                        setActiveSheet("none");
                      }}
                    >
                      <span className="r-icon">{p.icon}</span>
                      <span className="r-label">{p.label}</span>
                      {aspectRatio === p.ratio && (
                        <span className="r-check">
                          <Check size={14} weight="bold" />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transition Catalog Modal */}
      <TransitionModal
        clipId={selectedClipId || "video-main"}
        isOpen={transitionOpen}
        onClose={() => setTransitionOpen(false)}
      />

      {/* Cover Snapshot Modal */}
      <CoverModal
        clipId={selectedClipId || undefined}
        isOpen={coverOpen}
        onClose={() => setCoverOpen(false)}
      />
    </>
  );
}
