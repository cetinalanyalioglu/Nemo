import raw from '../../../assets/glyphs/cavity.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Cavity glyph — a calligraphic volume symbol `\bm{\mathcal{V}}` (TeXtext export)
 * normalized to a 100-wide viewBox (src/assets/glyphs/cavity.svg). Its ink box is
 * near-square and roughly balanced, so it sits close to its geometric centre.
 */
export const cavityGlyph = svgGlyph(raw, 0.46);
