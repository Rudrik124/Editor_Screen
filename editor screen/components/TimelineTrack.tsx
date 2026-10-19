import { Track } from "../types/editor.types";
import { TimelineClip as TimelineClipData } from "../types/editor.types";
import { TimelineClip } from "./TimelineClip";

export function TimelineTrack({ track, selectedClipId, onSelectClip, onResizeClip, timelineDuration }: { track: Track; selectedClipId?: string; onSelectClip?: (clip: TimelineClipData) => void; onResizeClip?: (clip: TimelineClipData, edge: "left" | "right", seconds: number) => void; timelineDuration?: number }) {
  return <div className={`track-row ${track.type}-row`}><div className="track-label">{track.label}</div><div className="track-content">{track.clips.map((clip) => <TimelineClip key={clip.id} clip={clip} selected={clip.id === selectedClipId} onSelect={() => onSelectClip?.(clip)} onResize={(edge, seconds) => onResizeClip?.(clip, edge, seconds)} timelineDuration={timelineDuration} />)}</div></div>;
}
