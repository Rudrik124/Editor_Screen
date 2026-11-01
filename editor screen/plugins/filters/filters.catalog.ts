export interface FilterDefinition {
  id: string;
  name: string;
  category:
    | "Cinematic"
    | "Lighting & Tone"
    | "Portrait"
    | "Vintage & Retro"
    | "Black & White"
    | "Nature & Landscape"
    | "Neon & Cyber"
    | "Creative & Artistic";
  shaderIndex: number;
  description: string;
}

export const FILTER_CATALOG: FilterDefinition[] = [
  // 1. Cinematic
  { id: "hollywood_gold", name: "Hollywood Gold", category: "Cinematic", shaderIndex: 1, description: "Warm amber highlights, contrast boost, soft lift" },
  { id: "cinematic_lut", name: "Cinematic LUT", category: "Cinematic", shaderIndex: 2, description: "Teal shadows, warm midtones, desaturated high roll-off" },
  { id: "teal_and_orange", name: "Teal & Orange", category: "Cinematic", shaderIndex: 3, description: "Split-toning: luminance-keyed teal base with warm skin-tones" },
  { id: "moody_film", name: "Moody Film", category: "Cinematic", shaderIndex: 4, description: "Crushed greens/cyans, low black-point clipping, S-curve" },

  // 2. Lighting & Tone
  { id: "bright_pop", name: "Bright Pop", category: "Lighting & Tone", shaderIndex: 5, description: "Gamma boost, saturation +25%, soft highlight unsharp" },
  { id: "deep_contrast", name: "Deep Contrast", category: "Lighting & Tone", shaderIndex: 6, description: "Hard S-curve, clipped deep blacks, punchy speculars" },
  { id: "natural_tone", name: "Natural Tone", category: "Lighting & Tone", shaderIndex: 7, description: "Neutral linear balancing, gentle white-point normalization" },

  // 3. Portrait
  { id: "natural_skin", name: "Natural Skin", category: "Portrait", shaderIndex: 8, description: "Selective red/orange preservation, gentle skin softening" },
  { id: "beauty_soft", name: "Beauty Soft", category: "Portrait", shaderIndex: 9, description: "Gaussian bloom blend, softened blemishes" },
  { id: "fashion_look", name: "Fashion Look", category: "Portrait", shaderIndex: 10, description: "High key exposure, bleached midtones, vivid reds" },

  // 4. Vintage & Retro
  { id: "film_grain", name: "Film Grain", category: "Vintage & Retro", shaderIndex: 11, description: "Procedural grain overlay with temporal noise" },
  { id: "vhs_classic", name: "VHS Classic", category: "Vintage & Retro", shaderIndex: 12, description: "NTSC color bleed, horizontal scanlines, channel aberration" },

  // 5. Black & White
  { id: "pure_mono", name: "Pure Mono", category: "Black & White", shaderIndex: 13, description: "Rec.709 Luminance matrix monochrome" },
  { id: "noir_bw", name: "Noir BW", category: "Black & White", shaderIndex: 14, description: "Harsh grayscale S-curve with heavy vignette" },

  // 6. Nature & Landscape
  { id: "forest_green", name: "Forest Green", category: "Nature & Landscape", shaderIndex: 15, description: "Boost green/emerald hues, warm sun highlights" },
  { id: "ocean_blue", name: "Ocean Blue", category: "Nature & Landscape", shaderIndex: 16, description: "Deep cyan/cobalt cast in shadows and waters" },

  // 7. Neon & Cyber
  { id: "neon_blue", name: "Neon Blue", category: "Neon & Cyber", shaderIndex: 17, description: "Saturated electric blue shadows, purple midtones" },
  { id: "cyberpunk", name: "Cyberpunk", category: "Neon & Cyber", shaderIndex: 18, description: "Hot magenta highlights paired with deep neon cyan shadows" },

  // 8. Creative & Artistic
  { id: "oil_painting", name: "Oil Painting", category: "Creative & Artistic", shaderIndex: 19, description: "Kuwahara multi-window variance filter styling" },
  { id: "comic_book", name: "Comic Book", category: "Creative & Artistic", shaderIndex: 20, description: "Sobel edge detector overlay on posterized color bands" },
];

export const FILTER_INDEX_MAP: Record<string, number> = Object.fromEntries(
  FILTER_CATALOG.map((f) => [f.id, f.shaderIndex])
);

