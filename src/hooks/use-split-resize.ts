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

  pendingRatioRef.current = ratio;

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
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

      handle.setPointerCapture(event.pointerId);
      document.body.classList.add('workspace-split-resizing');
      handle.classList.add('dragging');

      const ratioAt = (clientX: number) =>
        clampRatio((clientX - bounds.left - gap / 2) / shared, shared);

      const onPointerMove = (moveEvent: PointerEvent) => {
        scheduleRatio(ratioAt(moveEvent.clientX));
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        handle.releasePointerCapture(event.pointerId);
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        applyRatio(ratioAt(upEvent.clientX));
        handle.classList.remove('dragging');
        document.body.classList.remove('workspace-split-resizing');
        setRatio(pendingRatioRef.current);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
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
