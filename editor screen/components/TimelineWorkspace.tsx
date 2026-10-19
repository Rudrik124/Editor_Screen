import { rulerLabels, timelineTracks } from "../data/editorMockData";
import { LeftSideToolbar } from "../left-side toolbar";
import { TimelineTrack } from "./TimelineTrack";
import { TimelineClip, Track, VideoAsset } from "../types/editor.types";
import { TextElement } from "../left-side toolbar/functionality/text/functionality/text.types";
import { getTextPresentationWidth } from "../left-side toolbar/functionality/text/functionality/getTextPresentationWidth";

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

export function TimelineWorkspace({ assets, addedVideoIds, selectedVideoId, onAddVideo, onSelectVideo, textElements, selectedTextId, onSelectText, onAddText, onUpdateText, onDeleteText, onResizeText }: TimelineWorkspaceProps) {
  const timelineDuration = Math.max(9.66, addedVideoIds.reduce((total, assetId) => total + (assets.find((asset) => asset.id === assetId)?.duration ?? 0), 0));
  const renderedTracks: Track[] = [];
  timelineTracks.forEach((track) => {
    if (track.id === "text") {
      if (textElements.length === 0) {
        renderedTracks.push(track);
        return;
      }
      textElements.slice().reverse().forEach((element) => {
        const creationIndex = textElements.findIndex((candidate) => candidate.id === element.id);
        renderedTracks.push({
        id: `text-track-${element.id}`,
        label: "Text",
        type: "text",
        clips: [{
          id: element.id,
          label: element.content || "Text",
          type: "text",
          start: element.start,
          duration: element.duration,
          color: "#075c61",
          presentationWidth: getTextPresentationWidth(creationIndex),
        }],
        });
      });
      return;
    }
    if (track.id !== "video") {
      renderedTracks.push({
        ...track,
        clips: track.clips.map((clip) => ({
          ...clip,
          duration: addedVideoIds.length > 0 ? timelineDuration : clip.duration,
          label: addedVideoIds.length > 0 && clip.label ? clip.label.replace(/\s+\d+(?:\.\d+)?$/, ` ${timelineDuration.toFixed(2)}`) : clip.label,
        })),
      });
      return;
    }
    let start = 0;
    const clips = addedVideoIds
      .map((assetId) => assets.find((candidate) => candidate.id === assetId))
      .filter((asset): asset is VideoAsset => Boolean(asset))
      .map((asset) => {
        const clip: TimelineClip = {
          id: `video-${asset.id}`,
          assetId: asset.id,
          label: `${asset.name}  ${asset.duration.toFixed(2)}`,
          type: "video",
          start,
          duration: asset.duration,
          color: "#22262b",
          thumbnails: asset.thumbnails,
          mediaUrl: asset.url,
        };
        start += asset.duration;
        return clip;
      });
    renderedTracks.push({ ...track, clips });
  });

  return <div className="timeline-workspace"><LeftSideToolbar onAddText={onAddText} /><div className="timeline-main"><div className="ruler"><div className="ruler-spacer" />{rulerLabels.map((label) => <span key={label}>{label}</span>)}</div>{renderedTracks.map((track) => <TimelineTrack key={track.id} track={track} selectedClipId={track.type === "text" ? selectedTextId : selectedVideoId ? `video-${selectedVideoId}` : undefined} onSelectClip={(clip) => { if (clip.assetId) onSelectVideo(clip.assetId); else if (clip.type === "text") onSelectText(clip.id); }} onResizeClip={(clip, edge, time) => { if (clip.type === "text") onResizeText(clip.id, edge, time); }} timelineDuration={timelineDuration} />)}<div className="playhead"><span /></div></div></div>;
}
