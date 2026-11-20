// Layout label -> value expected by melonds_screen_layout1..8 (API_CONTRACT.md table 2.1).
// Verified against third_party/melonds-ds/src/libretro/config/constants.hpp (values::*) and
// config/definitions/screen.hpp (ScreenLayout1). Passing the label itself makes the core ignore the option.
export const LAYOUT_VALUES = Object.freeze({
  "Top/Bottom": "top-bottom",
  "Bottom/Top": "bottom-top",
  "Left/Right": "left-right",
  "Right/Left": "right-left",
  "Top Only": "top",
  "Bottom Only": "bottom",
  "Large Screen (Focus Top)": "largescreen-top",
  "Large Screen (Focus Bottom)": "largescreen-bottom",
  "Flipped Large Screen (Focus Top)": "flipped-largescreen-top",
  "Flipped Large Screen (Focus Bottom)": "flipped-largescreen-bottom",
  "Hybrid (Focus Top)": "hybrid-top",
  "Hybrid (Focus Bottom)": "hybrid-bottom",
  "Flipped Hybrid (Focus Top)": "flipped-hybrid-top",
  "Flipped Hybrid (Focus Bottom)": "flipped-hybrid-bottom",
  "Rotated Left": "rotate-left",
  "Rotated Right": "rotate-right",
  "Upside Down": "rotate-180",
});

export const LAYOUTS = Object.freeze(Object.keys(LAYOUT_VALUES));
export const MAX_SCREEN_GAP = 126; // config/constants.hpp MAX_SCREEN_GAP
export const HYBRID_SMALL_SCREEN_VALUES = Object.freeze(["one", "both"]); // config/constants.hpp values::ONE / BOTH

function apiError(code, message) {
  return Object.assign(new Error(message), { code });
}

/** Core options that make `label` the one and only active layout. */
export function layoutOptions(label) {
  const value = LAYOUT_VALUES[label];
  if (!value) throw apiError("LAYOUT_INVALID", `Unknown layout "${label}"`);
  return { melonds_number_of_screen_layouts: "1", melonds_screen_layout1: value };
}

export function gapOptions(px) {
  const n = Math.round(Number(px));
  if (!Number.isFinite(n) || n < 0 || n > MAX_SCREEN_GAP) {
    throw apiError("GAP_INVALID", `Screen gap must be 0..${MAX_SCREEN_GAP}, got ${px}`);
  }
  return { melonds_screen_gap: String(n) };
}

export function hybridSmallScreenOptions(mode) {
  if (!HYBRID_SMALL_SCREEN_VALUES.includes(mode)) {
    throw apiError("HYBRID_INVALID", `Hybrid small screen must be "one" or "both", got "${mode}"`);
  }
  return { melonds_hybrid_small_screen: mode };
}
