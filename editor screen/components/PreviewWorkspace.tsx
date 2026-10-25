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
import { evaluateClipTransforms } from "../renderer/keyframe.interpolator";
import { RatioProcessor, RatioSelector } from "../plugins/ratio";
import { CoverModal } from "../plugins/cover";
import {
  computeSourceTime,
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

export function PreviewWorkspace({
  media,
  onPlaybackControllerReady,
  textElements,
}: PreviewWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoPrimaryRef = useRef<HTMLVideoElement>(null);
  const videoSecondaryRef = useRef<HTMLVideoElement>(null);
  const videoOverlayRef = useRef<HTMLVideoElement>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);

  const [coverModalOpen, setCoverModalOpen] = useState(false);

  const storeTracks = useEditorStore((state) => state.tracks);
  const storeClips = useEditorStore((state) => state.clips);
  const storeCurrentTime = useEditorStore((state) => state.currentTime);
  const storeDuration = useEditorStore((state) => state.duration);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const aspectRatio = useEditorStore((state) => state.aspectRatio);

  // 1. Resolve active clips
  const { activeVideoClip, nextVideoClip, transitionInfo, activeOverlayClip } =
    useMemo(
      () => resolveActiveClips(storeTracks, storeClips, storeCurrentTime),
      [storeTracks, storeClips, storeCurrentTime]
    );

  const activeMediaUrl =
    activeVideoClip?.mediaUrl || activeOverlayClip?.mediaUrl || media?.url || null;

  // 2. WebGL Paint Routine
  const renderFrame = useCallback(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.clear(0.04, 0.05, 0.07, 1.0);

    const v1 = videoPrimaryRef.current;
    const v2 = videoSecondaryRef.current;
    const vo = videoOverlayRef.current;

    // Render primary layer or transition
    if (transitionInfo && v1 && v2 && v1.readyState >= 2 && v2.readyState >= 2) {
      renderer.renderTransition(v1, v2, transitionInfo.typeIndex, transitionInfo.progress);
    } else if (v1 && v1.readyState >= 2) {
      const local = activeVideoClip ? Math.max(0, storeCurrentTime - activeVideoClip.start) : 0;
      const tf = activeVideoClip
        ? evaluateClipTransforms(activeVideoClip, local)
        : { scale: 1.0, opacity: 1.0, positionX: 0, positionY: 0, rotation: 0, volume: 1.0 };
      renderer.renderLayer(v1, tf);
    }

    // Render overlay (PIP) layer
    if (vo && vo.readyState >= 2 && activeOverlayClip) {
      const local = Math.max(0, storeCurrentTime - activeOverlayClip.start);
      const tf = evaluateClipTransforms(activeOverlayClip, local);
      renderer.renderLayer(vo, tf);
    }
  }, [activeVideoClip, activeOverlayClip, transitionInfo, storeCurrentTime]);

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

  // 3. Master timeline playback loop (rAF)
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
      const v1 = videoPrimaryRef.current;
      let nextTime: number;

      if (v1 && !v1.paused && !v1.seeking && activeVideoClip && !activeVideoClip.isFrozen && !activeVideoClip.reverse) {
        const inPoint = activeVideoClip.inPoint ?? 0;
        const speed = activeVideoClip.speed ?? 1.0;
        const local = Math.max(0, (v1.currentTime - inPoint) / speed);
        nextTime = activeVideoClip.start + local;
      } else {
        const deltaSec = (now - lastTime) / 1000;
        nextTime = state.currentTime + deltaSec;
      }
      lastTime = now;

      if (nextTime >= state.duration) {
        state.setIsPlaying(false);
        state.setCurrentTime(0);
        return;
      }

      state.setCurrentTime(nextTime);
      renderFrame();
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, activeVideoClip, renderFrame]);

  // 4. Sync media elements & trigger render
  useEffect(() => {
    const v1 = videoPrimaryRef.current;
    const v2 = videoSecondaryRef.current;
    const vo = videoOverlayRef.current;

    const primaryUrl = activeVideoClip?.mediaUrl || media?.url || null;
    syncVideoElement(v1, primaryUrl, computeSourceTime(activeVideoClip, storeCurrentTime), isPlaying);

    const transStart =
      activeVideoClip?.transition && nextVideoClip
        ? activeVideoClip.start +
          activeVideoClip.duration -
          (activeVideoClip.transition.duration || 0.5)
        : undefined;

    const shouldPreloadV2 = Boolean(
      (transitionInfo || (activeVideoClip?.transition && nextVideoClip)) && nextVideoClip?.mediaUrl
    );
    if (shouldPreloadV2 && nextVideoClip?.mediaUrl) {
      syncVideoElement(
        v2,
        nextVideoClip.mediaUrl,
        computeSourceTime(nextVideoClip, storeCurrentTime, transStart),
        isPlaying && Boolean(transitionInfo)
      );
    }

    if (activeOverlayClip?.mediaUrl) {
      syncVideoElement(vo, activeOverlayClip.mediaUrl, computeSourceTime(activeOverlayClip, storeCurrentTime), isPlaying);
    }

    renderFrame();
  }, [
    storeCurrentTime,
    activeVideoClip,
    nextVideoClip,
    transitionInfo,
    activeOverlayClip,
    media?.url,
    isPlaying,
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

