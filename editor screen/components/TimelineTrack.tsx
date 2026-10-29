import { useState } from "react";
import {
  VideoCamera,
  PictureInPicture,
  TextT,
  MusicNotes,
  SpeakerHigh,
  SpeakerSlash,
  Eye,
  EyeSlash,
  LockSimple,
  LockSimpleOpen,
  X,
} from "@phosphor-icons/react";
import { Track, TimelineClip as TimelineClipData } from "../types/editor.types";
import { TimelineClip } from "./TimelineClip";
import { useEditorStore } from "../store/editor.store";
import { AudioProcessor } from "../plugins/audio";

export function TimelineTrack({
  track,
  selectedClipId,
  onSelectClip,
  onResizeClip,
  timelineDuration = 9.66,
}: {
  track: Track;
  selectedClipId?: string;
  onSelectClip?: (clip: TimelineClipData) => void;
  onResizeClip?: (clip: TimelineClipData, edge: "left" | "right", seconds: number) => void;
  timelineDuration?: number;
}) {
  const [hidden, setHidden] = useState(false);
  const [locked, setLocked] = useState(false);
  const muted = track.muted ?? false;
  const dispatch = useEditorStore((state) => state.dispatch);

  // Detect blank gaps between consecutive clips
  const sortedClips = [...track.clips].sort((a, b) => a.start - b.start);
  const gaps: { start: number; duration: number }[] = [];

  for (let i = 0; i < sortedClips.length - 1; i++) {
    const currentEnd = sortedClips[i].start + sortedClips[i].duration;
    const nextStart = sortedClips[i + 1].start;
    const gapDuration = nextStart - currentEnd;
    if (gapDuration > 0.08) {
      gaps.push({ start: currentEnd, duration: gapDuration });
    }
  }

  const handleCloseGap = (gapStart: number, gapDuration: number) => {
    dispatch({
      id: `close-gap-${Date.now()}`,
      type: "CLOSE_GAP",
      payload: {
        trackId: track.id,
        gapStart,
        gapDuration,
      },
      timestamp: Date.now(),
    });
  };

  const renderTrackIcon = () => {
    if (track.type === "video") {
      return track.id.includes("overlay") ? (
        <PictureInPicture size={14} weight="regular" />
      ) : (
        <VideoCamera size={14} weight="regular" />
      );
    }
    if (track.type === "text") return <TextT size={14} weight="regular" />;
    if (track.type === "music") return <MusicNotes size={14} weight="regular" />;
    return <SpeakerHigh size={14} weight="regular" />;
  };

  return (
    <div className={`track-row ${track.type}-row ${hidden ? "track-hidden" : ""} ${locked ? "track-locked" : ""}`}>
      {/* CapCut-style Track Header on the left */}
      <div className="track-header" title={`${track.label} Track`}>
        <div className="track-header-left">
          <span className="track-type-icon">{renderTrackIcon()}</span>
          <span className="track-title">{track.label}</span>
        </div>
        <div className="track-header-actions">
          {track.type !== "text" && (
            <button
              type="button"
              className={`track-mini-btn ${muted ? "active-muted" : ""}`}
              title={muted ? "Unmute track" : "Mute track"}
              onClick={() => AudioProcessor.setTrackMuted(track.id, !muted)}
              aria-label={muted ? "Unmute track" : "Mute track"}
            >
              {muted ? <SpeakerSlash size={13} weight="bold" /> : <SpeakerHigh size={13} weight="regular" />}
            </button>
          )}
          {track.type !== "audio" && track.type !== "music" && (
            <button
              type="button"
              className={`track-mini-btn ${hidden ? "active-hidden" : ""}`}
              title={hidden ? "Show track" : "Hide track"}
              onClick={() => setHidden(!hidden)}
              aria-label={hidden ? "Show track" : "Hide track"}
            >
              {hidden ? <EyeSlash size={13} weight="bold" /> : <Eye size={13} weight="regular" />}
            </button>
          )}
          <button
            type="button"
            className={`track-mini-btn ${locked ? "active-locked" : ""}`}
            title={locked ? "Unlock track" : "Lock track"}
            onClick={() => setLocked(!locked)}
            aria-label={locked ? "Unlock track" : "Lock track"}
          >
            {locked ? <LockSimple size={13} weight="bold" /> : <LockSimpleOpen size={13} weight="regular" />}
          </button>
        </div>
      </div>

      <div className="track-content">
        {/* Render clips */}
        {track.clips.map((clip) => (
          <TimelineClip
            key={clip.id}
            clip={clip}
            selected={clip.id === selectedClipId}
            onSelect={() => onSelectClip?.(clip)}
            onResize={(edge, seconds) => onResizeClip?.(clip, edge, seconds)}
            timelineDuration={timelineDuration}
          />
        ))}

        {/* Render blank gap zones with quick-close buttons */}
        {gaps.map((gap) => (
          <div
            key={`gap-${gap.start.toFixed(2)}`}
            className="timeline-gap-zone"
            style={{
              left: `${(gap.start / timelineDuration) * 100}%`,
              width: `${(gap.duration / timelineDuration) * 100}%`,
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleCloseGap(gap.start, gap.duration);
            }}
            title="Click to remove blank space and join clips"
          >
            <button
              type="button"
              className="gap-delete-pill"
              aria-label="Delete empty space"
            >
              <X size={10} weight="bold" />
              <span>Delete Gap</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
