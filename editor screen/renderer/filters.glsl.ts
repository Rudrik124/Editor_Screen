export const filterShadersGLSL = `
// Color Filters GLSL library (20 recipes)
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float pseudoNoise(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

vec4 applyColorFilter(int filterType, vec2 uv, vec4 baseColor, float intensity, float time) {
  if (filterType <= 0) return baseColor;
  vec3 c = baseColor.rgb;
  vec3 outColor = c;

  // 1. Hollywood Gold
  if (filterType == 1) {
    vec3 warm = c * vec3(1.18, 1.08, 0.88);
    warm = (warm - vec3(0.5)) * 1.08 + vec3(0.5);
    outColor = warm;
  }
  // 2. Cinematic LUT
  else if (filterType == 2) {
    vec3 graded = c;
    graded.b += 0.12 * (1.0 - c.g);
    graded.r += 0.10 * c.g;
    graded = (graded - vec3(0.5)) * 1.12 + vec3(0.5);
    outColor = graded;
  }
  // 3. Teal & Orange
  else if (filterType == 3) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 shadows = vec3(0.0, 0.15, 0.25);
    vec3 highlights = vec3(0.25, 0.15, 0.0);
    vec3 split = mix(c + shadows, c + highlights, lum);
    outColor = (split - vec3(0.5)) * 1.15 + vec3(0.5);
  }
  // 4. Moody Film
  else if (filterType == 4) {
    vec3 moody = c * vec3(0.9, 0.95, 0.92);
    moody = clamp(moody - vec3(0.05), 0.0, 1.0) * 1.1;
    outColor = moody;
  }
  // 5. Bright Pop
  else if (filterType == 5) {
    vec3 hsv = rgb2hsv(c);
    hsv.y = clamp(hsv.y * 1.25, 0.0, 1.0);
    hsv.z = pow(hsv.z, 0.88);
    outColor = hsv2rgb(hsv);
  }
  // 6. Deep Contrast
  else if (filterType == 6) {
    vec3 dc = (c - vec3(0.5)) * 1.35 + vec3(0.5);
    outColor = dc - vec3(0.04);
  }
  // 7. Natural Tone
  else if (filterType == 7) {
    outColor = (c - vec3(0.5)) * 1.03 + vec3(0.5);
  }
  // 8. Natural Skin
  else if (filterType == 8) {
    vec3 hsv = rgb2hsv(c);
    if (hsv.x < 0.12 || hsv.x > 0.95) {
      hsv.y *= 1.05;
    }
    outColor = hsv2rgb(hsv);
  }
  // 9. Beauty Soft
  else if (filterType == 9) {
    vec3 bloom = pow(c, vec3(1.5)) * 0.4;
    outColor = c + bloom;
  }
  // 10. Fashion Look
  else if (filterType == 10) {
    vec3 fash = pow(c, vec3(0.85));
    fash.r *= 1.1;
    outColor = (fash - vec3(0.5)) * 1.1 + vec3(0.5);
  }
  // 11. Film Grain
  else if (filterType == 11) {
    float n = (pseudoNoise(uv * 100.0 + vec2(fract(time))) - 0.5) * 0.15;
    outColor = c + vec3(n);
  }
  // 12. VHS Classic
  else if (filterType == 12) {
    float scanline = sin(uv.y * 300.0) * 0.04;
    vec3 vhs = c;
    vhs.r = c.r * 1.08;
    vhs.b = c.b * 0.92;
    outColor = vhs - vec3(scanline);
  }
  // 13. Pure Mono
  else if (filterType == 13) {
    float gray = dot(c, vec3(0.2126, 0.7152, 0.0722));
    outColor = vec3(gray);
  }
  // 14. Noir BW
  else if (filterType == 14) {
    float gray = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float contrast = clamp((gray - 0.5) * 1.45 + 0.5, 0.0, 1.0);
    float dist = distance(uv, vec2(0.5));
    float vig = smoothstep(0.8, 0.2, dist);
    outColor = vec3(contrast * vig);
  }
  // 15. Forest Green
  else if (filterType == 15) {
    vec3 g = c;
    g.g *= 1.25;
    g.b *= 0.92;
    outColor = g;
  }
  // 16. Ocean Blue
  else if (filterType == 16) {
    vec3 b = c;
    b.b *= 1.3;
    b.g *= 1.08;
    b.r *= 0.88;
    outColor = b;
  }
  // 17. Neon Blue
  else if (filterType == 17) {
    vec3 nb = c;
    nb.b = pow(nb.b, 0.7) * 1.25;
    nb.g *= 0.8;
    outColor = nb;
  }
  // 18. Cyberpunk
  else if (filterType == 18) {
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    vec3 magenta = vec3(1.0, 0.0, 0.6);
    vec3 cyan = vec3(0.0, 0.8, 1.0);
    outColor = mix(cyan * lum, magenta, smoothstep(0.4, 0.9, lum));
  }
  // 19. Oil Painting (posterized tone map)
  else if (filterType == 19) {
    vec3 oil = floor(c * 6.0) / 6.0;
    outColor = oil;
  }
  // 20. Comic Book
  else if (filterType == 20) {
    vec3 comic = floor(c * 4.0) / 4.0;
    float lum = dot(c, vec3(0.299, 0.587, 0.114));
    if (lum < 0.25) comic = vec3(0.0);
    outColor = comic;
  }

  outColor = clamp(outColor, 0.0, 1.0);
  return vec4(mix(c, outColor, clamp(intensity, 0.0, 1.0)), baseColor.a);
}
`;
