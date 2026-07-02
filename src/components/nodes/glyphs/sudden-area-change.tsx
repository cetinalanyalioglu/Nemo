import raw from '../../../assets/glyphs/sudden-area-change.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Sudden-area-change schematic (a hand-drawn Inkscape export) normalized to a
 * 100-wide viewBox (src/assets/glyphs/sudden-area-change.svg): black strokes as
 * `currentColor`, the flow passage filled `var(--color-surface)`, arrowhead
 * `<marker>` ids namespaced per node instance. Aspect ≈ 1.71 (landscape).
 */
export const suddenAreaChangeGlyph = svgGlyph(raw, 0.5);
