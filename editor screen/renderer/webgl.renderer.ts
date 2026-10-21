import {
  createShaderProgram,
  vertexShaderSource,
  fragmentShaderSource,
} from "./webgl.shaders";

export interface RenderOptions {
  opacity?: number;
}

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private positionBuffer: WebGLBuffer | null = null;
  private texCoordBuffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;

  private positionLocation = -1;
  private texCoordLocation = -1;
  private imageLocation: WebGLUniformLocation | null = null;
  private opacityLocation: WebGLUniformLocation | null = null;

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
      (this.canvas.getContext(
        "experimental-webgl"
      ) as WebGLRenderingContext | null);

    if (!gl) {
      console.warn("WebGL not supported, falling back to 2D context");
      return false;
    }

    this.gl = gl;
    this.program = createShaderProgram(
      gl,
      vertexShaderSource,
      fragmentShaderSource
    );
    if (!this.program) return false;

    this.positionLocation = gl.getAttribLocation(this.program, "a_position");
    this.texCoordLocation = gl.getAttribLocation(this.program, "a_texCoord");
    this.imageLocation = gl.getUniformLocation(this.program, "u_image");
    this.opacityLocation = gl.getUniformLocation(this.program, "u_opacity");

    // Quad geometry: two triangles covering clip space [-1, 1]
    this.positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0,
      ]),
      gl.STATIC_DRAW
    );

    // Texture coords [0, 1]
    this.texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,
      ]),
      gl.STATIC_DRAW
    );

    // Texture allocation
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return true;
  }

  public resize(width: number, height: number): void {
    if (!this.gl || width <= 0 || height <= 0) return;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.gl.viewport(0, 0, width, height);
    }
  }

  public renderSource(
    source: HTMLVideoElement | HTMLImageElement,
    options: RenderOptions = {}
  ): void {
    const gl = this.gl;
    if (!gl || !this.program || !this.texture) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.08, 0.09, 0.11, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Bind texture & upload source frame
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    try {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source
      );
    } catch {
      // Frame may not be ready or cross-origin
      return;
    }

    gl.uniform1i(this.imageLocation, 0);
    gl.uniform1f(this.opacityLocation, options.opacity ?? 1.0);

    // Enable position attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.positionLocation);
    gl.vertexAttribPointer(this.positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Enable texCoord attribute
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.texCoordLocation);
    gl.vertexAttribPointer(this.texCoordLocation, 2, gl.FLOAT, false, 0, 0);

    // Draw full quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public clear(): void {
    const gl = this.gl;
    if (!gl) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.08, 0.09, 0.11, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  public destroy(): void {
    const gl = this.gl;
    if (!gl) return;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.positionBuffer) gl.deleteBuffer(this.positionBuffer);
    if (this.texCoordBuffer) gl.deleteBuffer(this.texCoordBuffer);
    if (this.program) gl.deleteProgram(this.program);
    this.gl = null;
  }
}
