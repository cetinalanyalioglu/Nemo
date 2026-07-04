import type { GlyphAsset } from './types';
import { mdotGlyph } from './mdot';
import { pGlyph } from './p';
import { ptGlyph } from './pt';
import { cavityGlyph } from './cavity';
import { wallGlyph } from './wall';
import { chokedNozzleGlyph } from './choked-nozzle';
import { suddenAreaChangeGlyph } from './sudden-area-change';
import { isentropicAreaChangeGlyph } from './isentropic-area-change';
import { ductGlyph } from './duct';
import { pipeGlyph } from './pipe';
import { junctionGlyph } from './junction';
import { losslessSplitterGlyph } from './lossless-splitter';

/**
 * Registry of symbol/schematic glyphs referenceable from a model's node
 * definition via the `glyph` field (framed circle/box elements). Add new glyphs
 * here to make them available to models.
 */
const glyphRegistry: Record<string, GlyphAsset> = {
  mdot: mdotGlyph,
  p: pGlyph,
  pt: ptGlyph,
  cavity: cavityGlyph,
  wall: wallGlyph,
  'choked-nozzle': chokedNozzleGlyph,
  'sudden-area-change': suddenAreaChangeGlyph,
  'isentropic-area-change': isentropicAreaChangeGlyph,
  duct: ductGlyph,
  pipe: pipeGlyph,
  junction: junctionGlyph,
  'lossless-splitter': losslessSplitterGlyph,
};

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
