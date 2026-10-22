import { useEffect, useRef } from "react";
import { rulerLabels } from "../data/editorMockData";
import { LeftSideToolbar } from "../left-side toolbar";
import { TimelineTrack } from "./TimelineTrack";
import { TimelineClip, Track, VideoAsset } from "../types/editor.types";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";
import { getTextPresentationWidth } from "../left-side toolbar/functionality/text/functionality/getTextPresentationWidth";
import { useEditorStore } from "../store/editor.store";
import { TrimProcessor } from "../plugins/trim";


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
  onAddText,
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

  // Handle timeline scrubber / seek on click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = timelineMainRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 44; // 44px ruler header offset
    const availableWidth = rect.width - 60;
    if (clickX >= 0 && availableWidth > 0) {
      const clickTime = (clickX / availableWidth) * timelineDuration;
      setCurrentTime(Math.max(0, Math.min(timelineDuration, clickTime)));
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
      <LeftSideToolbar onAddText={onAddText} />
      <div
        className="timeline-main"
        ref={timelineMainRef}
        onClick={handleTimelineClick}
      >
        <div className="ruler">
          <div className="ruler-spacer" />
          {rulerLabels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

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
              } else {
                TrimProcessor.trimClip(clip.id, edge, time);
              }
            }}
            timelineDuration={timelineDuration}
          />
        ))}

        <div
          className="playhead"
          style={{
            left: `calc(44px + (100% - 60px) * ${playheadPct / 100})`,
          }}
        >
          <span />
        </div>
      </div>
    </div>
  );
}
