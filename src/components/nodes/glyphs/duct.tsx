import raw from '../../../assets/glyphs/duct.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Duct schematic (a hand-drawn Inkscape export) normalized to a 100-wide viewBox
 * (src/assets/glyphs/duct.svg): black strokes as `currentColor`, the flow passage
 * filled `var(--color-surface)`, hatched walls and arrowhead `<marker>`/`<pattern>`
 * ids namespaced per node instance. Aspect ≈ 1.50 (landscape).
 */
export const ductGlyph = svgGlyph(raw, 0.5);
