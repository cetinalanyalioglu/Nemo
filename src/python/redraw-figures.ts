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
 * Redraws every pinned figure in the colours now in use, and stores the result.
 *
 * Nothing happens where none was pinned, which is most sessions, so a theme change costs
 * nothing it did not already cost. A figure that will not draw keeps the picture it had:
 * an out-of-date figure is better than a hole where one was.
 */
export const redrawPinnedFigures = async (): Promise<void> => {
  const figures = pinnedFigures();
  if (figures.length === 0) return;

  const { updateAnnotation } = useGraphStore.getState();
  for (const { id, spec } of figures) {
    try {
      const src = await figureToImage(spec);
      // Not a history entry: this is the same figure, drawn for the colours now in use,
      // and undo should not walk back through a theme change.
      updateAnnotation(id, { src }, { recordHistory: false });
    } catch (error) {
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
