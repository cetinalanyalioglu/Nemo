import raw from '../../../assets/glyphs/wall.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Wall schematic — a blanked semicircle with diagonal hatching (an Inkscape
 * export) normalized to a 100-wide viewBox (src/assets/glyphs/wall.svg): black
 * strokes and the hatch pattern as `currentColor`, `<pattern>` ids namespaced
 * per node instance. Its ink box is vertically symmetric, so it centres at 0.5.
 */
export const wallGlyph = svgGlyph(raw, 0.5);
