import { useEffect, useMemo, useRef } from "react";
import { TimelineTrack } from "./TimelineTrack";
import { TimelineClip, Track, VideoAsset } from "../types/editor.types";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";
import { getTextPresentationWidth } from "../left-side toolbar/functionality/text/functionality/getTextPresentationWidth";
import { useEditorStore } from "../store/editor.store";

interface TimelineWorkspaceProps {
  assets: VideoAsset[];
  addedVideoIds: string[];
  selectedVideoId?: string;
  onAddVideo: (asset: VideoAsset) => void;
  onSelectVideo: (assetId: string) => void;
  textElements: TextElement[];
  selectedTextId?: string;
  onSelectText: (id: string) => void;
  onAddText: () => void;
  onUpdateText: (id: string, changes: Partial<TextElement>) => void;
  onDeleteText: (id: string) => void;
  onResizeText: (id: string, edge: "left" | "right", time: number) => void;
}

export function TimelineWorkspace({
  onSelectVideo,
  textElements,
  selectedTextId,
  onSelectText,
  onResizeText,
}: TimelineWorkspaceProps) {
  const storeTracks = useEditorStore((state) => state.tracks);
  const storeClips = useEditorStore((state) => state.clips);
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const selectClip = useEditorStore((state) => state.selectClip);
  const currentTime = useEditorStore((state) => state.currentTime);
  const setCurrentTime = useEditorStore((state) => state.setCurrentTime);
  const setDuration = useEditorStore((state) => state.setDuration);
  const timelineMainRef = useRef<HTMLDivElement>(null);

  // Calculate timeline duration from active clips
  const videoClipEnds = Object.values(storeClips)
    .filter((clip) => clip.type === "video")
    .map((clip) => clip.start + clip.duration);
  const hasVideo = videoClipEnds.length > 0;
  const videoDuration = Math.max(...videoClipEnds, 0);
  const timelineDuration = Math.max(9.66, ...videoClipEnds, 0);

  useEffect(() => {
    setDuration(hasVideo ? timelineDuration : 0);
  }, [hasVideo, timelineDuration, setDuration]);

  // Generate dynamic ruler ticks spanning the actual duration
  const rulerTicks = useMemo(() => {
    const totalSecs = Math.max(10, Math.ceil(timelineDuration));
    // Determine interval (1s if <= 20s, 2s if <= 60s, 5s otherwise)
    const interval = totalSecs <= 20 ? 1 : totalSecs <= 60 ? 2 : 5;
    const ticks: { time: number; label: string }[] = [];
    for (let s = 0; s <= totalSecs; s += interval) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      ticks.push({
        time: s,
        label: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`,
      });
    }
    return ticks;
  }, [timelineDuration]);

  // Handle timeline scrubber / seek on click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = timelineMainRef.current;
    if (!el) return;
    const trackContentEl = el.querySelector(".track-content") as HTMLElement | null;
    if (!trackContentEl) return;
    const contentRect = trackContentEl.getBoundingClientRect();
    const clickX = e.clientX - contentRect.left;
    if (contentRect.width > 0) {
      const clickRatio = Math.max(0, Math.min(1, clickX / contentRect.width));
      const clickTime = clickRatio * timelineDuration;
      setCurrentTime(clickTime);
    }
  };

  const renderedTracks: Track[] = storeTracks.map((track) => {
    if (track.id === "text") {
      if (textElements.length > 0) {
        return {
          id: track.id,
          label: track.label,
          type: "text",
          clips: textElements.map((element, idx) => ({
            id: element.id,
            label: element.content || "Text",
            type: "text",
            start: element.start,
            duration: element.duration,
            color: "#075c61",
            presentationWidth: getTextPresentationWidth(idx),
          })),
        };
      }
    }

    const clips: TimelineClip[] = track.clipIds
      .map((id) => storeClips[id])
      .filter(Boolean)
      .filter((clip) => hasVideo || (clip.type !== "music" && clip.type !== "audio"))
      .map((c) => ({
        id: c.id,
        label: c.name,
        type: c.type,
        start: c.start,
        duration:
          hasVideo && (c.type === "music" || c.type === "audio")
            ? videoDuration
            : c.duration,
        color: c.color || "#22262b",
        thumbnails: c.thumbnails,
        rawThumbnails: c.rawThumbnails || c.thumbnails,
        baseDuration: c.baseDuration,
        assetId: c.assetId,
        mediaUrl: c.mediaUrl,
        presentationWidth: c.presentationWidth,
        locked: c.locked,
        name: c.name,
        speed: c.speed,
        reverse: c.reverse,
        isFrozen: c.isFrozen,
        freezeTime: c.freezeTime,
        inPoint: c.inPoint,
        outPoint: c.outPoint,
      }));

    return {
      id: track.id,
      label: track.label,
      type: track.type,
      clips,
    };
  });

  const activeSelectedId = selectedClipId || selectedTextId;
  const playheadPct =
    timelineDuration > 0
      ? Math.min(100, Math.max(0, (currentTime / timelineDuration) * 100))
      : 0;

  return (
    <div className="timeline-workspace">
      <div
        className="timeline-main"
        ref={timelineMainRef}
        onClick={handleTimelineClick}
      >
        {/* Dynamic Timeline Ruler */}
        <div className="timeline-ruler">
          <div className="ruler-header-spacer" />
          <div className="ruler-ticks-track">
            {rulerTicks.map((tick) => (
              <div
                key={tick.time}
                className="ruler-tick"
                style={{ left: `${(tick.time / timelineDuration) * 100}%` }}
              >
                <span className="ruler-tick-time">{tick.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tracks List */}
        {renderedTracks.map((track) => (
          <TimelineTrack
            key={track.id}
            track={track}
            selectedClipId={activeSelectedId || undefined}
            onSelectClip={(clip) => {
              selectClip(clip.id);
              if (clip.assetId) {
                onSelectVideo(clip.assetId);
              } else if (clip.type === "text") {
                onSelectText(clip.id);
              }
            }}
            onResizeClip={(clip, edge, time) => {
              if (clip.type === "text") {
                onResizeText(clip.id, edge, time);
              }
            }}
            timelineDuration={timelineDuration}
          />
        ))}

        {/* Playhead needle with diamond top */}
        <div
          className="playhead"
          style={{
            left: `calc(var(--track-header-w) + (100% - var(--track-header-w) - var(--track-gap-r)) * ${playheadPct / 100})`,
          }}
        >
          <span />
        </div>
      </div>
    </div>
  );
}
