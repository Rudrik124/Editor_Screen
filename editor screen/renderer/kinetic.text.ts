export type KineticPreset =
  | "none"
  | "fade_in"
  | "slide_up"
  | "typewriter"
  | "bounce"
  | "pop";

export interface KineticTextData {
  content: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: "left" | "center" | "right";
  x?: number; // 0..100 percentage
  y?: number; // 0..100 percentage
  preset?: KineticPreset;
  presetDuration?: number; // seconds (default ~0.6)
}

export function evaluateKineticText(
  data: KineticTextData,
  localTime: number,
  duration: number
): {
  displayText: string;
  opacity: number;
  transform: string;
} {
  const preset = data.preset || "none";
  const dur = data.presetDuration ?? 0.6;
  const progress = dur > 0 ? Math.min(1.0, Math.max(0.0, localTime / dur)) : 1.0;

  switch (preset) {
    case "fade_in": {
      return {
        displayText: data.content,
        opacity: progress,
        transform: "none",
      };
    }
    case "slide_up": {
      const yOffset = (1.0 - progress) * 30; // 30px slide
      return {
        displayText: data.content,
        opacity: progress,
        transform: `translateY(${yOffset}px)`,
      };
    }
    case "typewriter": {
      const len = data.content.length;
      const count = Math.min(len, Math.floor(progress * len));
      return {
        displayText: data.content.slice(0, count),
        opacity: 1.0,
        transform: "none",
      };
    }
    case "bounce": {
      const decay = Math.exp(-progress * 3.0);
      const bounce = Math.abs(Math.cos(progress * Math.PI * 2.5)) * decay * 20;
      return {
        displayText: data.content,
        opacity: Math.min(1.0, progress * 2.0),
        transform: `translateY(${-bounce}px)`,
      };
    }
    case "pop": {
      const c3 = 1.70158;
      const t = progress;
      const s = (c3 + 1.0) * Math.pow(t - 1.0, 3) + c3 * Math.pow(t - 1.0, 2) + 1.0;
      return {
        displayText: data.content,
        opacity: Math.min(1.0, progress * 3.0),
        transform: `scale(${Math.max(0.0, s)})`,
      };
    }
    case "none":
    default: {
      return {
        displayText: data.content,
        opacity: 1.0,
        transform: "none",
      };
    }
  }
}

