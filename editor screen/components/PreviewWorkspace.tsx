import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SkipBack,
  Play,
  Pause,
  SkipForward,
  ImageSquare,
  CornersOut,
} from "@phosphor-icons/react";
import { formatVideoTime } from "./utils/formatVideoTime";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";
import { useEditorStore } from "../store/editor.store";
import { WebGLRenderer } from "../renderer/webgl.renderer";
import { AudioEngine } from "../renderer/audio.engine";
import { evaluateClipTransforms } from "../renderer/keyframe.interpolator";
import { RatioProcessor, RatioSelector } from "../plugins/ratio";
import { CoverModal } from "../plugins/cover";
import { ClipModel } from "../types/editor.types";
import {
  computeSourceTime,
  isImageMedia,
  resolveActiveClips,
  syncVideoElement,
} from "./utils/previewResolver";

interface PreviewWorkspaceProps {
  media: { url: string; type: "video" | "image"; name: string } | null;
  onPlaybackControllerReady: (controller: { isPlaying: boolean; toggle: () => void }) => void;
  textElements: TextElement[];
  onCurrentTimeChange: (time: number) => void;
}

const hiddenVideoStyle: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  opacity: 0.001,
  pointerEvents: "none",
  zIndex: -100,
};

function parseHexColor(hex?: string): [number, number, number] {
  if (!hex) return [0, 0, 0];
  const cleaned = hex.replace("#", "");
  if (cleaned.length === 6) {
    return [
      parseInt(cleaned.slice(0, 2), 16) / 255,
      parseInt(cleaned.slice(2, 4), 16) / 255,
      parseInt(cleaned.slice(4, 6), 16) / 255,
    ];
  }
  return [0, 0, 0];
}

export function PreviewWorkspace({
  media,
  onPlaybackControllerReady,
  textElements,
}: PreviewWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoPrimaryRef = useRef<HTMLVideoElement>(null);
  const videoSecondaryRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLVideoElement>(null);
  const imagePrimaryRef = useRef<HTMLImageElement>(null);
  const imageSecondaryRef = useRef<HTMLImageElement>(null);
  const imageOverlayRef = useRef<HTMLImageElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);

  const [coverModalOpen, setCoverModalOpen] = useState(false);
  const [audioPlaybackError, setAudioPlaybackError] = useState<string | null>(null);

  const storeTracks = useEditorStore((state) => state.tracks);
  const storeClips = useEditorStore((state) => state.clips);
  const storeCurrentTime = useEditorStore((state) => state.currentTime);
  const storeDuration = useEditorStore((state) => state.duration);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const aspectRatio = useEditorStore((state) => state.aspectRatio);

  // 1. Resolve active clips
  const {
    activeVideoClip,
    activeClipIndex,
    nextVideoClip,
    transitionInfo,
    activeOverlayClip,
    videoClips,
  } = useMemo(
    () => resolveActiveClips(storeTracks, storeClips, storeCurrentTime),
    [storeTracks, storeClips, storeCurrentTime]
  );

  const activeMediaUrl =
    activeVideoClip?.mediaUrl || activeOverlayClip?.mediaUrl || media?.url || null;

  // Helper to retrieve loaded texture source for Slot A or Slot B
  const getSlotSource = useCallback(
    (slot: "A" | "B", clip: ClipModel | null): TexImageSource | null => {
      if (!clip || !clip.mediaUrl) return null;
      const isImg = clip.mediaType === "image" || isImageMedia(clip.mediaUrl, clip.name);
      if (isImg) {
        const img = slot === "A" ? imagePrimaryRef.current : imageSecondaryRef.current;
        return img && img.complete && img.naturalWidth > 0 ? img : null;
      }
      const vid = slot === "A" ? videoPrimaryRef.current : videoSecondaryRef.current;
      return vid && vid.readyState >= 2 ? vid : null;
    },
    []
  );

  // 2. WebGL Paint Routine
  const renderFrame = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.clear(0.04, 0.05, 0.07, 1.0);

    // 2A. Render transition if active
    if (transitionInfo && activeVideoClip && nextVideoClip) {
      const outgoingSlot = activeClipIndex % 2 === 0 ? "A" : "B";
      const incomingSlot = activeClipIndex % 2 === 0 ? "B" : "A";
      const src1 = getSlotSource(outgoingSlot, activeVideoClip);
      const src2 = getSlotSource(incomingSlot, nextVideoClip);

      if (src1 && src2) {
        const dipRgb = parseHexColor(transitionInfo.color);
        renderer.renderTransition(
          src1,
          src2,
          transitionInfo.typeIndex,
          transitionInfo.progress,
          dipRgb
        );
      } else if (src1) {
        const local = Math.max(0, storeCurrentTime - activeVideoClip.start);
        const tf = evaluateClipTransforms(activeVideoClip, local);
        renderer.renderLayer(src1, tf);
      } else if (src2) {
        const local = Math.max(0, storeCurrentTime - nextVideoClip.start);
        const tf = evaluateClipTransforms(nextVideoClip, local);
        renderer.renderLayer(src2, tf);
      }
    } else if (activeVideoClip && activeClipIndex !== -1) {
      // 2B. Normal single-layer playback: read active slot
      const activeSlot = activeClipIndex % 2 === 0 ? "A" : "B";
      let src = getSlotSource(activeSlot, activeVideoClip);

      // Fallback: If active slot is still switching, check if other slot has this clip ready
      if (!src) {
        const otherSlot = activeSlot === "A" ? "B" : "A";
        src = getSlotSource(otherSlot, activeVideoClip);
      }

      if (src) {
        const local = Math.max(0, storeCurrentTime - activeVideoClip.start);
        const tf = evaluateClipTransforms(activeVideoClip, local);
        renderer.renderLayer(src, tf);
      }
    } else {
      // In a gap or outside clips: background remains black
    }

    // 2C. Render overlay (PIP) layer
    if (activeOverlayClip && activeOverlayClip.mediaUrl) {
      const isOverlayImg =
        activeOverlayClip.mediaType === "image" ||
        isImageMedia(activeOverlayClip.mediaUrl, activeOverlayClip.name);
      const vo = videoOverlayRef.current;
      const imgo = imageOverlayRef.current;
      const srcOverlay: TexImageSource | null = isOverlayImg
        ? imgo && imgo.complete && imgo.naturalWidth > 0
          ? imgo
          : null
        : vo && vo.readyState >= 2
        ? vo
        : null;

      if (srcOverlay) {
        const local = Math.max(0, storeCurrentTime - activeOverlayClip.start);
        const tf = evaluateClipTransforms(activeOverlayClip, local);
        renderer.renderLayer(srcOverlay, tf);
      }
    }
  }, [
    activeVideoClip,
    activeClipIndex,
    nextVideoClip,
    activeOverlayClip,
    transitionInfo,
    storeCurrentTime,
    getSlotSource,
  ]);

  // Callback ref to reliably bind WebGLRenderer whenever <canvas> is mounted in the DOM
  const initRenderer = useCallback(
    (canvas: HTMLCanvasElement | null) => {
      canvasRef.current = canvas;
      if (canvas) {
        if (!rendererRef.current) {
          rendererRef.current = new WebGLRenderer(canvas);
        }
        const dims = RatioProcessor.getDimensions(useEditorStore.getState().aspectRatio);
        rendererRef.current.resize(dims.width, dims.height);
        renderFrame();
      } else {
        rendererRef.current?.destroy();
        rendererRef.current = null;
      }
    },
    [renderFrame]
  );

  // Update canvas resolution and repaint when aspect ratio or active media changes
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new WebGLRenderer(canvasRef.current);
    }
    const dims = RatioProcessor.getDimensions(aspectRatio);
    rendererRef.current?.resize(dims.width, dims.height);
    renderFrame();
  }, [activeMediaUrl, aspectRatio, renderFrame]);

  useEffect(() => {
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audioEngine = new AudioEngine(setAudioPlaybackError);
    const unsubscribe = useEditorStore.subscribe((state) => {
      audioEngine.handleStateChange(state);
    });
    audioEngine.handleStateChange(useEditorStore.getState());

    return () => {
      unsubscribe();
      void audioEngine.destroy().catch((error) => {
        console.error("Unable to cleanly close the audio engine.", error);
      });
    };
  }, []);

  // Keep ref of renderFrame so playback loop does NOT re-initialize on every tick
  const renderFrameRef = useRef(renderFrame);
  useEffect(() => {
    renderFrameRef.current = renderFrame;
  }, [renderFrame]);

  // 3. Master timeline playback loop (rAF) - Runs continuously without tearing down on each frame
  useEffect(() => {
    if (!isPlaying) {
      videoPrimaryRef.current?.pause();
      videoSecondaryRef.current?.pause();
      videoOverlayRef.current?.pause();
      return;
    }

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const state = useEditorStore.getState();
      const deltaSec = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const nextTime = state.currentTime + deltaSec;

      if (nextTime >= state.duration) {
        state.setIsPlaying(false);
        state.setCurrentTime(0, false);
        return;
      }

      state.setCurrentTime(nextTime, false);
      renderFrameRef.current();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // Helper to synchronize a slot (A or B) with its target clip
  const syncSlot = useCallback(
    (
      clip: ClipModel | null,
      video: HTMLVideoElement | null,
      image: HTMLImageElement | null,
      shouldPlay: boolean,
      currentTime: number,
      transStart?: number
    ) => {
      if (!clip || !clip.mediaUrl) {
        if (video && !video.paused) video.pause();
        return;
      }

      const isImg = clip.mediaType === "image" || isImageMedia(clip.mediaUrl, clip.name);
      if (isImg) {
        if (video && !video.paused) video.pause();
        if (image && image.src !== clip.mediaUrl && !image.src.endsWith(clip.mediaUrl)) {
          image.src = clip.mediaUrl;
        }
      } else {
        const targetSourceTime = computeSourceTime(clip, currentTime, transStart);
        syncVideoElement(video, clip.mediaUrl, targetSourceTime, shouldPlay, clip.speed ?? 1.0);
      }
    },
    []
  );

  // 4. Ping-Pong Dual-Slot Synchronization: slot A (even) vs slot B (odd)
  useEffect(() => {
    const v1 = videoPrimaryRef.current;
    const v2 = videoSecondaryRef.current;
    const vo = videoOverlayRef.current;
    const img1 = imagePrimaryRef.current;
    const img2 = imageSecondaryRef.current;
    const imgo = imageOverlayRef.current;

    let clipForSlotA: ClipModel | null = null;
    let clipForSlotB: ClipModel | null = null;
    let isSlotAPlaying = false;
    let isSlotBPlaying = false;
    let transStartA: number | undefined;
    let transStartB: number | undefined;

    if (transitionInfo && activeVideoClip && nextVideoClip) {
      // Transition in progress: both slots active and playing
      if (activeClipIndex % 2 === 0) {
        clipForSlotA = activeVideoClip;
        clipForSlotB = nextVideoClip;
        const trans = activeVideoClip.transition || nextVideoClip.transition;
        const transDur = trans?.duration ?? 0.5;
        transStartB = nextVideoClip.start - transDur;
      } else {
        clipForSlotB = activeVideoClip;
        clipForSlotA = nextVideoClip;
        const trans = activeVideoClip.transition || nextVideoClip.transition;
        const transDur = trans?.duration ?? 0.5;
        transStartA = nextVideoClip.start - transDur;
      }
      isSlotAPlaying = isPlaying;
      isSlotBPlaying = isPlaying;
    } else if (activeVideoClip && activeClipIndex !== -1) {
      // Single clip active: active slot plays, other slot preloads next clip
      if (activeClipIndex % 2 === 0) {
        clipForSlotA = activeVideoClip;
        isSlotAPlaying = isPlaying;
        clipForSlotB = nextVideoClip;
        isSlotBPlaying = false;
      } else {
        clipForSlotB = activeVideoClip;
        isSlotBPlaying = isPlaying;
        clipForSlotA = nextVideoClip;
        isSlotAPlaying = false;
      }
    } else {
      // In a gap or outside clips: preload upcoming clip
      isSlotAPlaying = false;
      isSlotBPlaying = false;
      if (nextVideoClip) {
        const nextIndex = videoClips.indexOf(nextVideoClip);
        if (nextIndex % 2 === 0) {
          clipForSlotA = nextVideoClip;
        } else {
          clipForSlotB = nextVideoClip;
        }
      }
    }

    // Sync Slot A (v1 / img1)
    syncSlot(clipForSlotA, v1, img1, isSlotAPlaying, storeCurrentTime, transStartA);

    // Sync Slot B (v2 / img2)
    syncSlot(clipForSlotB, v2, img2, isSlotBPlaying, storeCurrentTime, transStartB);

    // Sync Overlay Slot (vo / imgo)
    syncSlot(
      activeOverlayClip,
      vo,
      imgo,
      isPlaying && Boolean(activeOverlayClip),
      storeCurrentTime
    );

    renderFrame();
  }, [
    storeCurrentTime,
    activeVideoClip,
    activeClipIndex,
    nextVideoClip,
    transitionInfo,
    activeOverlayClip,
    videoClips,
    isPlaying,
    syncSlot,
    renderFrame,
  ]);

  const togglePlayback = useCallback(() => setIsPlaying(!isPlaying), [isPlaying, setIsPlaying]);

  useEffect(() => {
    onPlaybackControllerReady({ isPlaying, toggle: togglePlayback });
  }, [isPlaying, onPlaybackControllerReady, togglePlayback]);

  const cssRatio = RatioProcessor.getCssRatio(aspectRatio);
  const hasActiveMedia = Boolean(activeVideoClip || activeOverlayClip || media?.url || storeDuration > 0);

  return (
    <section className="preview-workspace">
      <div className="preview-canvas">
        {audioPlaybackError && (
          <div className="audio-playback-error" role="alert">
            Audio playback issue: {audioPlaybackError}
          </div>
        )}
        {hasActiveMedia ? (
          <div
            className="preview-art"
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              maxWidth: "100%",
              maxHeight: "100%",
              aspectRatio: cssRatio,
              background: "#000",
              borderRadius: "4px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              transition: "aspect-ratio 0.25s ease",
            }}
          >
            {/* Hidden media elements feeding WebGL textures */}
            <video
              ref={videoPrimaryRef}
              playsInline
              preload="auto"
              muted
              crossOrigin="anonymous"
              style={hiddenVideoStyle}
              onLoadedData={renderFrame}
              onCanPlay={renderFrame}
              onSeeked={renderFrame}
              onTimeUpdate={renderFrame}
              onPlaying={renderFrame}
            />
            <video
              ref={videoSecondaryRef}
              playsInline
              preload="auto"
              muted
              crossOrigin="anonymous"
              style={hiddenVideoStyle}
              onLoadedData={renderFrame}
              onCanPlay={renderFrame}
              onSeeked={renderFrame}
              onTimeUpdate={renderFrame}
              onPlaying={renderFrame}
            />
            <video
              ref={videoOverlayRef}
              playsInline
              preload="auto"
              muted
              crossOrigin="anonymous"
              style={hiddenVideoStyle}
              onLoadedData={renderFrame}
              onCanPlay={renderFrame}
              onSeeked={renderFrame}
              onTimeUpdate={renderFrame}
              onPlaying={renderFrame}
            />
            <img
              ref={imagePrimaryRef}
              alt=""
              crossOrigin="anonymous"
              style={hiddenVideoStyle}
              onLoad={renderFrame}
            />
            <img
              ref={imageSecondaryRef}
              alt=""
              crossOrigin="anonymous"
              style={hiddenVideoStyle}
              onLoad={renderFrame}
            />
            <img
              ref={imageOverlayRef}
              alt=""
              crossOrigin="anonymous"
              style={hiddenVideoStyle}
              onLoad={renderFrame}
            />

            {/* Main WebGL canvas */}
            <canvas
              ref={initRenderer}
              width={1280}
              height={720}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />

            {/* Text overlays */}
            {textElements
              .filter((e) => storeCurrentTime >= e.start && storeCurrentTime < e.start + e.duration)
              .map((e) => (
                <div
                  key={e.id}
                  className="text-overlay"
                  style={{
                    position: "absolute",
                    left: `${e.x}%`,
                    top: `${e.y}%`,
                    color: e.color,
                    fontSize: `${e.fontSize}px`,
                    fontWeight: e.bold ? 700 : 400,
                    fontStyle: e.italic ? "italic" : "normal",
                    textAlign: e.alignment,
                  }}
                >
                  {e.content}
                </div>
              ))}
          </div>
        ) : (
          <div className="preview-empty">
            <strong>Import media to start editing</strong>
            <span>Choose a video or image from your media library.</span>
          </div>
        )}
      </div>

      {/* Integrated CapCut-style Player Transport Bar */}
      <div className="preview-status-bar">
        {/* Left: Monospace Timecode */}
        <div className="preview-timecode-badge">
          <span className="timecode-current">{formatVideoTime(storeCurrentTime)}</span>
          <span className="timecode-divider">/</span>
          <span className="timecode-total">{formatVideoTime(storeDuration)}</span>
        </div>

        {/* Center: Frame Step & Play Transport */}
        <div className="preview-transport-center">
          <button
            type="button"
            className="transport-btn"
            title="Step back 1 frame (30fps)"
            onClick={() => {
              const t = Math.max(0, storeCurrentTime - 1 / 30);
              useEditorStore.getState().setCurrentTime(t);
            }}
            aria-label="Step frame backward"
          >
            <SkipBack size={14} weight="fill" />
          </button>

          <button
            type="button"
            className={`transport-play-btn ${isPlaying ? "playing" : ""}`}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
            onClick={togglePlayback}
            aria-label={isPlaying ? "Pause video" : "Play video"}
          >
            {isPlaying ? (
              <Pause size={15} weight="fill" />
            ) : (
              <Play size={15} weight="fill" style={{ marginLeft: "2px" }} />
            )}
          </button>

          <button
            type="button"
            className="transport-btn"
            title="Step forward 1 frame (30fps)"
            onClick={() => {
              const t = Math.min(storeDuration, storeCurrentTime + 1 / 30);
              useEditorStore.getState().setCurrentTime(t);
            }}
            aria-label="Step frame forward"
          >
            <SkipForward size={14} weight="fill" />
          </button>
        </div>

        {/* Right: Ratio, Cover, Fullscreen */}
        <div className="preview-controls-right">
          <RatioSelector />

          <button
            type="button"
            className="preview-cover-btn"
            title="Snapshot Project Cover Poster"
            onClick={() => setCoverModalOpen(true)}
          >
            <ImageSquare size={14} />
            <span>Cover</span>
          </button>

          <button
            type="button"
            className="preview-fullscreen-btn"
            title="Toggle Fullscreen"
            onClick={() => {
              if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
              } else {
                canvasRef.current?.requestFullscreen?.().catch(() => {});
              }
            }}
            aria-label="Fullscreen"
          >
            <CornersOut size={16} />
          </button>
        </div>
      </div>

      <CoverModal
        isOpen={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        canvasRef={canvasRef}
        clipId={activeVideoClip?.id || activeOverlayClip?.id}
      />
    </section>
  );
}
