/**
 * Drawing a pinned figure again.
 *
 * A pinned figure is a picture, and a picture cannot be recoloured. But the drawing it
 * sits on is looked at in one theme and exported in another, so the picture has to be
 * made again from the figure it was made from — which is why the annotation keeps that
 * beside it.
 *
 * Twice, then: when the theme changes, so the canvas stays of a piece; and before an
 * export, in the colours a document is drawn in. The first replaces what is stored; the
 * second does not, because an export should not change the drawing it was taken from.
 */

import { figureToImage } from './pin-figure';
import { useGraphStore } from '../store/graphStore';
import { ANNOTATION_NODE_TYPE, type AnnotationData } from '../types/annotations';
import { logger } from '../utils/logger';

/** Every annotation that was pinned from a figure, with the figure it came from. */
const pinnedFigures = (): { id: string; spec: Record<string, unknown> }[] =>
  useGraphStore
    .getState()
    .nodes.filter((node) => node.type === ANNOTATION_NODE_TYPE)
    .map((node) => ({
      id: node.id,
      spec: (node.data?.annotation as AnnotationData | undefined)?.figure as
        | Record<string, unknown>
        | undefined,
    }))
    .filter((entry): entry is { id: string; spec: Record<string, unknown> } => Boolean(entry.spec));

/**
 * Which redraw is the current one.
 *
 * Drawing a figure is asynchronous, and a theme can be changed again while the last
 * change is still being drawn for. Two runs would then be writing pictures for two
 * different palettes into the same annotations, and the one that finished last would
 * win — which is whichever figure happened to draw slower, not whichever theme is
 * actually on. So each run takes a number, and a run that is no longer the newest stops
 * rather than storing what it has drawn.
 */
let redrawGeneration = 0;

/**
 * Redraws every pinned figure in the colours now in use, and stores the result.
 *
 * Nothing happens where none was pinned, which is most sessions, so a theme change costs
 * nothing it did not already cost. A figure that will not draw keeps the picture it had:
 * an out-of-date figure is better than a hole where one was.
 */
export const redrawPinnedFigures = async (): Promise<void> => {
  const figures = pinnedFigures();
  if (figures.length === 0) return;

  const generation = ++redrawGeneration;
  const { updateAnnotation } = useGraphStore.getState();
  for (const { id, spec } of figures) {
    try {
      const src = await figureToImage(spec);
      // Checked after the drawing rather than before it: the wait is where a newer
      // theme change gets in, so this is the only point at which the answer can have
      // changed since the last figure was stored.
      if (generation !== redrawGeneration) return;
      // Not a history entry: this is the same figure, drawn for the colours now in use,
      // and undo should not walk back through a theme change.
      updateAnnotation(id, { src }, { recordHistory: false });
    } catch (error) {
      if (generation !== redrawGeneration) return;
      logger.warn(`A pinned figure could not be redrawn: ${String(error)}`);
    }
  }
};

/**
 * The pictures an export should place, drawn in document colours, keyed by annotation.
 *
 * Handed to the export rather than stored, so the drawing on screen is left exactly as
 * it was. Returns an empty map where nothing was pinned, which is the common case and
 * costs nothing.
 */
export const printableFigures = async (): Promise<Map<string, string>> => {
  const out = new Map<string, string>();
  for (const { id, spec } of pinnedFigures()) {
    try {
      out.set(id, await figureToImage(spec, { forPrint: true }));
    } catch (error) {
      // Leaving it out means the export places the picture already on the canvas, which
      // is the wrong colours but the right figure.
      logger.warn(`A pinned figure could not be prepared for export: ${String(error)}`);
    }
  }
  return out;
};
