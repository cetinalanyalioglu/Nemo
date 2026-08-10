/**
 * That a theme change never leaves a pinned figure in the previous theme's colours.
 *
 * A pinned figure is a picture, so it is drawn again when the palette under it changes.
 * Drawing takes a moment, and the theme can be changed again inside that moment — so two
 * redraws end up writing into the same annotations, and without a guard the last picture
 * to finish wins rather than the one for the theme that is actually on.
 */

import { describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  /** Resolves each `figureToImage` call by hand, so two redraws can be interleaved. */
  pending: [] as { spec: unknown; resolve: (src: string) => void }[],
}));

vi.mock('./pin-figure', () => ({
  figureToImage: (spec: unknown) =>
    new Promise<string>((resolve) => harness.pending.push({ spec, resolve })),
}));

const { useGraphStore } = await import('../store/graphStore');
const { redrawPinnedFigures } = await import('./redraw-figures');
const { ANNOTATION_NODE_TYPE } = await import('../types/annotations');

/** One pinned figure on the canvas, as `pinOutputToCanvas` leaves it. */
const pinOne = () => {
  useGraphStore.setState({
    nodes: [
      {
        id: 'annotation-1',
        type: ANNOTATION_NODE_TYPE,
        position: { x: 0, y: 0 },
        data: {
          annotation: {
            kind: 'image',
            text: '',
            style: {},
            layer: 'front',
            src: 'data:image/svg+xml,original',
            figure: { data: [], layout: {} },
          },
        },
      },
    ],
  } as never);
};

const srcOnCanvas = () =>
  (
    useGraphStore.getState().nodes[0].data as {
      annotation: { src: string };
    }
  ).annotation.src;

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('redrawing pinned figures for the theme now in use', () => {
  it('lets the newest theme win, not the drawing that happens to finish last', async () => {
    pinOne();

    // Two theme changes in quick succession: the first is still drawing when the second
    // is asked for, which double-clicking the theme toggle does.
    const first = redrawPinnedFigures();
    await tick();
    const second = redrawPinnedFigures();
    await tick();
    expect(harness.pending).toHaveLength(2);

    // The newer one finishes first, then the older one comes back with a stale picture.
    harness.pending[1].resolve('data:image/svg+xml,newest-theme');
    await tick();
    harness.pending[0].resolve('data:image/svg+xml,previous-theme');
    await Promise.all([first, second]);

    expect(srcOnCanvas()).toBe('data:image/svg+xml,newest-theme');
  });
});
