import { rulerLabels, timelineTracks } from "../data/editorMockData";
import { LeftSideToolbar } from "../left-side toolbar";
import { TimelineTrack } from "./TimelineTrack";

export function TimelineWorkspace({ media }: { media: { url: string; name: string } | null }) {
  return <div className="timeline-workspace"><LeftSideToolbar media={media} /><div className="timeline-main"><div className="ruler"><div className="ruler-spacer" />{rulerLabels.map((label) => <span key={label}>{label}</span>)}</div>{timelineTracks.map((track) => <TimelineTrack key={track.id} track={track} />)}<div className="playhead"><span /></div></div></div>;
}
