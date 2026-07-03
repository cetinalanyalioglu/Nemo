import raw from '../../../assets/glyphs/choked-nozzle.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Choked-nozzle schematic (an Inkscape export) normalized to a 100-wide viewBox
 * (src/assets/glyphs/choked-nozzle.svg): a converging passage to a sonic throat
 * labelled `M = 1`, black strokes as `currentColor`, the flow passage filled
 * `var(--color-surface)`, arrowhead `<marker>` ids namespaced per node instance.
 * Box-framed, so `opticalCenterY` is unused (placement is by whitespace insets).
 */
export const chokedNozzleGlyph = svgGlyph(raw, 0.5);
