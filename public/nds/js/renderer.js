// Draws the single composed XRGB8888 frame the core delivers. There is NO screen compositor here: the core already
// placed both screens according to the layout; we only upload one texture, convert byte order, and apply the
// frontend rotation the core asked for (SET_ROTATION: Rotated Left / Rotated Right / Upside Down layouts).
//
// Backing store = displayed frame size (rotated), CSS does the scaling, so canvas coordinates == pointer space
// (the core transforms the pointer with the layout; see API_CONTRACT touchFromCanvas).

const VERT = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 uv = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = uv;
  gl_Position = vec4(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
}`;

// A post-process snippet must define:  vec4 mds_post(vec2 uv)   (uv: 0..1, y down, over the DISPLAYED frame)
// and may use: mds_fetch(uv) (RGBA, already converted from XRGB and rotated), u_size (OUTPUT canvas px), u_src (displayed
// frame in SOURCE px, i.e. u_size / scale), u_frameSize (unrotated frame px). Without a filter u_size == u_src.
const DEFAULT_POST = "vec4 mds_post(vec2 uv) { return mds_fetch(uv); }";

function fragSource(post) {
  return `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_frame;
uniform vec2 u_size;
uniform vec2 u_frameSize;
uniform vec2 u_src;
uniform int u_rotation;
in vec2 v_uv;
out vec4 o_color;
vec2 mds_texcoord(vec2 uv) {
  if (u_rotation == 1) return vec2(1.0 - uv.y, uv.x);        // image turned 90 deg counter-clockwise
  if (u_rotation == 2) return vec2(1.0 - uv.x, 1.0 - uv.y);
  if (u_rotation == 3) return vec2(uv.y, 1.0 - uv.x);
  return uv;
}
// XRGB8888 little-endian = bytes B,G,R,X; uploaded as RGBA8, so .rgb arrives as (B,G,R).
vec4 mds_fetch(vec2 uv) { vec4 c = texture(u_frame, mds_texcoord(uv)); return vec4(c.b, c.g, c.r, 1.0); }
${post}
void main() { o_color = mds_post(v_uv); }`;
}

/** Output pixels a filter may draw in total (a 4x 1024x768 hybrid frame would be 12 MP: too much for phones). */
const MAX_OUTPUT_PIXELS = 6e6;

export const SCANLINES = {
  name: "scanlines",
  glsl: `vec4 mds_post(vec2 uv) {
  vec4 c = mds_fetch(uv);
  float row = mod(floor(uv.y * u_size.y), 2.0);   // darken every second displayed row
  return vec4(c.rgb * (1.0 - 0.3 * row), 1.0);
}`,
};

/** Display size of a frame after the frontend rotation. */
export function displaySize(width, height, rotation) {
  return rotation & 1 ? { width: height, height: width } : { width, height };
}

export class FrameRenderer {
  /**
   * @param {HTMLCanvasElement} canvas  must be a real (main-thread) canvas so captureStream() works
   * @param {{backend?: "auto"|"webgl2"|"canvas2d", preserveDrawingBuffer?: boolean}} opts
   */
  constructor(canvas, { backend = "auto", preserveDrawingBuffer = true } = {}) {
    if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
      throw Object.assign(new Error("OffscreenCanvas is not supported: captureStream() needs the visible canvas"), { code: "NO_CANVAS" });
    }
    this.canvas = canvas;
    this.preserve = preserveDrawingBuffer;
    this.post = null;
    this.last = null; // {width,height,stride,rotation} of the last drawn frame, for redraw()
    this.scratch = new Uint8Array(0); // non-shared staging copy: WebGL rejects SharedArrayBuffer-backed views
    this.backend = "none";
    this.canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.contextLost = true; });
    this.canvas.addEventListener("webglcontextrestored", () => { this.contextLost = false; this.#initGL(); this.redraw(); });
    if (backend !== "canvas2d" && this.#initGL()) this.backend = "webgl2";
    else if (backend === "webgl2") throw Object.assign(new Error("WebGL2 is not available"), { code: "NO_WEBGL2" });
    else this.#init2D();
  }

  #initGL() {
    const gl = this.gl ?? this.canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: this.preserve, powerPreference: "high-performance" });
    if (!gl) return false;
    this.gl = gl;
    this.texW = this.texH = 0;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    this.vao = gl.createVertexArray();
    this.program = null;
    return this.#buildProgram(this.post?.glsl ?? DEFAULT_POST).ok || this.#buildProgram(DEFAULT_POST).ok;
  }

  #init2D() {
    this.ctx = this.canvas.getContext("2d", { alpha: false });
    if (!this.ctx) throw Object.assign(new Error("Neither WebGL2 nor Canvas2D is available"), { code: "NO_CANVAS" });
    this.backend = "canvas2d";
    this.stage = document.createElement("canvas"); // unrotated frame, only used when rotation != 0
  }

  #buildProgram(post) {
    const gl = this.gl;
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error(log); }
      return sh;
    };
    let prog;
    try {
      const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, fragSource(post));
      prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (error) {
      if (prog) gl.deleteProgram(prog);
      return { ok: false, error: String(error.message ?? error) };
    }
    if (this.program) gl.deleteProgram(this.program);
    this.program = prog;
    this.uniforms = Object.fromEntries(["u_frame", "u_size", "u_frameSize", "u_src", "u_rotation"].map((n) => [n, gl.getUniformLocation(prog, n)]));
    return { ok: true };
  }

  /** Filter hook. `{glsl}` must define `vec4 mds_post(vec2 uv)`; null restores the sharp default. Canvas2D ignores it. */
  setPostProcess(shader) {
    if (shader == null) {
      this.post = null;
      if (this.gl && !this.#buildProgram(DEFAULT_POST).ok) return { ok: false, error: "default shader failed" };
      this.redraw();
      return { ok: true };
    }
    if (typeof shader.glsl !== "string") return { ok: false, error: "setPostProcess expects {glsl: string}" };
    if (!this.gl) return { ok: false, error: "post-process needs the WebGL2 backend" };
    const result = this.#buildProgram(shader.glsl);
    if (result.ok) {
      const scale = Number.isFinite(shader.scale) ? Math.max(1, Math.min(6, Math.round(shader.scale))) : 1;
      this.post = { glsl: shader.glsl, scale };
      this.redraw();
    }
    return result; // on failure the previous program stays active
  }

  /** Output pixels per source pixel for the active filter (1 without one, on Canvas2D, or when the frame is too big). */
  #outScale(display) {
    if (this.backend !== "webgl2") return 1;
    let s = this.post?.scale ?? 1;
    while (s > 1 && display.width * display.height * s * s > MAX_OUTPUT_PIXELS) s--;
    return s;
  }

  /** Backing-store size for a displayed frame (the frame itself, times the filter's scale). */
  #fitBacking(display) {
    const s = this.#outScale(display);
    const w = display.width * s, h = display.height * s;
    // Resizing clears the canvas; drawing in the same task keeps the cleared state from ever being presented (no flicker).
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  /** @param {{width:number,height:number,stride:number,rotation?:number,data:Uint8Array}} f */
  draw(f) {
    const rotation = (f.rotation ?? 0) & 3;
    this.#fitBacking(displaySize(f.width, f.height, rotation));

    let pixels = f.data, rowPixels = f.stride >> 2;
    if (f.stride & 3) { // never seen for XRGB8888, but libretro allows any pitch: repack tightly
      const tight = new Uint8Array(f.width * f.height * 4);
      for (let y = 0; y < f.height; y++) tight.set(f.data.subarray(y * f.stride, y * f.stride + f.width * 4), y * f.width * 4);
      pixels = tight; rowPixels = f.width;
    }
    if (this.scratch.length < pixels.length) this.scratch = new Uint8Array(pixels.length);
    this.scratch.set(pixels);
    this.last = { width: f.width, height: f.height, rowPixels, rotation, length: pixels.length };
    this.#present();
  }

  redraw() { if (this.last) this.#present(); }

  #present() {
    const { width, height, rowPixels, rotation, length } = this.last;
    const display = displaySize(width, height, rotation);
    if (this.backend === "webgl2") {
      if (this.contextLost) return;
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, rowPixels);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      const src = this.scratch.subarray(0, length);
      if (this.texW !== width || this.texH !== height) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
        this.texW = width; this.texH = height;
      } else {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, src);
      }
      gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
      this.#fitBacking(display);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.useProgram(this.program);
      gl.uniform1i(this.uniforms.u_frame, 0);
      gl.uniform2f(this.uniforms.u_size, this.canvas.width, this.canvas.height);
      gl.uniform2f(this.uniforms.u_src, display.width, display.height);
      gl.uniform2f(this.uniforms.u_frameSize, width, height);
      gl.uniform1i(this.uniforms.u_rotation, rotation);
      gl.bindVertexArray(this.vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      return;
    }
    // Canvas2D: XRGB (bytes B,G,R,X) -> RGBA (bytes R,G,B,255) one 32-bit word at a time.
    const src32 = new Uint32Array(this.scratch.buffer, 0, length >> 2);
    const image = new ImageData(width, height);
    const dst32 = new Uint32Array(image.data.buffer);
    for (let y = 0; y < height; y++) {
      const s = y * rowPixels, d = y * width;
      for (let x = 0; x < width; x++) {
        const p = src32[s + x];
        dst32[d + x] = 0xff000000 | ((p & 0xff) << 16) | (p & 0xff00) | ((p >>> 16) & 0xff);
      }
    }
    if (rotation === 0) { this.ctx.putImageData(image, 0, 0); return; }
    this.stage.width = width; this.stage.height = height;
    this.stage.getContext("2d").putImageData(image, 0, 0);
    const m = [null, [0, -1, 1, 0, 0, width], [-1, 0, 0, -1, width, height], [0, 1, -1, 0, height, 0]][rotation];
    this.ctx.setTransform(...m);
    this.ctx.drawImage(this.stage, 0, 0);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}

/**
 * Sizes the canvas through CSS only (backing store untouched). Integer scale when at least 1x fits, else the
 * largest fractional fit; the canvas is exactly the frame rectangle, so there are no bars to subtract and
 * (clientX - rect.left) / rect.width is the normalized pointer position the core expects.
 */
export function fitCanvas(canvas, box, { integer = true, smooth = false } = {}) {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(box.width / canvas.width, box.height / canvas.height);
  let scale = fit; // CSS px per frame px
  const whole = integer && fit * dpr >= 1;
  if (whole) scale = Math.floor(fit * dpr) / dpr; // whole DEVICE pixels per frame pixel
  canvas.style.width = `${canvas.width * scale}px`;
  canvas.style.height = `${canvas.height * scale}px`;
  // pixelated for crisp integer scaling; "auto" gives the browser's bilinear smoothing
  canvas.style.imageRendering = smooth ? "auto" : "pixelated";
  return { scale, integer: whole };
}
