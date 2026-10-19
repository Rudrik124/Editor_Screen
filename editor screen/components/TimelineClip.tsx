import { TimelineClip as TimelineClipData } from "../types/editor.types";

export function TimelineClip({ clip, selected = false }: { clip: TimelineClipData; selected?: boolean }) {
  const style = { left: `${(clip.start / 9.66) * 100}%`, width: `${(clip.duration / 9.66) * 100}%`, backgroundColor: clip.color };
  return <div className={`timeline-clip ${clip.type}-clip ${selected ? "selected" : ""}`} style={style}>{clip.thumbnails ? <div className="thumbnails">{clip.thumbnails.map((_, index) => <span className={`thumbnail thumb-${index % 5}`} key={index} />)}</div> : null}<span className="clip-label">{clip.label}</span>{selected && <><span className="trim-handle left" /><span className="trim-handle right" /></>}</div>;
}
