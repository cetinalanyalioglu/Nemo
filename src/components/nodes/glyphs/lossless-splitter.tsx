import raw from '../../../assets/glyphs/lossless-splitter.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Lossless-splitter label — the isentropic condition `s_i = s_0` (entropy in =
 * entropy out) as a TeXtext export, rotated −90° so it runs vertically along the
 * manifold rail. Normalized to a 100-wide viewBox (very tall: aspect ≈ 0.218),
 * ink as `currentColor`. Rendered at a FIXED size inside the rail — it does not
 * scale as the element grows with its output-port count.
 */
export const losslessSplitterGlyph = svgGlyph(raw, 0.5);
