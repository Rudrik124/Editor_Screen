import { TimelineClip as TimelineClipData } from "../types/editor.types";
import type { PointerEvent as ReactPointerEvent } from "react";

export function TimelineClip({ clip, selected = false, onSelect, onResize, timelineDuration = 9.66 }: { clip: TimelineClipData; selected?: boolean; onSelect?: () => void; onResize?: (edge: "left" | "right", seconds: number) => void; timelineDuration?: number }) {
  const actualWidth = (clip.duration / timelineDuration) * 100;
  const style = { left: `${(clip.start / timelineDuration) * 100}%`, width: `${actualWidth}%` };
  const presentationStyle = { width: `${clip.presentationWidth ?? 100}%`, backgroundColor: clip.color };
  const beginResize = (event: ReactPointerEvent<HTMLSpanElement>, edge: "left" | "right") => {
    event.preventDefault();
    event.stopPropagation();
    const track = event.currentTarget.closest(".track-content");
    if (!track || !onResize) return;
    const startX = event.clientX;
    const initial = edge === "left" ? clip.start : clip.start + clip.duration;
    const pixelsPerSecond = track.getBoundingClientRect().width / timelineDuration;
    const move = (moveEvent: PointerEvent) => onResize(edge, initial + (moveEvent.clientX - startX) / pixelsPerSecond);
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };
  return <button type="button" className={`timeline-clip ${clip.type}-clip ${selected ? "selected" : ""}`} style={style} onClick={onSelect}><span className="clip-visual" style={presentationStyle}>{clip.thumbnails ? <div className="thumbnails">{clip.thumbnails.map((thumbnail, index) => <img className="thumbnail" src={thumbnail} alt="" key={`${clip.id}-${index}`} />)}</div> : null}<span className="clip-label">{clip.label}</span>{selected && clip.type === "text" && <><span className="trim-handle left" onPointerDown={(event) => beginResize(event, "left")} /><span className="trim-handle right" onPointerDown={(event) => beginResize(event, "right")} /></>}</span></button>;
}
