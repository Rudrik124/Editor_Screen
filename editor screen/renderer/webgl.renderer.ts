import {
  createShaderProgram,
  layerVertexShaderSource,
  layerFragmentShaderSource,
  transitionFragmentShaderSource,
} from "./webgl.shaders";

export interface LayerTransform {
  scale?: number;
  positionX?: number; // Normalized -1.0 to 1.0 or pixel offset
  positionY?: number;
  rotation?: number;  // Radians
  opacity?: number;   // 0.0 to 1.0
}

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;

  // Layer program
  private layerProgram: WebGLProgram | null = null;
  private layerPosLoc = -1;
  private layerTexLoc = -1;
  private layerTransLoc: WebGLUniformLocation | null = null;
  private layerScaleLoc: WebGLUniformLocation | null = null;
  private layerRotLoc: WebGLUniformLocation | null = null;
  private layerOpacityLoc: WebGLUniformLocation | null = null;
  private layerImageLoc: WebGLUniformLocation | null = null;

  // Transition program
  private transProgram: WebGLProgram | null = null;
  private transPosLoc = -1;
  private transTexLoc = -1;
  private transFromLoc: WebGLUniformLocation | null = null;
  private transToLoc: WebGLUniformLocation | null = null;
  private transProgLoc: WebGLUniformLocation | null = null;
  private transTypeLoc: WebGLUniformLocation | null = null;
  private transDipColorLoc: WebGLUniformLocation | null = null;

  // Buffers & textures
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private textureA: WebGLTexture | null = null;
  private textureB: WebGLTexture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initContext();
  }

  private initContext(): boolean {
    const gl =
      this.canvas.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: false,
      }) ||
      (this.canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) {
      console.warn("WebGL not supported");
      return false;
    }

    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // 1. Layer Program
    this.layerProgram = createShaderProgram(gl, layerVertexShaderSource, layerFragmentShaderSource);
    if (this.layerProgram) {
      this.layerPosLoc = gl.getAttribLocation(this.layerProgram, "a_position");
      this.layerTexLoc = gl.getAttribLocation(this.layerProgram, "a_texCoord");
      this.layerTransLoc = gl.getUniformLocation(this.layerProgram, "u_translation");
      this.layerScaleLoc = gl.getUniformLocation(this.layerProgram, "u_scale");
      this.layerRotLoc = gl.getUniformLocation(this.layerProgram, "u_rotation");
      this.layerOpacityLoc = gl.getUniformLocation(this.layerProgram, "u_opacity");
      this.layerImageLoc = gl.getUniformLocation(this.layerProgram, "u_image");
    }

    // 2. Transition Program
    this.transProgram = createShaderProgram(gl, layerVertexShaderSource, transitionFragmentShaderSource);
    if (this.transProgram) {
      this.transPosLoc = gl.getAttribLocation(this.transProgram, "a_position");
      this.transTexLoc = gl.getAttribLocation(this.transProgram, "a_texCoord");
      this.transFromLoc = gl.getUniformLocation(this.transProgram, "u_from");
      this.transToLoc = gl.getUniformLocation(this.transProgram, "u_to");
      this.transProgLoc = gl.getUniformLocation(this.transProgram, "u_progress");
      this.transTypeLoc = gl.getUniformLocation(this.transProgram, "u_type");
      this.transDipColorLoc = gl.getUniformLocation(this.transProgram, "u_dip_color");
    }

    // Quad geometry: standard clip space [-1, 1]
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]),
      gl.STATIC_DRAW
    );

    // TexCoords: [0, 1]
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0]),
      gl.STATIC_DRAW
    );

    // Textures
    this.textureA = this.createTexture(gl);
    this.textureB = this.createTexture(gl);

    return true;
  }

  private createTexture(gl: WebGLRenderingContext): WebGLTexture | null {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }

  public resize(width: number, height: number): void {
    if (!this.gl || width <= 0 || height <= 0) return;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  public clear(r = 0.0, g = 0.0, b = 0.0, a = 1.0): void {
    const gl = this.gl;
    if (!gl) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  public renderLayer(source: TexImageSource, transform: LayerTransform = {}): void {
    const gl = this.gl;
    if (!gl || !this.layerProgram || !this.textureA) return;

    gl.useProgram(this.layerProgram);

    // Upload texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textureA);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    } catch {
      return;
    }

    gl.uniform1i(this.layerImageLoc, 0);

    const scale = transform.scale ?? 1.0;
    // Map position offset (in pixels or % normalized to -1..1)
    const tx = ((transform.positionX ?? 0) / (this.canvas.width || 1)) * 2.0;
    const ty = -((transform.positionY ?? 0) / (this.canvas.height || 1)) * 2.0;

    gl.uniform2f(this.layerTransLoc, tx, ty);
    gl.uniform2f(this.layerScaleLoc, scale, scale);
    gl.uniform1f(this.layerRotLoc, transform.rotation ?? 0.0);
    gl.uniform1f(this.layerOpacityLoc, transform.opacity ?? 1.0);

    this.bindQuadAttributes(this.layerPosLoc, this.layerTexLoc);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public renderTransition(
    sourceA: TexImageSource,
    sourceB: TexImageSource,
    typeIndex: number,
    progress: number,
    dipColor: [number, number, number] = [0.0, 0.0, 0.0]
  ): void {
    const gl = this.gl;
    if (!gl || !this.transProgram || !this.textureA || !this.textureB) return;

    gl.useProgram(this.transProgram);

    // Texture A (from)
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textureA);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceA);
    } catch {
      return;
    }
    gl.uniform1i(this.transFromLoc, 0);

    // Texture B (to)
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textureB);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceB);
    } catch {
      return;
    }
    gl.uniform1i(this.transToLoc, 1);

    gl.uniform1f(this.transProgLoc, progress);
    gl.uniform1i(this.transTypeLoc, typeIndex);
    gl.uniform3f(this.transDipColorLoc, dipColor[0], dipColor[1], dipColor[2]);

    this.bindQuadAttributes(this.transPosLoc, this.transTexLoc);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  private bindQuadAttributes(posLoc: number, texLoc: number): void {
    const gl = this.gl;
    if (!gl) return;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);
  }

  public destroy(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.textureA) gl.deleteTexture(this.textureA);
    if (this.textureB) gl.deleteTexture(this.textureB);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
    if (this.layerProgram) gl.deleteProgram(this.layerProgram);
    if (this.transProgram) gl.deleteProgram(this.transProgram);
    this.gl = null;
  }
}
