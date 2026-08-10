import { useCallback, useEffect, useRef } from 'react';
import { WORKSPACE_PANE_MIN_WIDTH } from '../types/console';

/**
 * Dragging the divider between the canvas and the notebook.
 *
 * A ratio rather than a width, so the arrangement someone chose survives a window
 * resize: two panes given fractions of whatever space there is keep their proportions,
 * where a pixel width would eat the other pane as the window narrows.
 *
 * While the pointer is down the ratio is written straight onto the container as a custom
 * property and nothing re-renders; the value is put into app state once, when the drag
 * ends. Exports {@link useSplitResize} and {@link clampRatio}.
 */

const SPLIT_RATIO_VAR = '--workspace-split-ratio';

/** How far one press of an arrow key moves the divider, as a fraction of the width. */
const KEY_STEP = 0.02;

/**
 * The canvas's share of the split, held far enough from either edge to leave both panes
 * usable.
 *
 * A container too narrow to give both their minimum has no honest answer, so it splits
 * evenly rather than favouring a side.
 *
 * @param ratio - The share asked for, as a fraction of `sharedWidth`.
 * @param sharedWidth - The width the two panes divide between them, in pixels. What the
 *     divider takes is not part of it, since the ratio never applies to that.
 * @param minPaneWidth - The narrowest either pane may become, in pixels.
 * @returns The share to use, between `minPaneWidth / sharedWidth` and its complement.
 */
export const clampRatio = (
  ratio: number,
  sharedWidth: number,
  minPaneWidth: number = WORKSPACE_PANE_MIN_WIDTH
): number => {
  if (!Number.isFinite(ratio) || !(sharedWidth > 0)) return 0.5;
  if (sharedWidth <= minPaneWidth * 2) return 0.5;
  const narrowest = minPaneWidth / sharedWidth;
  return Math.min(1 - narrowest, Math.max(narrowest, ratio));
};

export const useSplitResize = (ratio: number, setRatio: (ratio: number) => void) => {
  const splitRef = useRef<HTMLDivElement>(null);
  const pendingRatioRef = useRef(ratio);
  const rafRef = useRef<number | null>(null);
  /**
   * The drag going on now, and the handle on everything it put on the document.
   *
   * A drag listens on the document rather than on the divider, so that the pointer can
   * leave the divider without the drag ending — which is most of a drag. Those listeners
   * therefore outlive the element they were added for, and something has to be able to
   * take them off again from outside the drag: a pointer the browser cancels, or the
   * divider going away mid-drag, which switching the arrangement away from the split
   * does.
   */
  const dragRef = useRef<AbortController | null>(null);

  pendingRatioRef.current = ratio;

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      dragRef.current?.abort();
      dragRef.current = null;
      document.body.classList.remove('workspace-split-resizing');
    },
    []
  );

  const applyRatio = useCallback((next: number) => {
    const split = splitRef.current;
    if (!split) return;
    split.style.setProperty(SPLIT_RATIO_VAR, String(next));
    pendingRatioRef.current = next;
  }, []);

  const scheduleRatio = useCallback(
    (next: number) => {
      pendingRatioRef.current = next;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyRatio(pendingRatioRef.current);
      });
    },
    [applyRatio]
  );

  const onDividerPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();

      const split = splitRef.current;
      if (!split) return;

      const bounds = split.getBoundingClientRect();
      // The divider takes width of its own, so the space the two panes divide is what is
      // left of the container; measuring against that keeps the divider under the pointer
      // rather than a few pixels adrift of it.
      const handle = event.currentTarget;
      const gap = handle.offsetWidth;
      const shared = bounds.width - gap;

      // One drag at a time: anything still listening from a previous one is done with.
      dragRef.current?.abort();
      const drag = new AbortController();
      dragRef.current = drag;

      handle.setPointerCapture(event.pointerId);
      document.body.classList.add('workspace-split-resizing');
      handle.classList.add('dragging');

      const ratioAt = (clientX: number) =>
        clampRatio((clientX - bounds.left - gap / 2) / shared, shared);

      /** Everything a drag has to undo, however it ends. */
      const stopDragging = () => {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        // A cancelled pointer is one the browser has already taken back, so there may
        // be no capture left to release.
        if (handle.hasPointerCapture(event.pointerId)) {
          handle.releasePointerCapture(event.pointerId);
        }
        handle.classList.remove('dragging');
        document.body.classList.remove('workspace-split-resizing');
        // Takes the document listeners with it.
        drag.abort();
        if (dragRef.current === drag) dragRef.current = null;
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        scheduleRatio(ratioAt(moveEvent.clientX));
      };

      document.addEventListener('pointermove', onPointerMove, { signal: drag.signal });
      document.addEventListener(
        'pointerup',
        (upEvent: PointerEvent) => {
          stopDragging();
          applyRatio(ratioAt(upEvent.clientX));
          setRatio(pendingRatioRef.current);
        },
        { signal: drag.signal }
      );
      // A pointer the browser takes away mid-drag — a system gesture, a window
      // switch — ends the drag where it stood. There is no position to finish at,
      // since the pointer that had one is gone.
      document.addEventListener(
        'pointercancel',
        () => {
          stopDragging();
          setRatio(pendingRatioRef.current);
        },
        { signal: drag.signal }
      );
    },
    [setRatio, applyRatio, scheduleRatio]
  );

  // The divider can be reached and moved without a pointer, which is also what its
  // separator role promises anyone reading the page by other means.
  const onDividerKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const split = splitRef.current;
      if (!split) return;
      const shared = split.getBoundingClientRect().width - event.currentTarget.offsetWidth;
      const asked =
        event.key === 'ArrowLeft'
          ? ratio - KEY_STEP
          : event.key === 'ArrowRight'
            ? ratio + KEY_STEP
            : event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? 1
                : null;
      if (asked === null) return;
      event.preventDefault();
      const next = clampRatio(asked, shared);
      applyRatio(next);
      setRatio(next);
    },
    [ratio, setRatio, applyRatio]
  );

  return { splitRef, onDividerPointerDown, onDividerKeyDown };
};
