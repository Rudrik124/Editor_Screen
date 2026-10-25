import { EditorIcon } from "./EditorToolIcons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatVideoTime } from "./utils/formatVideoTime";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";
import { useEditorStore } from "../store/editor.store";
import { WebGLRenderer } from "../renderer/webgl.renderer";
import { evaluateClipTransforms } from "../renderer/keyframe.interpolator";
import { getTransitionDefinition } from "../plugins/transition/transition.catalog";
import { RatioProcessor, RatioSelector } from "../plugins/ratio";
import { CoverModal } from "../plugins/cover";

interface PreviewWorkspaceProps {
  media: { url: string; type: "video" | "image"; name: string } | null;
  onPlaybackControllerReady: (controller: { isPlaying: boolean; toggle: () => void }) => void;
  textElements: TextElement[];
  onCurrentTimeChange: (time: number) => void;
}

export function PreviewWorkspace({
  media,
  onPlaybackControllerReady,
  textElements,
}: PreviewWorkspaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

  // Initialize WebGL Renderer
  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new WebGLRenderer(canvasRef.current);
    }
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Update canvas resolution when aspect ratio changes
  useEffect(() => {
    const dims = RatioProcessor.getDimensions(aspectRatio);
    rendererRef.current?.resize(dims.width, dims.height);
  }, [aspectRatio]);

  // 1. Resolve active and transition clips on video track
  const { activeVideoClip, nextVideoClip, transitionInfo } = useMemo(() => {
    const videoTrack = storeTracks.find((t) => t.id === "video");
    const videoClips = videoTrack
      ? videoTrack.clipIds.map((id) => storeClips[id]).filter(Boolean)
      : Object.values(storeClips).filter((c) => c.type === "video");

    if (videoClips.length === 0) {
      return { activeVideoClip: null, nextVideoClip: null, transitionInfo: null };
    }

    const currentIndex = videoClips.findIndex(
      (c) => storeCurrentTime >= c.start && storeCurrentTime < c.start + c.duration
    );

    if (currentIndex === -1) {
      return { activeVideoClip: videoClips[0], nextVideoClip: null, transitionInfo: null };
    }

    const currentClip = videoClips[currentIndex];
    const nextClip = currentIndex < videoClips.length - 1 ? videoClips[currentIndex + 1] : null;

    let transInfo = null;
    if (currentClip.transition && nextClip) {
      const transDur = currentClip.transition.duration || 0.5;
      const transStart = currentClip.start + currentClip.duration - transDur;
      if (storeCurrentTime >= transStart && storeCurrentTime <= currentClip.start + currentClip.duration) {
        const progress = Math.max(0, Math.min(1, (storeCurrentTime - transStart) / transDur));
        const def = getTransitionDefinition(currentClip.transition.type);
        transInfo = {
          progress,
          typeIndex: def.index,
          color: currentClip.transition.color || "#000000",
        };
      }
    }

    return { activeVideoClip: currentClip, nextVideoClip: nextClip, transitionInfo: transInfo };
  }, [storeTracks, storeClips, storeCurrentTime]);

  // 2. Resolve active overlay/PIP clips
  const activeOverlayClip = useMemo(() => {
    const overlayTracks = storeTracks.filter((t) => t.id.includes("overlay"));
    for (const track of overlayTracks) {
      const clips = track.clipIds.map((id) => storeClips[id]).filter(Boolean);
      const hit = clips.find(
        (c) => storeCurrentTime >= c.start && storeCurrentTime < c.start + c.duration
      );
      if (hit) return hit;
    }
    return null;
  }, [storeTracks, storeClips, storeCurrentTime]);

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
      const deltaSec = (now - lastTime) / 1000;
      lastTime = now;
      const nextTime = state.currentTime + deltaSec;

      if (nextTime >= state.duration) {
        state.setIsPlaying(false);
        state.setCurrentTime(0);
        return;
      }

      state.setCurrentTime(nextTime);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // 4. Sync media elements & render WebGL frame
  const computeSourceTime = (clip: typeof activeVideoClip, time: number) => {
    if (!clip) return time;
    const local = Math.max(0, Math.min(clip.duration, time - clip.start));
    if (clip.isFrozen) return clip.freezeTime ?? clip.inPoint ?? 0;
    const inPoint = clip.inPoint ?? 0;
    const speed = clip.speed ?? 1.0;
    if (clip.reverse) {
      const outPoint = clip.outPoint ?? inPoint + clip.duration;
      return Math.max(inPoint, outPoint - local * speed);
    }
    return inPoint + local * speed;
  };

  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    // Clear background
    renderer.clear(0.04, 0.05, 0.07, 1.0);

    const v1 = videoPrimaryRef.current;
    const v2 = videoSecondaryRef.current;
    const vo = videoOverlayRef.current;

    // Sync v1 source
    if (v1 && activeVideoClip?.mediaUrl) {
      if (v1.src !== activeVideoClip.mediaUrl && !v1.src.endsWith(activeVideoClip.mediaUrl)) {
        v1.src = activeVideoClip.mediaUrl;
      }
      const t1 = computeSourceTime(activeVideoClip, storeCurrentTime);
      if (Math.abs(v1.currentTime - t1) > 0.06) v1.currentTime = t1;
      if (isPlaying && v1.paused) void v1.play().catch(() => {});
    }

    // Sync v2 source for transition
    if (v2 && transitionInfo && nextVideoClip?.mediaUrl) {
      if (v2.src !== nextVideoClip.mediaUrl && !v2.src.endsWith(nextVideoClip.mediaUrl)) {
        v2.src = nextVideoClip.mediaUrl;
      }
      const t2 = computeSourceTime(nextVideoClip, storeCurrentTime);
      if (Math.abs(v2.currentTime - t2) > 0.06) v2.currentTime = t2;
      if (isPlaying && v2.paused) void v2.play().catch(() => {});
    }

    // Sync vo source for overlay
    if (vo && activeOverlayClip?.mediaUrl) {
      if (vo.src !== activeOverlayClip.mediaUrl && !vo.src.endsWith(activeOverlayClip.mediaUrl)) {
        vo.src = activeOverlayClip.mediaUrl;
      }
      const to = computeSourceTime(activeOverlayClip, storeCurrentTime);
      if (Math.abs(vo.currentTime - to) > 0.06) vo.currentTime = to;
      if (isPlaying && vo.paused) void vo.play().catch(() => {});
    }

    // Render WebGL
    if (transitionInfo && v1 && v2 && v1.readyState >= 2 && v2.readyState >= 2) {
      // 20-transition GLSL rendering
      renderer.renderTransition(v1, v2, transitionInfo.typeIndex, transitionInfo.progress);
    } else if (v1 && v1.readyState >= 2 && activeVideoClip) {
      const local = Math.max(0, storeCurrentTime - activeVideoClip.start);
      const tf = evaluateClipTransforms(activeVideoClip, local);
      renderer.renderLayer(v1, tf);
    }

    // Render overlay (PIP)
    if (vo && vo.readyState >= 2 && activeOverlayClip) {
      const local = Math.max(0, storeCurrentTime - activeOverlayClip.start);
      const tf = evaluateClipTransforms(activeOverlayClip, local);
      renderer.renderLayer(vo, tf);
    }
  }, [storeCurrentTime, activeVideoClip, nextVideoClip, transitionInfo, activeOverlayClip, isPlaying]);

  const togglePlayback = useCallback(() => setIsPlaying(!isPlaying), [isPlaying, setIsPlaying]);

  useEffect(() => {
    onPlaybackControllerReady({ isPlaying, toggle: togglePlayback });
  }, [isPlaying, onPlaybackControllerReady, togglePlayback]);

  const activeMediaUrl = activeVideoClip?.mediaUrl || media?.url || null;
  const cssRatio = RatioProcessor.getCssRatio(aspectRatio);

  return (
    <section className="preview-workspace">
      <div className="preview-canvas">
        {activeMediaUrl ? (
          <div
            className="preview-art"
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              width: "min(88%, 700px)",
              aspectRatio: cssRatio,
              background: "#000",
              borderRadius: "4px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
              transition: "aspect-ratio 0.25s ease",
            }}
          >
            {/* Hidden media elements feeding WebGL textures */}
            <video ref={videoPrimaryRef} playsInline preload="auto" muted style={{ display: "none" }} />
            <video ref={videoSecondaryRef} playsInline preload="auto" muted style={{ display: "none" }} />
            <video ref={videoOverlayRef} playsInline preload="auto" muted style={{ display: "none" }} />

            {/* Main WebGL canvas */}
            <canvas ref={canvasRef} width={1280} height={720} style={{ width: "100%", height: "100%", objectFit: "contain" }} />

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

      {/* Playback & Status Bar */}
      <div className="preview-status" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          {activeVideoClip ? (
            <>
              {formatVideoTime(storeCurrentTime)} <b>/ {formatVideoTime(storeDuration)}</b>
            </>
          ) : (
            "--:-- / --:--"
          )}
        </span>

        {/* Phase 3 Ratio Selector & Cover Trigger */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <RatioSelector />
          <button
            type="button"
            title="Set Project Cover"
            onClick={() => setCoverModalOpen(true)}
            style={{
              padding: "5px 9px",
              fontSize: "11px",
              backgroundColor: "#20252c",
              border: "1px solid #333a44",
              borderRadius: "5px",
              color: "#e2e8f0",
              cursor: "pointer",
            }}
          >
            📸 Cover
          </button>
        </div>

        <EditorIcon name="fullscreen" />
      </div>

      <CoverModal
        isOpen={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        canvasRef={canvasRef}
        clipId={activeVideoClip?.id}
      />
    </section>
  );
}
