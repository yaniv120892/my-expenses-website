/**
 * For an icon that points along the reading direction. The RTL style plugin
 * flips physical sides, not an SVG's drawing, so the glyph is mirrored here.
 */
export const MIRROR_IN_RTL_SX = {
  '[dir=rtl] &': { transform: 'scaleX(-1)' },
};
