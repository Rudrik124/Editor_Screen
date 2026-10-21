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
  rawThumbnails?: string[];
  assetId?: string;
  mediaUrl?: string;
  presentationWidth?: number;
  locked?: boolean;
  name?: string;
  speed?: number;
  baseDuration?: number;
  reverse?: boolean;
  isFrozen?: boolean;
  freezeTime?: number;
  inPoint?: number;
  outPoint?: number;
}

export interface VideoAsset {
  id: string;
  url: string;
  renderUrl?: string;
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

export interface ClipModel {
  id: string;
  trackId: string;
  name: string;
  type: "video" | "audio" | "text" | "music";
  start: number;
  duration: number;
  inPoint?: number;
  outPoint?: number;
  locked?: boolean;
  color?: string;
  assetId?: string;
  mediaUrl?: string;
  renderMediaUrl?: string;
  thumbnails?: string[];
  rawThumbnails?: string[];
  presentationWidth?: number;
  content?: string;
  volume?: number;
  speed?: number;
  baseDuration?: number;
  reverse?: boolean;
  isFrozen?: boolean;
  freezeTime?: number;
}

export interface TrackModel {
  id: string;
  label: string;
  type: "video" | "audio" | "text" | "music";
  clipIds: string[];
  locked?: boolean;
}
