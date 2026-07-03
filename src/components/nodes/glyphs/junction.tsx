import raw from '../../../assets/glyphs/junction.svg?raw';
import { svgGlyph } from './load-glyph';

/**
 * Junction node-dot — a small filled disc in the theme ink (currentColor),
 * authored directly (no Inkscape) since it is a pure primitive. Drawn at the
 * centre of a circular frame whose radial ports fan evenly around it, so the
 * element reads as a graph node where flows meet. Symmetric, so it centres at 0.5.
 */
export const junctionGlyph = svgGlyph(raw, 0.5);
