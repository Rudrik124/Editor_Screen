import { EditorIcon } from "./EditorToolIcons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatVideoTime } from "./utils/formatVideoTime";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";
import { useEditorStore } from "../store/editor.store";

interface PreviewWorkspaceProps {
  media: { url: string; type: "video" | "image"; name: string } | null;
  onPlaybackControllerReady: (controller: {
    isPlaying: boolean;
    toggle: () => void;
  }) => void;
  textElements: TextElement[];
  onCurrentTimeChange: (time: number) => void;
}

export function PreviewWorkspace({
  media,
  onPlaybackControllerReady,
  textElements,
}: PreviewWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const storeTracks = useEditorStore((state) => state.tracks);
  const storeClips = useEditorStore((state) => state.clips);
  const storeCurrentTime = useEditorStore((state) => state.currentTime);
  const storeDuration = useEditorStore((state) => state.duration);
  const isPlaying = useEditorStore((state) => state.isPlaying);
  const setIsPlaying = useEditorStore((state) => state.setIsPlaying);
  const [videoLoaded, setVideoLoaded] = useState(false);

  // 1. Resolve active clip on the video track under playhead
  const activeVideoClip = useMemo(() => {
    const videoTrack = storeTracks.find((t) => t.id === "video");
    const videoClips = videoTrack
      ? videoTrack.clipIds.map((id) => storeClips[id]).filter(Boolean)
      : Object.values(storeClips).filter((c) => c.type === "video");

    if (videoClips.length === 0) return null;

    const current = videoClips.find(
      (c) =>
        storeCurrentTime >= c.start &&
        storeCurrentTime < c.start + c.duration
    );
    if (current) return current;

    const last = videoClips.find(
      (c) => Math.abs(storeCurrentTime - (c.start + c.duration)) < 0.05
    );
    if (last) return last;

    if (storeCurrentTime < videoClips[0].start) {
      return videoClips[0];
    }
    return videoClips[videoClips.length - 1];
  }, [storeTracks, storeClips, storeCurrentTime]);

  // 2. Compute exact source media time (inPoint, speed, freeze, reverse)
  const targetSourceTime = useMemo(() => {
    if (!activeVideoClip) return storeCurrentTime;

    const localTime = Math.max(
      0,
      Math.min(
        activeVideoClip.duration,
        storeCurrentTime - activeVideoClip.start
      )
    );

    if (activeVideoClip.isFrozen) {
      return activeVideoClip.freezeTime ?? activeVideoClip.inPoint ?? 0;
    }

    const inPoint = activeVideoClip.inPoint ?? 0;
    const speed = activeVideoClip.speed ?? 1.0;

    if (activeVideoClip.reverse) {
      const outPoint =
        activeVideoClip.outPoint ?? (inPoint + activeVideoClip.duration);
      return Math.max(inPoint, outPoint - localTime * speed);
    }

    return inPoint + localTime * speed;
  }, [activeVideoClip, storeCurrentTime]);

  // 3. Master timeline playback loop (CapCut/VN architecture)
  useEffect(() => {
    if (!isPlaying) {
      videoRef.current?.pause();
      return;
    }

    let lastTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const state = useEditorStore.getState();
      const video = videoRef.current;

      let nextTime: number;
      if (
        video &&
        !video.paused &&
        !video.seeking &&
        activeVideoClip &&
        !activeVideoClip.isFrozen &&
        !activeVideoClip.reverse
      ) {
        const inPoint = activeVideoClip.inPoint ?? 0;
        const speed = activeVideoClip.speed ?? 1.0;
        const localTime = Math.max(0, (video.currentTime - inPoint) / speed);
        nextTime = activeVideoClip.start + localTime;
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
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, activeVideoClip]);

  // 4. Video media synchronization
  const activeMediaUrl = activeVideoClip?.mediaUrl || media?.url || null;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeMediaUrl) return;

    if (video.src !== activeMediaUrl && !video.src.endsWith(activeMediaUrl)) {
      video.src = activeMediaUrl;
    }

    if (activeVideoClip?.isFrozen) {
      if (!video.paused) video.pause();
      if (Math.abs(video.currentTime - targetSourceTime) > 0.05) {
        video.currentTime = targetSourceTime;
      }
      return;
    }

    if (activeVideoClip?.reverse) {
      if (!video.paused) video.pause();
      if (Math.abs(video.currentTime - targetSourceTime) > 0.03) {
        video.currentTime = targetSourceTime;
      }
      return;
    }

    const speed = activeVideoClip?.speed ?? 1.0;
    if (video.playbackRate !== speed) {
      video.playbackRate = speed;
    }

    if (isPlaying) {
      if (video.paused) {
        void video.play().catch(() => {});
      }
      // Avoid hard seeking while playing unless crossing a large clip boundary
      if (Math.abs(video.currentTime - targetSourceTime) > 1.2) {
        video.currentTime = targetSourceTime;
      }
    } else {
      if (!video.paused) video.pause();
      if (Math.abs(video.currentTime - targetSourceTime) > 0.05) {
        video.currentTime = targetSourceTime;
      }
    }
  }, [activeMediaUrl, activeVideoClip, targetSourceTime, isPlaying]);

  const togglePlayback = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying, setIsPlaying]);

  useEffect(() => {
    onPlaybackControllerReady({ isPlaying, toggle: togglePlayback });
  }, [isPlaying, onPlaybackControllerReady, togglePlayback]);

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
              width: "min(82%, 700px)",
              aspectRatio: "16 / 9",
              background: "#000",
              borderRadius: "4px",
            }}
          >
            {media?.type === "image" && !activeVideoClip ? (
              <img
                ref={imageRef}
                src={activeMediaUrl}
                alt="Preview"
                className="preview-media"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <video
                ref={videoRef}
                src={activeMediaUrl}
                playsInline
                preload="auto"
                className="preview-media"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
                onLoadedMetadata={() => setVideoLoaded(true)}
                onError={() => {
                  console.error("Preview video failed to load or play.");
                  setIsPlaying(false);
                }}
              />
            )}

            {/* Text overlays rendered on top of active video */}
            {textElements
              .filter(
                (element) =>
                  storeCurrentTime >= element.start &&
                  storeCurrentTime < element.start + element.duration
              )
              .map((element) => (
                <div
                  className="text-overlay"
                  key={element.id}
                  style={{
                    left: `${element.x}%`,
                    top: `${element.y}%`,
                    color: element.color,
                    fontSize: `${element.fontSize}px`,
                    fontWeight: element.bold ? 700 : 400,
                    fontStyle: element.italic ? "italic" : "normal",
                    textAlign: element.alignment,
                  }}
                >
                  {element.content}
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

      <div className="preview-status">
        <span>
          {activeVideoClip ? (
            <>
              {formatVideoTime(storeCurrentTime)}{" "}
              <b>/ {formatVideoTime(storeDuration)}</b>
            </>
          ) : (
            "--:-- / --:--"
          )}
        </span>
        <span className="original">
          <span className="tiny-square" /> Original
        </span>
        <EditorIcon name="fullscreen" />
      </div>
    </section>
  );
}
