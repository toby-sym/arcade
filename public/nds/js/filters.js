// Image filters for the WebGL2 renderer (js/renderer.js, FrameRenderer.setPostProcess). Original GLSL ES 3.00, GPL-3.0.
//
// Each filter is {id, name, hint, scale, glsl}. `glsl` defines `vec4 mds_post(vec2 uv)` and may use everything
// renderer.js provides (mds_fetch, u_size, u_frameSize, u_src) plus the PRELUDE below. `scale` is how many output
// pixels the renderer draws per source pixel: LCD/CRT effects need a backing store bigger than the 256x384 frame,
// otherwise there is nothing to draw the gaps between pixels with. The renderer caps it (see MAX_OUTPUT_PIXELS).
//
// Rules for a filter (so it cannot break the game):
//   * NO geometric distortion (no curvature, no zoom): touch input is mapped by normalized position over the canvas.
//   * Everything works in DISPLAY space (after the frontend rotation), so every layout/rotation keeps working.
//   * Output stays within 0..1 (clamped) and is opaque.

// Helpers shared by every filter. u_src = displayed frame in SOURCE pixels, u_size = output canvas in pixels.
const PRELUDE = `
vec3 mds_px(vec2 p) {                      // source pixel at integer cell p (clamped to the frame)
  p = clamp(floor(p), vec2(0.0), u_src - 1.0);
  return mds_fetch((p + 0.5) / u_src).rgb;
}
vec3 mds_bilinear(vec2 p) {                // p in source pixels, continuous (texel centres at +0.5)
  vec2 q = p - 0.5; vec2 i = floor(q); vec2 f = fract(q);
  return mix(mix(mds_px(i), mds_px(i + vec2(1.0, 0.0)), f.x), mix(mds_px(i + vec2(0.0, 1.0)), mds_px(i + 1.0), f.x), f.y);
}
vec3 mds_smooth(vec2 p) {                  // bilinear with a smoothstep'd weight: rounder, cheaper than bicubic
  vec2 q = p - 0.5; vec2 i = floor(q); vec2 f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mds_px(i), mds_px(i + vec2(1.0, 0.0)), f.x), mix(mds_px(i + vec2(0.0, 1.0)), mds_px(i + 1.0), f.x), f.y);
}
vec3 mds_dscolor(vec3 c) {                 // DS LCD look: slightly washed, a touch cool, lifted mid-tones
  vec3 l = pow(c, vec3(2.2));
  vec3 o = vec3(l.r * 0.90 + l.g * 0.08 + l.b * 0.02, l.g * 0.88 + l.r * 0.04 + l.b * 0.08, l.b * 0.93 + l.g * 0.07);
  return pow(clamp(o, 0.0, 1.0), vec3(1.0 / 2.0));
}
`;

const wrap = (body) => PRELUDE + body;

export const FILTERS = [
  {
    id: "sharp-bilinear",
    name: "Bilineal nítido",
    hint: "Píxeles definidos con bordes suaves, sin el emborronado del escalado normal",
    scale: 4,
    glsl: wrap(`vec4 mds_post(vec2 uv) {
  vec2 p = uv * u_src;
  vec2 s = u_size / u_src;                              // output pixels per source pixel
  vec2 fl = floor(p), f = fract(p) - 0.5;
  vec2 range = 0.5 - 0.5 / s;                           // blend only inside one output pixel around the edge
  vec2 q = (f - clamp(f, -range, range)) * s + 0.5;
  return vec4(mds_bilinear(fl + q), 1.0);
}`),
  },
  {
    id: "smooth",
    name: "Suavizado",
    hint: "Interpolación redondeada: ideal si prefieres imagen suave a píxeles marcados",
    scale: 4,
    glsl: wrap(`vec4 mds_post(vec2 uv) { return vec4(mds_smooth(uv * u_src), 1.0); }`),
  },
  {
    id: "lcd",
    name: "Rejilla LCD",
    hint: "Separación entre píxeles y subpíxeles RGB, como la pantalla de la DS",
    scale: 3,
    glsl: wrap(`vec4 mds_post(vec2 uv) {
  vec2 p = uv * u_src; vec2 f = fract(p);
  vec3 c = mds_px(p);
  vec2 d = abs(f - 0.5) * 2.0;                          // 0 centre .. 1 edge of the pixel cell
  float edge = smoothstep(0.62, 1.0, max(d.x, d.y));
  float t = f.x * 3.0;                                  // RGB stripe across the pixel
  vec3 stripe = vec3(step(t, 1.0), step(1.0, t) * step(t, 2.0), step(2.0, t));
  vec3 tint = mix(vec3(1.0), 0.78 + 0.22 * stripe * 1.8, 0.35);
  return vec4(clamp(c * tint * (1.0 - 0.55 * edge) * 1.12, 0.0, 1.0), 1.0);
}`),
  },
  {
    id: "scanlines",
    name: "Líneas de escaneo",
    hint: "Oscurece el borde de cada fila de píxeles",
    scale: 3,
    glsl: wrap(`vec4 mds_post(vec2 uv) {
  vec2 p = uv * u_src; vec2 f = fract(p);
  vec3 c = mds_bilinear(vec2(p.x, floor(p.y) + 0.5));   // smooth horizontally, crisp vertically
  float edge = smoothstep(0.30, 1.0, abs(f.y - 0.5) * 2.0);
  return vec4(clamp(c * (1.0 - 0.5 * edge) * 1.12, 0.0, 1.0), 1.0);
}`),
  },
  {
    id: "crt",
    name: "CRT suave",
    hint: "Haz de tubo con máscara de apertura y viñeta ligera (sin curvar la imagen)",
    scale: 4,
    glsl: wrap(`vec4 mds_post(vec2 uv) {
  vec2 p = uv * u_src; vec2 f = fract(p);
  vec3 c = mds_bilinear(vec2(p.x, floor(p.y) + 0.5));
  float dy = (f.y - 0.5) * 2.0;
  float beam = exp(-2.2 * dy * dy);                     // gaussian beam profile across the row
  float col = mod(floor(uv.x * u_size.x), 3.0);         // aperture grille, one RGB triad per 3 output pixels
  vec3 mask = vec3(col < 1.0 ? 1.0 : 0.72, (col >= 1.0 && col < 2.0) ? 1.0 : 0.72, col >= 2.0 ? 1.0 : 0.72);
  float v = 1.0 - 0.22 * pow(length(uv - 0.5) * 1.35, 2.0);
  vec3 o = c * (0.4 + 0.6 * beam) * mask * v * 1.7;
  return vec4(clamp(o, 0.0, 1.0), 1.0);
}`),
  },
  {
    id: "dscolor",
    name: "Colores de la DS",
    hint: "Solo corrige el color a lo que mostraba la pantalla original (sin cambiar el tamaño)",
    scale: 1,
    glsl: wrap(`vec4 mds_post(vec2 uv) { return vec4(mds_dscolor(mds_fetch(uv).rgb), 1.0); }`),
  },
  {
    id: "ds-lcd",
    name: "Pantalla DS (LCD + color)",
    hint: "Rejilla LCD con la corrección de color de la consola",
    scale: 3,
    glsl: wrap(`vec4 mds_post(vec2 uv) {
  vec2 p = uv * u_src; vec2 f = fract(p);
  vec3 c = mds_dscolor(mds_px(p));
  vec2 d = abs(f - 0.5) * 2.0;
  float edge = smoothstep(0.7, 1.0, max(d.x, d.y));
  return vec4(clamp(c * (1.0 - 0.4 * edge) * 1.08, 0.0, 1.0), 1.0);
}`),
  },
];

export const FILTER_BY_ID = Object.fromEntries(FILTERS.map((f) => [f.id, f]));
