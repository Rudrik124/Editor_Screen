import React, { useState } from "react";
import {
  FolderSimple,
  MusicNotes,
  TextT,
  Sparkle,
  Crop,
  UploadSimple,
  VideoCamera,
  DeviceMobile,
  Monitor,
  Square,
  FrameCorners,
  FilmStrip,
  Play,
  Microphone,
  Plus,
  WarningCircle,
  Check,
  ArrowsLeftRight,
  SunHorizon,
  ArrowFatLineLeft,
  ArrowFatLineRight,
  MagnifyingGlassPlus,
  Lightning,
} from "@phosphor-icons/react";
import { VideoAsset } from "../types/editor.types";
import { useEditorStore } from "../store/editor.store";
import { AspectRatio } from "../types/editor.types";
import { TransitionModal } from "../plugins/transition";

interface MediaLibraryProps {
  onMediaSelected: (file: File) => void;
  error?: string | null;
  videoAssets?: VideoAsset[];
  onAddVideo?: (asset: VideoAsset) => void;
  onAddText?: () => void;
}

type NavTab = "media" | "audio" | "text" | "transitions" | "canvas";

const SAMPLE_MEDIA = [
  {
    name: "Nature Drone Footage",
    duration: "00:15",
    type: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  },
  {
    name: "Urban Night Lights",
    duration: "00:12",
    type: "video",
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  },
];

export function MediaLibrary({
  onMediaSelected,
  error,
  videoAssets = [],
  onAddVideo,
  onAddText,
}: MediaLibraryProps) {
  const [activeTab, setActiveTab] = useState<NavTab>("media");
  const [transitionModalOpen, setTransitionModalOpen] = useState(false);

  const aspectRatio = useEditorStore((state) => state.aspectRatio);
  const setAspectRatio = useEditorStore((state) => state.setAspectRatio);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectedClip = useEditorStore((state) =>
    selectedClipId ? state.clips[selectedClipId] : null
  );

  const loadSampleVideo = async (url: string, name: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `${name}.mp4`, { type: "video/mp4" });
      onMediaSelected(file);
    } catch {
      const file = new File([new Blob()], `${name}.mp4`, { type: "video/mp4" });
      onMediaSelected(file);
    }
  };

  const RATIO_PRESETS: { ratio: AspectRatio; label: string; desc: string; icon: React.ReactNode }[] = [
    { ratio: "16:9", label: "16:9 Landscape", desc: "YouTube, TV, Desktop", icon: <Monitor size={18} /> },
    { ratio: "9:16", label: "9:16 Vertical", desc: "TikTok, Reels, Shorts", icon: <DeviceMobile size={18} /> },
    { ratio: "1:1", label: "1:1 Square", desc: "Instagram Post", icon: <Square size={18} /> },
    { ratio: "4:5", label: "4:5 Portrait", desc: "Instagram Feed, Social", icon: <FrameCorners size={18} /> },
    { ratio: "21:9", label: "21:9 Ultrawide", desc: "Cinematic Anamorphic", icon: <FilmStrip size={18} /> },
  ];

  return (
    <aside className="media-library panel">
      {/* Top Feature Nav Tabs */}
      <div className="library-tabs">
        <button
          type="button"
          className={`library-tab ${activeTab === "media" ? "active" : ""}`}
          onClick={() => setActiveTab("media")}
          title="Import and browse media"
        >
          <FolderSimple size={15} />
          <span>Media</span>
        </button>
        <button
          type="button"
          className={`library-tab ${activeTab === "audio" ? "active" : ""}`}
          onClick={() => setActiveTab("audio")}
          title="Audio and sound effects"
        >
          <MusicNotes size={15} />
          <span>Audio</span>
        </button>
        <button
          type="button"
          className={`library-tab ${activeTab === "text" ? "active" : ""}`}
          onClick={() => setActiveTab("text")}
          title="Text templates and titles"
        >
          <TextT size={15} />
          <span>Text</span>
        </button>
        <button
          type="button"
          className={`library-tab ${activeTab === "transitions" ? "active" : ""}`}
          onClick={() => setActiveTab("transitions")}
          title="Video transitions"
        >
          <Sparkle size={15} />
          <span>Effects</span>
        </button>
        <button
          type="button"
          className={`library-tab ${activeTab === "canvas" ? "active" : ""}`}
          onClick={() => setActiveTab("canvas")}
          title="Aspect ratio and canvas settings"
        >
          <Crop size={15} />
          <span>Canvas</span>
        </button>
      </div>

      <div className="library-content-body">
        {/* TAB 1: MEDIA */}
        {activeTab === "media" && (
          <div className="tab-pane media-pane">
            <div className="media-import-card">
              <label className="import-drop-zone">
                <input
                  className="media-file-input"
                  type="file"
                  accept="video/*,image/*,audio/*"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onMediaSelected(file);
                    event.target.value = "";
                  }}
                />
                <div className="import-icon-wrap">
                  <UploadSimple size={22} weight="bold" />
                </div>
                <strong className="import-label">Import Media</strong>
                <span className="import-hint">MP4, MOV, WebM, PNG, JPG</span>
              </label>
            </div>

            {error && (
              <div className="library-error-banner">
                <WarningCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Imported Assets Section */}
            {videoAssets.length > 0 && (
              <div className="imported-assets-section">
                <div className="section-title">Project Assets ({videoAssets.length})</div>
                <div className="asset-grid">
                  {videoAssets.map((asset) => (
                    <div key={asset.id} className="asset-card">
                      <div className="asset-thumb-box">
                        {asset.thumbnails && asset.thumbnails[0] ? (
                          <img src={asset.thumbnails[0]} alt={asset.name} />
                        ) : (
                          <div className="asset-thumb-fallback">
                            <VideoCamera size={18} />
                          </div>
                        )}
                        <span className="asset-duration-badge">{asset.duration.toFixed(1)}s</span>
                      </div>
                      <div className="asset-meta">
                        <span className="asset-name" title={asset.name}>{asset.name}</span>
                        {onAddVideo && (
                          <button
                            type="button"
                            className="asset-add-btn"
                            title="Add to timeline"
                            onClick={() => onAddVideo(asset)}
                          >
                            <Plus size={12} weight="bold" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Clips for quick testing */}
            <div className="sample-clips-section">
              <div className="section-title">Quick Samples</div>
              <div className="sample-grid">
                {SAMPLE_MEDIA.map((sample) => (
                  <div key={sample.name} className="sample-card">
                    <div className="sample-info">
                      <span className="sample-title">{sample.name}</span>
                      <span className="sample-time">{sample.duration}</span>
                    </div>
                    <button
                      type="button"
                      className="sample-load-btn"
                      onClick={() => loadSampleVideo(sample.url, sample.name)}
                    >
                      <Plus size={11} weight="bold" />
                      <span>Use</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: AUDIO */}
        {activeTab === "audio" && (
          <div className="tab-pane audio-pane">
            <div className="section-title">Audio Tools</div>
            <div className="audio-actions-list">
              <label className="audio-import-btn">
                <input
                  className="media-file-input"
                  type="file"
                  accept="audio/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onMediaSelected(file);
                    e.target.value = "";
                  }}
                />
                <MusicNotes size={16} />
                <span>Import Audio File</span>
              </label>

              <button
                type="button"
                className="audio-preset-btn"
                onClick={() => {
                  if (onAddText) onAddText();
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Microphone size={16} />
                  <span>Record Voiceover</span>
                </div>
                <span className="audio-tag">Mic</span>
              </button>
            </div>

            <div className="section-title" style={{ marginTop: "16px" }}>BGM & Sound Effects</div>
            <div className="audio-preset-list">
              {[
                { name: "Upbeat Lo-Fi Beat", duration: "1:45", genre: "Chill" },
                { name: "Cinematic Orchestral Rise", duration: "0:30", genre: "Trailer" },
                { name: "Camera Shutter Sound FX", duration: "0:02", genre: "SFX" },
                { name: "Swoosh Transition FX", duration: "0:01", genre: "SFX" },
              ].map((sound) => (
                <div key={sound.name} className="sound-item">
                  <div className="sound-item-left">
                    <span className="sound-icon">
                      <Play size={10} weight="fill" />
                    </span>
                    <div>
                      <div className="sound-name">{sound.name}</div>
                      <div className="sound-sub">{sound.genre} • {sound.duration}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="sound-add-btn"
                    onClick={() => {
                      alert(`Added "${sound.name}" to audio track.`);
                    }}
                  >
                    <Plus size={11} weight="bold" />
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: TEXT */}
        {activeTab === "text" && (
          <div className="tab-pane text-pane">
            <div className="section-title">Add Text Overlay</div>
            <div className="text-templates-grid">
              <button
                type="button"
                className="text-preset-card heading"
                onClick={() => onAddText?.()}
              >
                <span className="preset-preview-title">HEADING</span>
                <span className="preset-name">+ Add Heading</span>
              </button>

              <button
                type="button"
                className="text-preset-card subtitle"
                onClick={() => onAddText?.()}
              >
                <span className="preset-preview-subtitle">Lower Third / Subtitle</span>
                <span className="preset-name">+ Add Subtitle</span>
              </button>

              <button
                type="button"
                className="text-preset-card neon"
                onClick={() => onAddText?.()}
              >
                <span className="preset-preview-neon">NEON VIBE</span>
                <span className="preset-name">+ Neon Style</span>
              </button>

              <button
                type="button"
                className="text-preset-card caption"
                onClick={() => onAddText?.()}
              >
                <span className="preset-preview-caption">Auto Caption Box</span>
                <span className="preset-name">+ Captions</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: TRANSITIONS */}
        {activeTab === "transitions" && (
          <div className="tab-pane transitions-pane">
            <div className="transitions-banner">
              <strong>Seamless Cut Transitions</strong>
              <span>Select two clips on your timeline and apply cinema-grade transitions.</span>
              <button
                type="button"
                className="open-transitions-catalog-btn"
                onClick={() => setTransitionModalOpen(true)}
              >
                <Sparkle size={15} weight="bold" />
                <span>Open Transitions Catalog (20)</span>
              </button>
            </div>

            <div className="section-title">Popular Transitions</div>
            <div className="quick-transitions-grid">
              {[
                { name: "Cross Dissolve", type: "cross_dissolve", icon: <ArrowsLeftRight size={18} /> },
                { name: "Fade Black", type: "fade_to_black", icon: <SunHorizon size={18} /> },
                { name: "Slide Left", type: "slide_left", icon: <ArrowFatLineLeft size={18} /> },
                { name: "Slide Right", type: "slide_right", icon: <ArrowFatLineRight size={18} /> },
                { name: "Zoom In", type: "zoom_in", icon: <MagnifyingGlassPlus size={18} /> },
                { name: "RGB Glitch", type: "glitch", icon: <Lightning size={18} /> },
              ].map((t) => (
                <div
                  key={t.name}
                  className="quick-transition-card"
                  onClick={() => setTransitionModalOpen(true)}
                >
                  <span className="qt-icon">{t.icon}</span>
                  <span className="qt-name">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: CANVAS & RATIO */}
        {activeTab === "canvas" && (
          <div className="tab-pane canvas-pane">
            <div className="section-title">Canvas Aspect Ratio</div>
            <div className="ratio-options-list">
              {RATIO_PRESETS.map((preset) => {
                const isSelected = aspectRatio === preset.ratio;
                return (
                  <div
                    key={preset.ratio}
                    className={`ratio-option-card ${isSelected ? "selected" : ""}`}
                    onClick={() => setAspectRatio(preset.ratio)}
                  >
                    <span className="ratio-icon">{preset.icon}</span>
                    <div className="ratio-info">
                      <div className="ratio-label">{preset.label}</div>
                      <div className="ratio-desc">{preset.desc}</div>
                    </div>
                    {isSelected && (
                      <span className="ratio-check">
                        <Check size={14} weight="bold" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Transition Modal Popup */}
      <TransitionModal
        clipId={selectedClip?.id || "video-main"}
        isOpen={transitionModalOpen}
        onClose={() => setTransitionModalOpen(false)}
      />
    </aside>
  );
}
