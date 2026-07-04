import raw from '../../../assets/glyphs/isentropic-area-change.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Isentropic-area-change schematic (a hand-drawn Inkscape export) normalized to a
 * 100-wide viewBox (src/assets/glyphs/isentropic-area-change.svg): black strokes
 * as `currentColor`, the flow passage filled `var(--color-surface)`, arrowhead
 * `<marker>` ids namespaced per node instance. Aspect ≈ 1.40 (landscape).
 */
export const isentropicAreaChangeGlyph = svgGlyph(raw, 0.5);
