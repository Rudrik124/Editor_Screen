import { Track } from "../types/editor.types";
import { TimelineClip } from "./TimelineClip";

export function TimelineTrack({ track }: { track: Track }) {
  return <div className={`track-row ${track.type}-row`}><div className="track-label">{track.label}</div><div className="track-content">{track.clips.map((clip) => <TimelineClip key={clip.id} clip={clip} selected={track.type === "video"} />)}</div></div>;
}
