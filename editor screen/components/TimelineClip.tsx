import { useState } from "react";
import { TimelineClip as TimelineClipData, ClipModel } from "../types/editor.types";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ClipContextMenu } from "./ClipContextMenu";
import { TrimProcessor } from "../plugins/trim";
import { useEditorStore } from "../store/editor.store";
import { KeyframeMarkers } from "../plugins/keyframe";
import { TransitionBadge } from "../plugins/transition";
import { badgeStyle, getClipVisibleThumbnails } from "./utils/clipThumbnails";

export function TimelineClip({
  clip,
  selected = false,
  onSelect,
  onResize,
  timelineDuration = 9.66,
}: {
  clip: TimelineClipData;
  selected?: boolean;
  onSelect?: () => void;
  onResize?: (edge: "left" | "right", seconds: number) => void;
  timelineDuration?: number;
}) {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const actualWidth = (clip.duration / timelineDuration) * 100;
  const style = {
    left: `${(clip.start / timelineDuration) * 100}%`,
    width: `${actualWidth}%`,
    opacity: clip.locked ? 0.75 : 1,
  };
  const presentationStyle = {
    width: `${clip.presentationWidth ?? 100}%`,
    backgroundColor: clip.color,
  };

  const beginResize = (
    event: ReactPointerEvent<HTMLSpanElement>,
    edge: "left" | "right"
  ) => {
    if (clip.locked) return;
    event.preventDefault();
    event.stopPropagation();
    const track = event.currentTarget.closest(".track-content");
    if (!track) return;
    const startX = event.clientX;
    const initial = edge === "left" ? clip.start : clip.start + clip.duration;
    const pixelsPerSecond = track.getBoundingClientRect().width / timelineDuration;

    const clipButton = event.currentTarget.closest(".timeline-clip") as HTMLElement | null;
    let lastCalculatedTime = initial;

    const move = (moveEvent: PointerEvent) => {
      const deltaSec = (moveEvent.clientX - startX) / pixelsPerSecond;
      lastCalculatedTime = Math.max(0, initial + deltaSec);

      if (clipButton) {
        if (edge === "left") {
          const currentEnd = clip.start + clip.duration;
          const clampedStart = Math.min(currentEnd - 0.1, Math.max(0, lastCalculatedTime));
          const clampedDur = currentEnd - clampedStart;
          clipButton.style.left = `${(clampedStart / timelineDuration) * 100}%`;
          clipButton.style.width = `${(clampedDur / timelineDuration) * 100}%`;
        } else {
          const clampedEnd = Math.max(clip.start + 0.1, lastCalculatedTime);
          const clampedDur = clampedEnd - clip.start;
          clipButton.style.width = `${(clampedDur / timelineDuration) * 100}%`;
        }
      }

      if (onResize) {
        onResize(edge, lastCalculatedTime);
      }
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      // Dispatch final trim command via Command Bus
      TrimProcessor.trimClip(clip.id, edge, lastCalculatedTime);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const beginDragMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (
      clip.locked ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest(".trim-handle")
    ) {
      return;
    }

    const track = event.currentTarget.closest(".track-content");
    if (!track) return;
    const clipElement = event.currentTarget;

    const startX = event.clientX;
    const initialStart = clip.start;
    const pixelsPerSecond =
      track.getBoundingClientRect().width / timelineDuration;
    let hasMoved = false;
    let finalStart = initialStart;

    const move = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (Math.abs(deltaX) > 5) {
        hasMoved = true;
      }
      if (!hasMoved) return;

      const deltaSec = deltaX / pixelsPerSecond;
      let rawStart = Math.max(0, initialStart + deltaSec);

      // Magnetic snapping to 0 or adjacent clip edges
      const state = useEditorStore.getState();
      const currentTrack = state.tracks.find(
        (t) => t.id === clip.type || t.clipIds.includes(clip.id)
      );
      if (currentTrack) {
        for (const cid of currentTrack.clipIds) {
          if (cid === clip.id) continue;
          const other = state.clips[cid];
          if (!other) continue;
          const otherEnd = other.start + other.duration;
          if (Math.abs(rawStart - otherEnd) < 0.25) {
            rawStart = otherEnd;
            break;
          }
        }
      }

      finalStart = rawStart;
      clipElement.style.left = `${(finalStart / timelineDuration) * 100}%`;
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      if (hasMoved) {
        useEditorStore.getState().dispatch({
          id: `move-${Date.now()}`,
          type: "MOVE_CLIP",
          payload: {
            clipId: clip.id,
            newStart: finalStart,
          },
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onSelect) onSelect();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const clipModel: ClipModel = {
    id: clip.id,
    trackId: clip.type,
    name: clip.name || clip.label,
    type: clip.type,
    start: clip.start,
    duration: clip.duration,
    locked: clip.locked,
    color: clip.color,
    assetId: clip.assetId,
    mediaUrl: clip.mediaUrl,
    thumbnails: clip.thumbnails,
    rawThumbnails: clip.rawThumbnails,
    baseDuration: clip.baseDuration,
    presentationWidth: clip.presentationWidth,
    speed: clip.speed,
    reverse: clip.reverse,
    isFrozen: clip.isFrozen,
    freezeTime: clip.freezeTime,
    inPoint: clip.inPoint,
    outPoint: clip.outPoint,
  };

  const visibleThumbnails = getClipVisibleThumbnails(clip);

  return (
    <>
      <button
        type="button"
        className={`timeline-clip ${clip.type}-clip ${selected ? "selected" : ""}`}
        style={style}
        onClick={onSelect}
        onPointerDown={beginDragMove}
        onContextMenu={handleContextMenu}
      >
        <span className="clip-visual" style={presentationStyle}>
          {visibleThumbnails.length > 0 ? (
            <div className="thumbnails">
              {visibleThumbnails.map((thumbnail, index) => (
                <img
                  className="thumbnail"
                  src={thumbnail}
                  alt=""
                  key={`${clip.id}-${index}`}
                />
              ))}
            </div>
          ) : null}
          <span
            className="clip-label"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexWrap: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {clip.locked && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f2c94c" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            {clip.reverse && (
              <span style={badgeStyle("#20b8a1")}>REV</span>
            )}
            {clip.speed && clip.speed !== 1.0 && (
              <span style={badgeStyle("#4ca9bc")}>{clip.speed}x</span>
            )}
            {clip.isFrozen && (
              <span style={badgeStyle("#f2c94c")}>FREEZE</span>
            )}
            <span>{clip.label}</span>
          </span>

          {(selected || clip.type === "video") && !clip.locked && (
            <>
              <span
                className={`trim-handle left ${
                  clip.type === "video" ? "video-resize-handle" : ""
                }`}
                onPointerDown={(event) => beginResize(event, "left")}
              />
              <span
                className={`trim-handle right ${
                  clip.type === "video" ? "video-resize-handle" : ""
                }`}
                onPointerDown={(event) => beginResize(event, "right")}
              />
            </>
          )}

          {/* Phase 3 Keyframe Markers */}
          <KeyframeMarkers keyframes={clipModel.keyframes} clipDuration={clip.duration} />
        </span>
      </button>

      {/* Phase 3 Transition Badge for Video clips */}
      {clip.type === "video" && (
        <TransitionBadge clip={clipModel} timelineDuration={timelineDuration} />
      )}

      {contextMenuPos && (
        <ClipContextMenu
          clip={clipModel}
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onClose={() => setContextMenuPos(null)}
        />
      )}
    </>
  );
}
