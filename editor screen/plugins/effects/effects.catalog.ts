export interface EffectDefinition {
  id: string;
  name: string;
  type: "transform" | "shader";
  shaderIndex?: number;
  description: string;
  defaultParams: Record<string, number | string>;
}

export const EFFECT_CATALOG: EffectDefinition[] = [
  { id: "fade_in", name: "Fade In", type: "transform", description: "Alpha ramp entry", defaultParams: { duration: 1.0, startOpacity: 0.0, endOpacity: 1.0 } },
  { id: "fade_out", name: "Fade Out", type: "transform", description: "Alpha ramp exit", defaultParams: { duration: 1.0, startOpacity: 1.0, endOpacity: 0.0 } },
  { id: "zoom_in", name: "Zoom In", type: "transform", description: "Smooth center scale growth", defaultParams: { zoomAmount: 1.5, speed: 1.0 } },
  { id: "zoom_out", name: "Zoom Out", type: "transform", description: "Smooth center shrink", defaultParams: { zoomAmount: 1.5, speed: 1.0 } },
  { id: "spin", name: "Spin", type: "transform", description: "Continuous angular rotation", defaultParams: { speed: 1.0, direction: 1 } },
  { id: "drop", name: "Drop", type: "transform", description: "Vertical drop with damped bounce", defaultParams: { distance: 300, speed: 2.0, bounce: 0.6 } },
  { id: "move_left", name: "Move Left", type: "transform", description: "Slide in from right", defaultParams: { distance: 200, duration: 0.8 } },
  { id: "move_right", name: "Move Right", type: "transform", description: "Slide in from left", defaultParams: { distance: 200, duration: 0.8 } },
  { id: "move_up", name: "Move Up", type: "transform", description: "Slide in from bottom", defaultParams: { distance: 200, duration: 0.8 } },
  { id: "move_down", name: "Move Down", type: "transform", description: "Slide in from top", defaultParams: { distance: 200, duration: 0.8 } },
  { id: "shake_in", name: "Shake In", type: "transform", description: "Decaying high-frequency camera shake", defaultParams: { strength: 20, frequency: 15, duration: 0.7 } },
  { id: "zoom_bounce", name: "Zoom Bounce", type: "transform", description: "Overshoot scale spring", defaultParams: { zoom: 0.4, speed: 3.0, damping: 2.5 } },
  { id: "pulse", name: "Pulse", type: "transform", description: "Continuous rhythmic pulse", defaultParams: { intensity: 0.1, speed: 2.0 } },
  { id: "pop_in", name: "Pop In", type: "transform", description: "Snappy back-out scale appearance", defaultParams: { speed: 2.0 } },
  { id: "pop_out", name: "Pop Out", type: "transform", description: "Snappy back-in shrink exit", defaultParams: { speed: 2.0 } },
  { id: "expand", name: "Expand", type: "transform", description: "Horizontal anamorphic stretch", defaultParams: { scaleX: 1.4, duration: 0.6 } },
  { id: "collapse", name: "Collapse", type: "transform", description: "Horizontal squeeze vanish", defaultParams: { duration: 0.6 } },
  { id: "swing", name: "Swing", type: "transform", description: "Pendulum sway around top pivot", defaultParams: { swingAngle: 25, speed: 2.0, damping: 1.5 } },
  { id: "bounce", name: "Bounce", type: "transform", description: "Repetitive floor bounce", defaultParams: { bounceHeight: 80, speed: 2.5, damping: 1.0 } },
  { id: "wiggle", name: "Wiggle", type: "transform", description: "Subtle organic drift and wobble", defaultParams: { strength: 12, speed: 1.5 } },
];

