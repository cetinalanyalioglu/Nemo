/**
 * Putting a figure on the drawing.
 *
 * A figure that earns a place on the canvas is a *finding* — part of the document you
 * would export, beside the network it came from. So a pinned figure becomes an
 * annotation, which is the layer the canvas already keeps such things on: it has a
 * position, it can be moved, resized, rotated, hidden and locked, and it is already
 * written into the SVG and the PDF the canvas exports.
 *
 * It is pinned as a **picture of the figure**, not as a live one. That is deliberate
 * twice over: a picture is what the export path already knows how to place, and a
 * finding pinned to a drawing should keep saying what it said when it was pinned. Re-run
 * the cell and pin again to bring it up to date.
 *
 * And it is drawn in the colours a *document* is drawn in rather than the ones the
 * interface happens to be using. In the Results tab a figure is part of the interface
 * and follows it; pinned to the drawing it becomes part of what the drawing exports, and
 * what a drawing exports is read on white. A figure pinned from a dark session would
 * otherwise be pale ink on a page with nothing pale ink was meant to sit on.
 */

import { useGraphStore } from '../store/graphStore';
import { ANNOTATION_NODE_TYPE } from '../types/annotations';
import { applyPrintTheme } from '../utils/canvas-export/print-theme';
import { readFigurePalette, themedLayout } from '../utils/figure-theme';
import { logger } from '../utils/logger';
import { hasData, joinLines, type CellOutput, type MultilineString } from '../types/notebook';
import { loadPlotly } from '../components/notebook/CellOutputView';

/** How wide a pinned figure is drawn, in canvas units. */
const PINNED_WIDTH = 420;

/** How far from the top-left of the view a pin lands when nothing better is known. */
const PIN_OFFSET = 48;

/**
 * Draws `spec` off-screen and takes its picture.
 *
 * Plotly can only produce an image from an element it has drawn into, so one is made,
 * drawn into, photographed and thrown away. It is kept out of the layout while that
 * happens, but not hidden with `display: none`: an element with no box has no size for
 * plotly to draw at.
 */
const figureToImage = async (spec: Record<string, unknown>): Promise<string> => {
  const Plotly = await loadPlotly();
  const holder = document.createElement('div');
  holder.style.cssText = `position:fixed;left:-10000px;top:0;width:${PINNED_WIDTH}px;height:${Math.round(
    PINNED_WIDTH * 0.62
  )}px;`;
  document.body.appendChild(holder);
  try {
    // Read in the theme a document is drawn in rather than the one on screen, and left
    // opaque: a pinned figure has to carry its own contrast, since it can be looked at
    // on a dark canvas and printed on a white page without being drawn again between.
    const restoreTheme = applyPrintTheme();
    let palette;
    try {
      palette = readFigurePalette();
    } finally {
      restoreTheme();
    }
    const layout = themedLayout(spec.layout, palette);
    await Plotly.newPlot(
      holder,
      (spec.data ?? []) as never,
      layout as never,
      {
        staticPlot: true,
      } as never
    );
    return await Plotly.toImage(holder, { format: 'svg' });
  } finally {
    Plotly.purge(holder);
    holder.remove();
  }
};

/** An SVG document as a data URI the canvas can place. */
const svgToDataUri = (svg: string): string =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

/** Base64 image data as the data URI for its media type. */
const base64ToDataUri = (mime: string, encoded: string): string =>
  `data:${mime};base64,${encoded.replace(/\s/g, '')}`;

/** The picture of `output`, whichever form it offered, or nothing when it has none. */
const pictureOf = async (output: CellOutput): Promise<string | null> => {
  if (!hasData(output)) return null;
  const data = output.data;
  const text = (value: unknown) => joinLines(value as MultilineString | undefined);

  const plotly = data['application/vnd.plotly.v1+json'];
  if (plotly !== undefined) return figureToImage(plotly as Record<string, unknown>);
  if (data['image/svg+xml'] !== undefined) return svgToDataUri(text(data['image/svg+xml']));
  if (data['image/png'] !== undefined) return base64ToDataUri('image/png', text(data['image/png']));
  if (data['image/jpeg'] !== undefined)
    return base64ToDataUri('image/jpeg', text(data['image/jpeg']));
  return null;
};

/**
 * Pins one output to the canvas.
 *
 * Reports rather than throws: this is a button, and a figure that will not draw is
 * something to say in the message log, not something to break a notebook over.
 */
export const pinOutputToCanvas = async (output: CellOutput, name?: string): Promise<void> => {
  let src: string | null = null;
  try {
    src = await pictureOf(output);
  } catch (error) {
    logger.error(`Could not pin the figure: ${error instanceof Error ? error.message : error}`);
    return;
  }
  if (!src) {
    logger.error('That output has nothing to pin: it is not a figure or an image.');
    return;
  }

  const { addAnnotation, updateAnnotation } = useGraphStore.getState();
  // Landing them in a diagonal keeps successive pins from stacking exactly on top of
  // one another, which would look like only one arrived.
  const pinned = useGraphStore
    .getState()
    .nodes.filter((n) => n.type === ANNOTATION_NODE_TYPE).length;
  const node = addAnnotation({
    kind: 'image',
    src,
    position: { x: PIN_OFFSET + pinned * 24, y: PIN_OFFSET + pinned * 24 },
    style: { width: PINNED_WIDTH },
  });
  if (!node) {
    logger.error('Could not pin the figure to the canvas.');
    return;
  }
  // Named so the annotations pane lists it as a figure rather than as a nameless image.
  updateAnnotation(node.id, { name: name ?? `Figure ${pinned + 1}` }, { recordHistory: false });
  logger.success('Pinned the figure to the canvas; it exports with the drawing.');
};
