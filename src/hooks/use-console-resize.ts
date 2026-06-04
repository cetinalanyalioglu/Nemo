import { useCallback, useEffect, useRef } from 'react';
import { CONSOLE_MAX_HEIGHT_RATIO, CONSOLE_MIN_HEIGHT } from '../types/console';

const CONSOLE_HEIGHT_VAR = '--console-pane-height';

const clampHeight = (height: number, maxHeight: number): number =>
  Math.min(maxHeight, Math.max(CONSOLE_MIN_HEIGHT, height));

export const useConsoleResize = (
  height: number,
  setHeight: (height: number) => void,
  isOpen: boolean
) => {
  const paneRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef(height);
  const maxHeightRef = useRef(CONSOLE_MIN_HEIGHT);
  const pendingHeightRef = useRef(height);
  const rafRef = useRef<number | null>(null);

  heightRef.current = height;

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      const pane = paneRef.current;
      if (pane) {
        pane.classList.remove('resizing');
      }
      document.body.classList.remove('console-pane-resizing');
    },
    []
  );

  const applyPaneHeight = useCallback((nextHeight: number) => {
    const pane = paneRef.current;
    if (!pane) return;
    pane.style.setProperty(CONSOLE_HEIGHT_VAR, `${nextHeight}px`);
    pendingHeightRef.current = nextHeight;
  }, []);

  const schedulePaneHeight = useCallback(
    (nextHeight: number) => {
      pendingHeightRef.current = nextHeight;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        applyPaneHeight(pendingHeightRef.current);
      });
    },
    [applyPaneHeight]
  );

  const flushPaneHeight = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    applyPaneHeight(pendingHeightRef.current);
  }, [applyPaneHeight]);

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isOpen) return;
      event.preventDefault();

      const pane = paneRef.current;
      if (!pane) return;

      const workspace = pane.parentElement;
      maxHeightRef.current = workspace
        ? Math.max(
            CONSOLE_MIN_HEIGHT,
            Math.floor(workspace.clientHeight * CONSOLE_MAX_HEIGHT_RATIO)
          )
        : CONSOLE_MIN_HEIGHT;

      const startY = event.clientY;
      const startHeight = heightRef.current;
      pendingHeightRef.current = startHeight;

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);

      pane.classList.add('resizing');
      document.body.classList.add('console-pane-resizing');
      applyPaneHeight(startHeight);

      const onPointerMove = (moveEvent: PointerEvent) => {
        const delta = startY - moveEvent.clientY;
        schedulePaneHeight(clampHeight(startHeight + delta, maxHeightRef.current));
      };

      const onPointerUp = () => {
        handle.releasePointerCapture(event.pointerId);
        flushPaneHeight();
        pane.classList.remove('resizing');
        document.body.classList.remove('console-pane-resizing');
        setHeight(pendingHeightRef.current);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [isOpen, setHeight, applyPaneHeight, schedulePaneHeight, flushPaneHeight]
  );

  return { paneRef, onResizePointerDown };
};
