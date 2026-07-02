import raw from '../../../assets/glyphs/mdot.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * ṁ (mass-flow-rate) glyph, from a TeXtext `\bm{\dot{m}}` export normalized to a
 * 100-wide viewBox (src/assets/glyphs/mdot.svg). `opticalCenterY` centres on the
 * m-body (0.673 down the ink box) so the overdot floats above centre.
 */
export const mdotGlyph = svgGlyph(raw, 0.673);
