import { Track, TimelineClip as TimelineClipData } from "../types/editor.types";
import { TimelineClip } from "./TimelineClip";
import { useEditorStore } from "../store/editor.store";

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

  return (
    <div className={`track-row ${track.type}-row`}>
      <div className="track-label">{track.label}</div>
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
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              <span>Delete Gap</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

