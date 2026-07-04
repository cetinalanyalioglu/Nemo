import raw from '../../../assets/glyphs/pipe.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Pipe schematic (a hand-drawn Inkscape export) normalized to a 100-wide viewBox
 * (src/assets/glyphs/pipe.svg): black strokes as `currentColor`, the flow passage
 * filled `var(--color-surface)`, hatched walls and arrowhead `<marker>`/`<pattern>`
 * ids namespaced per node instance. Aspect ≈ 1.50 (landscape).
 */
export const pipeGlyph = svgGlyph(raw, 0.5);
