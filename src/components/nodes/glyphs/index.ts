import type { GlyphAsset } from './types';
import { mdotGlyph } from './mdot';

/**
 * Registry of symbol glyphs referenceable from a model's node definition via the
 * `glyph` field (circular elements only). Add new glyphs here to make them
 * available to models.
 */
const glyphRegistry: Record<string, GlyphAsset> = {
  mdot: mdotGlyph,
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
