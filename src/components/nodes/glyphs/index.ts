import { svgGlyph } from './load-glyph';
import type { GlyphAsset } from './types';

/**
 * Registry of symbol/schematic glyphs referenceable from a model's node
 * definition via the `glyph` field (framed circle/box/rail elements).
 *
 * The registry is built from the SVG assets themselves: every file in
 * `src/assets/glyphs/*.svg` registers under its basename (e.g.
 * `helmholtz-resonator.svg` → key `helmholtz-resonator`), so adding a glyph is
 * dropping an SVG in that folder — no wrapper module needed. Authoring rules
 * live in `docs/glyphs.md`.
 */

/**
 * Per-glyph optical-centre overrides: fraction down the ink box where the
 * glyph's optical centre sits (see {@link GlyphAsset.opticalCenterY}). Only
 * read by the circular frame; glyphs not listed centre at 0.5.
 */
const OPTICAL_CENTER_Y: Record<string, number> = {
  mdot: 0.673, // centre on the m-body so the overdot floats above centre
  p: 0.42,
  pt: 0.44,
  cavity: 0.46,
  'helmholtz-resonator': 0.65,
};

/**
 * Per-glyph flow-passage centerline overrides: fraction down the viewBox where
 * the passage centerline (the dashed line in the artwork) runs (see
 * {@link GlyphAsset.portCenterY}). Left/right box ports anchor to this height;
 * glyphs not listed keep the mid-height 0.5.
 */
const PORT_CENTER_Y: Record<string, number> = {
  'helmholtz-resonator': 59 / 70, // main line runs under the backing cavity
  'mass-source': 40 / 64, // main line runs under the injector stub
};

const RAW_GLYPHS = import.meta.glob('../../../assets/glyphs/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const glyphRegistry: Record<string, GlyphAsset> = Object.fromEntries(
  Object.entries(RAW_GLYPHS).map(([path, raw]) => {
    const key = path.slice(path.lastIndexOf('/') + 1).replace(/\.svg$/, '');
    return [key, svgGlyph(raw, OPTICAL_CENTER_Y[key] ?? 0.5, PORT_CENTER_Y[key] ?? 0.5)];
  })
);

/** Resolves a glyph key to its asset, or undefined when missing/unregistered. */
export const resolveGlyph = (key?: string): GlyphAsset | undefined => {
  if (!key) return undefined;
  const glyph = glyphRegistry[key];
  if (!glyph) {
    console.warn(`Glyph "${key}" is not registered.`);
  }
  return glyph;
};

export type { GlyphAsset } from './types';
export default glyphRegistry;
