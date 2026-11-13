export interface FilterRef {
  type: string;
  intensity?: number;
}

const CSS_FILTER_MAP: Record<string, (intensity: number) => string> = {
  hollywood_gold: (i) => `sepia(${0.35 * i}) saturate(${1 + 0.3 * i}) contrast(${1 + 0.15 * i}) brightness(${1 + 0.05 * i})`,
  cinematic_lut: (i) => `contrast(${1 + 0.2 * i}) saturate(${1 - 0.15 * i}) hue-rotate(${-10 * i}deg)`,
  teal_and_orange: (i) => `contrast(${1 + 0.25 * i}) saturate(${1 + 0.4 * i}) hue-rotate(${-15 * i}deg)`,
  moody_film: (i) => `contrast(${1 + 0.3 * i}) brightness(${1 - 0.15 * i}) saturate(${1 - 0.2 * i})`,
  bright_pop: (i) => `brightness(${1 + 0.15 * i}) contrast(${1 + 0.1 * i}) saturate(${1 + 0.35 * i})`,
  deep_contrast: (i) => `contrast(${1 + 0.45 * i}) brightness(${1 - 0.05 * i})`,
  natural_tone: (i) => `contrast(${1 + 0.05 * i}) saturate(${1 + 0.05 * i})`,
  natural_skin: (i) => `contrast(${1 + 0.05 * i}) saturate(${1 + 0.15 * i}) brightness(${1 + 0.05 * i})`,
  beauty_soft: (i) => `contrast(${1 - 0.05 * i}) brightness(${1 + 0.1 * i}) saturate(${1 + 0.1 * i}) blur(${0.3 * i}px)`,
  fashion_look: (i) => `contrast(${1 + 0.3 * i}) brightness(${1 + 0.1 * i}) saturate(${1 + 0.2 * i})`,
  film_grain: (i) => `contrast(${1 + 0.15 * i}) brightness(${1 - 0.05 * i}) sepia(${0.15 * i})`,
  vhs_classic: (i) => `contrast(${1 + 0.2 * i}) saturate(${1 + 0.3 * i}) hue-rotate(${15 * i}deg)`,
  pure_mono: (i) => `grayscale(${1.0 * i}) contrast(${1 + 0.1 * i})`,
  noir_bw: (i) => `grayscale(${1.0 * i}) contrast(${1 + 0.5 * i}) brightness(${1 - 0.1 * i})`,
  forest_green: (i) => `hue-rotate(${25 * i}deg) saturate(${1 + 0.3 * i}) contrast(${1 + 0.1 * i})`,
  ocean_blue: (i) => `hue-rotate(${180 * i}deg) saturate(${1 + 0.2 * i}) contrast(${1 + 0.1 * i})`,
  neon_blue: (i) => `hue-rotate(${200 * i}deg) saturate(${1 + 0.6 * i}) contrast(${1 + 0.25 * i})`,
  cyberpunk: (i) => `hue-rotate(${285 * i}deg) saturate(${1 + 0.7 * i}) contrast(${1 + 0.3 * i})`,
  oil_painting: (i) => `contrast(${1 + 0.4 * i}) saturate(${1 + 0.4 * i})`,
  comic_book: (i) => `contrast(${1 + 0.8 * i}) saturate(${1 + 0.6 * i}) brightness(${1 + 0.1 * i})`,
};

export function getFilterCss(filter?: FilterRef | null): string | undefined {
  if (!filter || !filter.type || filter.type === "none") return undefined;
  const builder = CSS_FILTER_MAP[filter.type.toLowerCase()];
  if (!builder) return undefined;
  const intensity = typeof filter.intensity === "number" ? Math.max(0, Math.min(2.0, filter.intensity)) : 1.0;
  return builder(intensity);
}

