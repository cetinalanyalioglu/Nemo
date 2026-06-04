import { memo } from 'react';
import { useViewport } from 'reactflow';
import ZoomIndicator from './ZoomIndicator';

/**
 * Reads zoom from React Flow's internal store so pan/zoom does not fan out
 * through AppStateContext to every node and edge.
 */
export const CanvasZoomIndicator = memo(() => {
  const { zoom } = useViewport();
  return <ZoomIndicator zoom={zoom} />;
});

CanvasZoomIndicator.displayName = 'CanvasZoomIndicator';
