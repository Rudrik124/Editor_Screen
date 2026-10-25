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

export type AspectRatio = "16:9" | "9:16" | "1:1" | "4:5" | "21:9";

export type TransitionType =
  | "cross_dissolve"
  | "fade_black"
  | "fade_white"
  | "dip_to_color"
  | "instant_cut"
  | "camera_shake"
  | "crash_zoom"
  | "whip_pan_left"
  | "zoom_in"
  | "zoom_out"
  | "hyper_zoom"
  | "pulse_zoom"
  | "slide_left"
  | "slide_right"
  | "push_up"
  | "perspective_push"
  | "spin_left"
  | "spin_right"
  | "motion_blur"
  | "gaussian_blur";

export interface TransitionData {
  type: TransitionType;
  duration: number; // in seconds
  color?: string; // hex or rgb for dip_to_color
  easing?: "linear" | "easeIn" | "easeOut" | "easeInOut";
}

export type KeyframeProperty =
  | "opacity"
  | "scale"
  | "positionX"
  | "positionY"
  | "rotation"
  | "volume";

export interface KeyframeData {
  id: string;
  timeOffset: number; // in seconds from clip start
  property: KeyframeProperty;
  value: number;
  interpolation?: "linear" | "easeIn" | "easeOut" | "easeInOut";
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
  // Phase 3 Layering, Transforms, Transitions, Keyframes
  opacity?: number;
  scale?: number;
  positionX?: number;
  positionY?: number;
  rotation?: number;
  layerIndex?: number;
  transition?: TransitionData;
  keyframes?: KeyframeData[];
  metadata?: Record<string, unknown>;
}

export interface TrackModel {
  id: string;
  label: string;
  type: "video" | "audio" | "text" | "music";
  clipIds: string[];
  locked?: boolean;
}
