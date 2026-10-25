import { transitionsGLSL } from "./transitions.glsl";

export const layerVertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;
  varying vec2 v_texCoord;

  uniform vec2 u_translation;
  uniform vec2 u_scale;
  uniform float u_rotation;

  void main() {
    float c = cos(u_rotation);
    float s = sin(u_rotation);
    mat2 rot = mat2(c, -s, s, c);

    vec2 scaled = a_position * u_scale;
    vec2 rotated = rot * scaled;
    vec2 pos = rotated + u_translation;

    gl_Position = vec4(pos, 0.0, 1.0);
    v_texCoord = vec2(a_texCoord.x, 1.0 - a_texCoord.y);
  }
`;

export const layerFragmentShaderSource = `
  precision mediump float;
  varying vec2 v_texCoord;
  uniform sampler2D u_image;
  uniform float u_opacity;

  void main() {
    vec4 color = texture2D(u_image, v_texCoord);
    gl_FragColor = vec4(color.rgb, color.a * u_opacity);
  }
`;

export const transitionFragmentShaderSource = `
  precision mediump float;
  varying vec2 v_texCoord;

  uniform sampler2D u_from;
  uniform sampler2D u_to;
  uniform float u_progress;
  uniform int u_type;
  uniform vec3 u_dip_color;

  ${transitionsGLSL}

  void main() {
    gl_FragColor = computeTransition(u_type, v_texCoord, clamp(u_progress, 0.0, 1.0), u_dip_color);
  }
`;

export function compileShader(
  gl: WebGLRenderingContext,
  source: string,
  type: number
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function createShaderProgram(
  gl: WebGLRenderingContext,
  vSource: string,
  fSource: string
): WebGLProgram | null {
  const vShader = compileShader(gl, vSource, gl.VERTEX_SHADER);
  const fShader = compileShader(gl, fSource, gl.FRAGMENT_SHADER);
  if (!vShader || !fShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Shader link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }

  return program;
}
