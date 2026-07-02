import raw from '../../../assets/glyphs/p.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * p (pressure) glyph, from a TeXtext `\bm{p}` export normalized to a 100-wide
 * viewBox (src/assets/glyphs/p.svg). `opticalCenterY` centres the bowl (0.42
 * down) so the descender hangs below centre.
 */
export const pGlyph = svgGlyph(raw, 0.42);
