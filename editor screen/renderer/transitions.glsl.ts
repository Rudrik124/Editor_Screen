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

// Directional motion blur direct samplers (avoid sampler2D function arguments for WebGL 1.0 compatibility)
vec4 sampleBlurFrom(vec2 uv, vec2 dir, float radius) {
  vec4 color = getFromColor(uv) * 0.28;
  color += (getFromColor(uv - dir * radius * 0.4) + getFromColor(uv + dir * radius * 0.4)) * 0.21;
  color += (getFromColor(uv - dir * radius * 0.8) + getFromColor(uv + dir * radius * 0.8)) * 0.11;
  color += (getFromColor(uv - dir * radius * 1.2) + getFromColor(uv + dir * radius * 1.2)) * 0.04;
  return color;
}

vec4 sampleBlurTo(vec2 uv, vec2 dir, float radius) {
  vec4 color = getToColor(uv) * 0.28;
  color += (getToColor(uv - dir * radius * 0.4) + getToColor(uv + dir * radius * 0.4)) * 0.21;
  color += (getToColor(uv - dir * radius * 0.8) + getToColor(uv + dir * radius * 0.8)) * 0.11;
  color += (getToColor(uv - dir * radius * 1.2) + getToColor(uv + dir * radius * 1.2)) * 0.04;
  return color;
}

// Normalized 2D Gaussian blur samplers (weights sum to exactly 1.0)
vec4 sampleGaussianBlurFrom(vec2 uv, float radius) {
  vec4 color = getFromColor(uv) * 0.20;
  vec2 offH1 = vec2(radius * 0.45, 0.0);
  vec2 offH2 = vec2(radius * 0.95, 0.0);
  vec2 offV1 = vec2(0.0, radius * 0.45);
  vec2 offV2 = vec2(0.0, radius * 0.95);
  vec2 offD1 = vec2(radius * 0.55, radius * 0.55);
  vec2 offD2 = vec2(-radius * 0.55, radius * 0.55);

  color += (getFromColor(uv + offH1) + getFromColor(uv - offH1)) * 0.12;
  color += (getFromColor(uv + offH2) + getFromColor(uv - offH2)) * 0.05;
  color += (getFromColor(uv + offV1) + getFromColor(uv - offV1)) * 0.12;
  color += (getFromColor(uv + offV2) + getFromColor(uv - offV2)) * 0.05;
  color += (getFromColor(uv + offD1) + getFromColor(uv - offD1)) * 0.03;
  color += (getFromColor(uv + offD2) + getFromColor(uv - offD2)) * 0.03;
  return color;
}

vec4 sampleGaussianBlurTo(vec2 uv, float radius) {
  vec4 color = getToColor(uv) * 0.20;
  vec2 offH1 = vec2(radius * 0.45, 0.0);
  vec2 offH2 = vec2(radius * 0.95, 0.0);
  vec2 offV1 = vec2(0.0, radius * 0.45);
  vec2 offV2 = vec2(0.0, radius * 0.95);
  vec2 offD1 = vec2(radius * 0.55, radius * 0.55);
  vec2 offD2 = vec2(-radius * 0.55, radius * 0.55);

  color += (getToColor(uv + offH1) + getToColor(uv - offH1)) * 0.12;
  color += (getToColor(uv + offH2) + getToColor(uv - offH2)) * 0.05;
  color += (getToColor(uv + offV1) + getToColor(uv - offV1)) * 0.12;
  color += (getToColor(uv + offV2) + getToColor(uv - offV2)) * 0.05;
  color += (getToColor(uv + offD1) + getToColor(uv - offD1)) * 0.03;
  color += (getToColor(uv + offD2) + getToColor(uv - offD2)) * 0.03;
  return color;
}

vec4 computeTransition(int type, vec2 uv, float p, vec3 dipColor) {
  float sp = smoothstep(0.0, 1.0, p);

  // 1. Cross Dissolve (type 0)
  if (type == 0) {
    return mix(getFromColor(uv), getToColor(uv), sp);
  }
  // 2. Fade to Black (type 1)
  if (type == 1) {
    vec4 black = vec4(0.0, 0.0, 0.0, 1.0);
    return p < 0.5 ? mix(getFromColor(uv), black, p * 2.0) : mix(black, getToColor(uv), (p - 0.5) * 2.0);
  }
  // 3. Fade to White (type 2)
  if (type == 2) {
    vec4 white = vec4(1.0, 1.0, 1.0, 1.0);
    return p < 0.5 ? mix(getFromColor(uv), white, p * 2.0) : mix(white, getToColor(uv), (p - 0.5) * 2.0);
  }
  // 4. Dip to Color (type 3)
  if (type == 3) {
    vec4 c = vec4(dipColor, 1.0);
    return p < 0.5 ? mix(getFromColor(uv), c, p * 2.0) : mix(c, getToColor(uv), (p - 0.5) * 2.0);
  }
  // 5. Instant Cut (type 4)
  if (type == 4) {
    return p < 0.5 ? getFromColor(uv) : getToColor(uv);
  }
  // 6. Camera Shake (type 5)
  if (type == 5) {
    float amp = sin(p * PI) * 0.04;
    vec2 offset = vec2(sin(p * 45.0) * amp, cos(p * 35.0) * amp);
    return mix(getFromColor(uv + offset), getToColor(uv - offset), sp);
  }
  // 7. Crash Zoom (type 6)
  if (type == 6) {
    float zFrom = 1.0 + pow(p, 2.0) * 2.5;
    vec2 uvFrom = (uv - 0.5) / zFrom + 0.5;
    float zTo = 1.0 + pow(1.0 - p, 2.0) * 1.5;
    vec2 uvTo = (uv - 0.5) / zTo + 0.5;
    return mix(getFromColor(uvFrom), getToColor(uvTo), smoothstep(0.3, 0.7, p));
  }
  // 8. Whip Pan Left (type 7)
  if (type == 7) {
    float radius = sin(p * PI) * 0.035;
    vec2 uvFrom = uv + vec2(p, 0.0);
    vec2 uvTo = uv - vec2(1.0 - p, 0.0);
    vec4 colFrom = sampleBlurFrom(uvFrom, vec2(1.0, 0.0), radius);
    vec4 colTo = sampleBlurTo(uvTo, vec2(1.0, 0.0), radius);
    return uv.x < (1.0 - p) ? colFrom : colTo;
  }
  // 9. Zoom In (type 8)
  if (type == 8) {
    float z = 1.0 + p * 0.6;
    vec2 uvFrom = (uv - 0.5) / z + 0.5;
    return mix(getFromColor(uvFrom), getToColor(uv), smoothstep(0.2, 0.8, p));
  }
  // 10. Zoom Out (type 9)
  if (type == 9) {
    float z = 1.0 + (1.0 - p) * 0.6;
    vec2 uvTo = (uv - 0.5) / z + 0.5;
    return mix(getFromColor(uv), getToColor(uvTo), smoothstep(0.2, 0.8, p));
  }
  // 11. Hyper Zoom (type 10)
  if (type == 10) {
    float z = 1.0 + pow(p, 3.0) * 5.0;
    vec2 uvFrom = (uv - 0.5) / z + 0.5;
    return mix(getFromColor(uvFrom), getToColor(uv), smoothstep(0.3, 0.85, p));
  }
  // 12. Pulse Zoom (type 11)
  if (type == 11) {
    float pulse = 1.0 + sin(p * PI) * 0.35;
    vec2 uvP = (uv - 0.5) / pulse + 0.5;
    return mix(getFromColor(uvP), getToColor(uvP), sp);
  }
  // 13. Slide Left (type 12)
  if (type == 12) {
    return uv.x < (1.0 - p) ? getFromColor(uv + vec2(p, 0.0)) : getToColor(uv - vec2(1.0 - p, 0.0));
  }
  // 14. Slide Right (type 13)
  if (type == 13) {
    return uv.x > p ? getFromColor(uv - vec2(p, 0.0)) : getToColor(uv + vec2(1.0 - p, 0.0));
  }
  // 15. Push Up (type 14)
  if (type == 14) {
    return uv.y < (1.0 - p) ? getFromColor(uv + vec2(0.0, p)) : getToColor(uv - vec2(0.0, 1.0 - p));
  }
  // 16. Perspective Push (type 15)
  if (type == 15) {
    float scale = 1.0 + sin(p * PI) * 0.15;
    vec2 warpUV = (uv - 0.5) / scale + 0.5;
    return uv.x < (1.0 - p) ? getFromColor(warpUV + vec2(p, 0.0)) : getToColor(warpUV - vec2(1.0 - p, 0.0));
  }
  // 17. Spin Left (type 16) - Outgoing rotates counterclockwise, incoming resolves from rotated state to 0
  if (type == 16) {
    float angleFrom = -p * PI;
    float angleTo = (1.0 - p) * PI;
    float zoom = 1.0 + sin(p * PI) * 0.45;
    vec2 uvFrom = rotateUV((uv - 0.5) / zoom + 0.5, angleFrom);
    vec2 uvTo = rotateUV((uv - 0.5) / zoom + 0.5, angleTo);
    return mix(getFromColor(uvFrom), getToColor(uvTo), smoothstep(0.3, 0.7, p));
  }
  // 18. Spin Right (type 17) - Outgoing rotates clockwise, incoming resolves to 0 right-side up
  if (type == 17) {
    float angleFrom = p * PI;
    float angleTo = -(1.0 - p) * PI;
    float zoom = 1.0 + sin(p * PI) * 0.45;
    vec2 uvFrom = rotateUV((uv - 0.5) / zoom + 0.5, angleFrom);
    vec2 uvTo = rotateUV((uv - 0.5) / zoom + 0.5, angleTo);
    return mix(getFromColor(uvFrom), getToColor(uvTo), smoothstep(0.3, 0.7, p));
  }
  // 19. Motion Blur (type 18)
  if (type == 18) {
    float blur = sin(p * PI) * 0.045;
    vec4 fromB = sampleBlurFrom(uv, vec2(0.7071, 0.7071), blur);
    vec4 toB = sampleBlurTo(uv, vec2(0.7071, 0.7071), blur);
    return mix(fromB, toB, sp);
  }
  // 20. Gaussian Blur (type 19)
  if (type == 19) {
    float blur = sin(p * PI) * 0.04;
    vec4 colFrom = sampleGaussianBlurFrom(uv, blur);
    vec4 colTo = sampleGaussianBlurTo(uv, blur);
    return mix(colFrom, colTo, sp);
  }

  // Fallback linear mix
  return mix(getFromColor(uv), getToColor(uv), sp);
}
`;
