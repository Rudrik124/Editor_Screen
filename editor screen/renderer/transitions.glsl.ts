// Veytrix 20 Categorised GLSL Transitions Library
// All 20 transitions mapped to deterministic WebGL fragment shader code

export const transitionsGLSL = `
#define PI 3.14159265359

vec4 getFromColor(vec2 uv) {
  return texture2D(u_from, clamp(uv, 0.0, 1.0));
}

vec4 getToColor(vec2 uv) {
  return texture2D(u_to, clamp(uv, 0.0, 1.0));
}

vec2 rotateUV(vec2 uv, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(
    c * (uv.x - 0.5) - s * (uv.y - 0.5) + 0.5,
    s * (uv.x - 0.5) + c * (uv.y - 0.5) + 0.5
  );
}

vec4 sampleBlur(sampler2D tex, vec2 uv, vec2 dir, float radius) {
  vec4 color = texture2D(tex, clamp(uv, 0.0, 1.0)) * 0.28;
  color += (texture2D(tex, clamp(uv - dir * radius * 0.4, 0.0, 1.0)) + texture2D(tex, clamp(uv + dir * radius * 0.4, 0.0, 1.0))) * 0.21;
  color += (texture2D(tex, clamp(uv - dir * radius * 0.8, 0.0, 1.0)) + texture2D(tex, clamp(uv + dir * radius * 0.8, 0.0, 1.0))) * 0.11;
  color += (texture2D(tex, clamp(uv - dir * radius * 1.2, 0.0, 1.0)) + texture2D(tex, clamp(uv + dir * radius * 1.2, 0.0, 1.0))) * 0.04;
  return color;
}

vec4 sampleGaussianBlur(sampler2D tex, vec2 uv, float radius) {
  vec4 color = texture2D(tex, clamp(uv, 0.0, 1.0)) * 0.22;
  vec2 offH1 = vec2(radius * 0.45, 0.0);
  vec2 offH2 = vec2(radius * 0.95, 0.0);
  vec2 offV1 = vec2(0.0, radius * 0.45);
  vec2 offV2 = vec2(0.0, radius * 0.95);
  vec2 offD1 = vec2(radius * 0.55, radius * 0.55);
  vec2 offD2 = vec2(-radius * 0.55, radius * 0.55);

  color += (texture2D(tex, clamp(uv + offH1, 0.0, 1.0)) + texture2D(tex, clamp(uv - offH1, 0.0, 1.0))) * 0.15;
  color += (texture2D(tex, clamp(uv + offH2, 0.0, 1.0)) + texture2D(tex, clamp(uv - offH2, 0.0, 1.0))) * 0.07;
  color += (texture2D(tex, clamp(uv + offV1, 0.0, 1.0)) + texture2D(tex, clamp(uv - offV1, 0.0, 1.0))) * 0.15;
  color += (texture2D(tex, clamp(uv + offV2, 0.0, 1.0)) + texture2D(tex, clamp(uv - offV2, 0.0, 1.0))) * 0.07;
  color += (texture2D(tex, clamp(uv + offD1, 0.0, 1.0)) + texture2D(tex, clamp(uv - offD1, 0.0, 1.0))) * 0.05;
  color += (texture2D(tex, clamp(uv + offD2, 0.0, 1.0)) + texture2D(tex, clamp(uv - offD2, 0.0, 1.0))) * 0.05;
  return color;
}

vec4 computeTransition(int type, vec2 uv, float p, vec3 dipColor) {
  float sp = smoothstep(0.0, 1.0, p);

  // 1. Cross Dissolve
  if (type == 0) {
    return mix(getFromColor(uv), getToColor(uv), sp);
  }
  // 2. Fade to Black
  if (type == 1) {
    vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
    return p < 0.5 ? mix(getFromColor(uv), black, p * 2.0) : mix(black, getToColor(uv), (p - 0.5) * 2.0);
  }
  // 3. Fade to White
  if (type == 2) {
    vec4 white = vec4(1.0, 1.0, 1.0, 1.0);
    return p < 0.5 ? mix(getFromColor(uv), white, p * 2.0) : mix(white, getToColor(uv), (p - 0.5) * 2.0);
  }
  // 4. Dip to Color
  if (type == 3) {
    vec4 c = vec4(dipColor, 1.0);
    return p < 0.5 ? mix(getFromColor(uv), c, p * 2.0) : mix(c, getToColor(uv), (p - 0.5) * 2.0);
  }
  // 5. Instant Cut
  if (type == 4) {
    return p < 0.5 ? getFromColor(uv) : getToColor(uv);
  }
  // 6. Camera Shake
  if (type == 5) {
    float amp = sin(p * PI) * 0.05;
    vec2 offset = vec2(sin(p * 50.0) * amp, cos(p * 40.0) * amp);
    return mix(getFromColor(uv + offset), getToColor(uv - offset), p);
  }
  // 7. Crash Zoom
  if (type == 6) {
    float scaleFrom = 1.0 + p * p * 3.5;
    vec2 uvFrom = (uv - 0.5) / scaleFrom + 0.5;
    float scaleTo = 0.5 + p * 0.5;
    vec2 uvTo = (uv - 0.5) / scaleTo + 0.5;
    return mix(getFromColor(uvFrom), getToColor(uvTo), smoothstep(0.3, 0.8, p));
  }
  // 8. Whip Pan Left
  if (type == 7) {
    float radius = sin(p * PI) * 0.04;
    vec2 uvFrom = uv + vec2(p, 0.0);
    vec2 uvTo = uv - vec2(1.0 - p, 0.0);
    vec4 colFrom = sampleBlur(u_from, uvFrom, vec2(1.0, 0.0), radius);
    vec4 colTo = sampleBlur(u_to, uvTo, vec2(1.0, 0.0), radius);
    return mix(colFrom, colTo, step(1.0, uvFrom.x));
  }
  // 9. Zoom In
  if (type == 8) {
    float z = 1.0 + p * 0.6;
    vec2 uvFrom = (uv - 0.5) / z + 0.5;
    return mix(getFromColor(uvFrom), getToColor(uv), smoothstep(0.2, 0.8, p));
  }
  // 10. Zoom Out
  if (type == 9) {
    float z = 1.6 - p * 0.6;
    vec2 uvTo = (uv - 0.5) / z + 0.5;
    return mix(getFromColor(uv), getToColor(uvTo), smoothstep(0.2, 0.8, p));
  }
  // 11. Hyper Zoom
  if (type == 10) {
    float z = 1.0 + pow(p, 3.0) * 8.0;
    vec2 uvFrom = (uv - 0.5) / z + 0.5;
    return mix(getFromColor(uvFrom), getToColor(uv), smoothstep(0.4, 0.9, p));
  }
  // 12. Pulse Zoom
  if (type == 11) {
    float pulse = 1.0 + sin(p * PI * 2.0) * 0.25;
    vec2 uvP = (uv - 0.5) / pulse + 0.5;
    return mix(getFromColor(uvP), getToColor(uvP), p);
  }
  // 13. Slide Left
  if (type == 12) {
    return uv.x < (1.0 - p) ? getFromColor(uv + vec2(p, 0.0)) : getToColor(uv - vec2(1.0 - p, 0.0));
  }
  // 14. Slide Right
  if (type == 13) {
    return uv.x > p ? getFromColor(uv - vec2(p, 0.0)) : getToColor(uv + vec2(1.0 - p, 0.0));
  }
  // 15. Push Up
  if (type == 14) {
    return uv.y < (1.0 - p) ? getFromColor(uv + vec2(0.0, p)) : getToColor(uv - vec2(0.0, 1.0 - p));
  }
  // 16. Perspective Push
  if (type == 15) {
    float scale = 1.0 - 0.3 * sin(p * PI);
    vec2 warpUV = (uv - 0.5) * scale + 0.5;
    return warpUV.x < (1.0 - p) ? getFromColor(warpUV + vec2(p, 0.0)) : getToColor(warpUV - vec2(1.0 - p, 0.0));
  }
  // 17. Spin Left
  if (type == 16) {
    vec2 rUV = rotateUV(uv, -p * PI);
    return mix(getFromColor(rUV), getToColor(rUV), smoothstep(0.3, 0.7, p));
  }
  // 18. Spin Right
  if (type == 17) {
    vec2 rUV = rotateUV(uv, p * PI);
    return mix(getFromColor(rUV), getToColor(rUV), smoothstep(0.3, 0.7, p));
  }
  // 19. Motion Blur
  if (type == 18) {
    float blur = sin(p * PI) * 0.065;
    vec4 fromB = sampleBlur(u_from, uv, vec2(0.7071, 0.7071), blur);
    vec4 toB = sampleBlur(u_to, uv, vec2(0.7071, 0.7071), blur);
    return mix(fromB, toB, sp);
  }
  // 20. Gaussian Blur
  if (type == 19) {
    float blur = sin(p * PI) * 0.045;
    vec4 colFrom = sampleGaussianBlur(u_from, uv, blur);
    vec4 colTo = sampleGaussianBlur(u_to, uv, blur);
    return mix(colFrom, colTo, sp);
  }

  // Fallback linear mix with smoothstep
  return mix(getFromColor(uv), getToColor(uv), sp);
}
`;
