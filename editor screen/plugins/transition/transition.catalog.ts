import { TransitionType } from "../../types/editor.types";

export type TransitionCategory = "basic" | "camera" | "zoom" | "slide" | "spin" | "blur";

export interface TransitionDefinition {
  index: number;
  id: TransitionType;
  name: string;
  category: TransitionCategory;
  categoryLabel: string;
  purpose: string;
  bestUse: string;
  defaultDuration: number;
  ffmpegType: string;
  isCustomCompound?: boolean;
}

export const VEYTRIX_TRANSITIONS: TransitionDefinition[] = [
  // 1. Basic / Fade
  {
    index: 0,
    id: "cross_dissolve",
    name: "Cross Dissolve",
    category: "basic",
    categoryLabel: "Basic / Fade",
    purpose: "Natural blend between clips",
    bestUse: "General editing, interviews, vlogs",
    defaultDuration: 0.5,
    ffmpegType: "fade",
  },
  {
    index: 1,
    id: "fade_black",
    name: "Fade to Black",
    category: "basic",
    categoryLabel: "Basic / Fade",
    purpose: "Fades through black before the next scene",
    bestUse: "Endings, chapter breaks, suspense",
    defaultDuration: 0.6,
    ffmpegType: "fadeblack",
  },
  {
    index: 2,
    id: "fade_white",
    name: "Fade to White",
    category: "basic",
    categoryLabel: "Basic / Fade",
    purpose: "Brightens to white before the next clip",
    bestUse: "Dreams, flashbacks, emotional scenes",
    defaultDuration: 0.5,
    ffmpegType: "fadewhite",
  },
  {
    index: 3,
    id: "dip_to_color",
    name: "Dip to Color",
    category: "basic",
    categoryLabel: "Basic / Fade",
    purpose: "Fades through a selected color",
    bestUse: "Branding, stylized edits",
    defaultDuration: 0.6,
    ffmpegType: "fade",
    isCustomCompound: true,
  },
  {
    index: 4,
    id: "instant_cut",
    name: "Instant Cut",
    category: "basic",
    categoryLabel: "Basic / Fade",
    purpose: "Direct switch with no animation",
    bestUse: "Fast edits, dialogue, reels",
    defaultDuration: 0.0,
    ffmpegType: "cut",
  },

  // 2. Camera
  {
    index: 5,
    id: "camera_shake",
    name: "Camera Shake",
    category: "camera",
    categoryLabel: "Camera",
    purpose: "Controlled vibration around the transition",
    bestUse: "Action, impact, music videos",
    defaultDuration: 0.4,
    ffmpegType: "camera_shake",
    isCustomCompound: true,
  },
  {
    index: 6,
    id: "crash_zoom",
    name: "Crash Zoom",
    category: "camera",
    categoryLabel: "Camera",
    purpose: "Rapid zoom through the transition",
    bestUse: "Action, sports, energetic reels",
    defaultDuration: 0.4,
    ffmpegType: "zoomin",
  },
  {
    index: 7,
    id: "whip_pan_left",
    name: "Whip Pan Left",
    category: "camera",
    categoryLabel: "Camera",
    purpose: "Fast left sweep with motion blur",
    bestUse: "Action, travel, sports",
    defaultDuration: 0.35,
    ffmpegType: "slideleft",
    isCustomCompound: true,
  },

  // 3. Zoom
  {
    index: 8,
    id: "zoom_in",
    name: "Zoom In",
    category: "zoom",
    categoryLabel: "Zoom",
    purpose: "Enlarges the outgoing scene",
    bestUse: "General-purpose, emphasis, reels",
    defaultDuration: 0.5,
    ffmpegType: "zoomin",
  },
  {
    index: 9,
    id: "zoom_out",
    name: "Zoom Out",
    category: "zoom",
    categoryLabel: "Zoom",
    purpose: "Pulls away from the scene",
    bestUse: "Establishing shots, cinematic edits",
    defaultDuration: 0.5,
    ffmpegType: "fade",
    isCustomCompound: true,
  },
  {
    index: 10,
    id: "hyper_zoom",
    name: "Hyper Zoom",
    category: "zoom",
    categoryLabel: "Zoom",
    purpose: "Ultra-fast zoom with acceleration and blur",
    bestUse: "High-energy action, music edits",
    defaultDuration: 0.3,
    ffmpegType: "zoomin",
  },
  {
    index: 11,
    id: "pulse_zoom",
    name: "Pulse Zoom",
    category: "zoom",
    categoryLabel: "Zoom",
    purpose: "Rhythmic zoom pulses",
    bestUse: "Beat-synced music, short-form edits",
    defaultDuration: 0.45,
    ffmpegType: "fade",
    isCustomCompound: true,
  },

  // 4. Slide / Push
  {
    index: 12,
    id: "slide_left",
    name: "Slide Left",
    category: "slide",
    categoryLabel: "Slide / Push",
    purpose: "Outgoing clip moves left; incoming enters from right",
    bestUse: "General transitions, UI-style edits",
    defaultDuration: 0.5,
    ffmpegType: "slideleft",
  },
  {
    index: 13,
    id: "slide_right",
    name: "Slide Right",
    category: "slide",
    categoryLabel: "Slide / Push",
    purpose: "Outgoing clip moves right; incoming enters from left",
    bestUse: "General transitions, reels",
    defaultDuration: 0.5,
    ffmpegType: "slideright",
  },
  {
    index: 14,
    id: "push_up",
    name: "Push Up",
    category: "slide",
    categoryLabel: "Slide / Push",
    purpose: "Outgoing scene moves upward; next comes behind",
    bestUse: "Vertical transitions, social video",
    defaultDuration: 0.5,
    ffmpegType: "slideup",
  },
  {
    index: 15,
    id: "perspective_push",
    name: "Perspective Push",
    category: "slide",
    categoryLabel: "Slide / Push",
    purpose: "Push combined with perspective scaling",
    bestUse: "Cinematic and modern UI edits",
    defaultDuration: 0.6,
    ffmpegType: "slideleft",
    isCustomCompound: true,
  },

  // 5. Spin / Rotate
  {
    index: 16,
    id: "spin_left",
    name: "Spin Left",
    category: "spin",
    categoryLabel: "Spin / Rotate",
    purpose: "Rotates counterclockwise into the next scene",
    bestUse: "Energetic edits, music videos",
    defaultDuration: 0.5,
    ffmpegType: "spin_left",
    isCustomCompound: true,
  },
  {
    index: 17,
    id: "spin_right",
    name: "Spin Right",
    category: "spin",
    categoryLabel: "Spin / Rotate",
    purpose: "Rotates clockwise into the next scene",
    bestUse: "Action, reels, creative edits",
    defaultDuration: 0.5,
    ffmpegType: "spin_right",
    isCustomCompound: true,
  },

  // 6. Blur / Motion
  {
    index: 18,
    id: "motion_blur",
    name: "Motion Blur",
    category: "blur",
    categoryLabel: "Blur / Motion",
    purpose: "Uses realistic motion blur to blend moving clips",
    bestUse: "Fast camera movement, action",
    defaultDuration: 0.4,
    ffmpegType: "motion_blur",
    isCustomCompound: true,
  },
  {
    index: 19,
    id: "gaussian_blur",
    name: "Gaussian Blur",
    category: "blur",
    categoryLabel: "Blur / Motion",
    purpose: "Softens outgoing clip and resolves incoming clip",
    bestUse: "Soft cinematic transitions",
    defaultDuration: 0.5,
    ffmpegType: "gaussian_blur",
    isCustomCompound: true,
  },
];

export const TRANSITION_CATEGORIES: { id: TransitionCategory; label: string }[] = [
  { id: "basic", label: "Basic / Fade" },
  { id: "camera", label: "Camera" },
  { id: "zoom", label: "Zoom" },
  { id: "slide", label: "Slide / Push" },
  { id: "spin", label: "Spin / Rotate" },
  { id: "blur", label: "Blur / Motion" },
];

export function getTransitionDefinition(type: TransitionType): TransitionDefinition {
  return (
    VEYTRIX_TRANSITIONS.find((t) => t.id === type) || VEYTRIX_TRANSITIONS[0]
  );
}
