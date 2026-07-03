import raw from '../../../assets/glyphs/pt.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * p_t (total-pressure) glyph, from a TeXtext `\bm{p_t}` export normalized to a
 * 100-wide viewBox (src/assets/glyphs/pt.svg). `opticalCenterY` centres on the
 * p-bowl so the descender and the subscript `t` hang below centre.
 */
export const ptGlyph = svgGlyph(raw, 0.44);
