export type IconName =
  | "audio"
  | "crop"
  | "duplicate"
  | "effects"
  | "filter"
  | "flip"
  | "fullscreen"
  | "grid"
  | "image"
  | "link"
  | "lock"
  | "mask"
  | "play"
  | "pause"
  | "redo"
  | "rotate"
  | "search"
  | "settings"
  | "snap"
  | "speed"
  | "split"
  | "text"
  | "transform"
  | "undo"
  | "video"
  | "volume"
  | "zoomIn"
  | "zoomOut";

export interface TimelineClip {
  id: string;
  label: string;
  type: "music" | "text" | "video" | "audio";
  start: number;
  duration: number;
  color: string;
  thumbnails?: string[];
  assetId?: string;
  mediaUrl?: string;
  presentationWidth?: number;
}

export interface VideoAsset {
  id: string;
  url: string;
  name: string;
  duration: number;
  thumbnailUrl: string;
  thumbnails: string[];
}

export interface Track {
  id: string;
  label: string;
  type: TimelineClip["type"];
  clips: TimelineClip[];
}
