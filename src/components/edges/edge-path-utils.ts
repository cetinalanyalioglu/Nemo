import { getBezierPath, getStraightPath, getSmoothStepPath, getSimpleBezierPath } from 'reactflow';
import type { EdgePathStyle } from '../../context/AppStateContext';

export const EDGE_MIDPOINT_MARKER_RADIUS = 6;

export interface EdgePathGeometry {
  path: string;
  labelX: number;
  labelY: number;
}

export type EdgePathArgs = Parameters<typeof getBezierPath>[0];

/**
 * Computes edge path and label position using the same helper as the rendered path.
 * labelX/labelY sit on the path (suitable for midpoint markers and future labels).
 */
export function computeEdgePathGeometry(
  pathArgs: EdgePathArgs,
  edgePathStyle: EdgePathStyle
): EdgePathGeometry {
  switch (edgePathStyle) {
    case 'straight': {
      const [path, labelX, labelY] = getStraightPath(pathArgs);
      return { path, labelX, labelY };
    }
    case 'smoothstep': {
      const [path, labelX, labelY] = getSmoothStepPath(pathArgs);
      return { path, labelX, labelY };
    }
    case 'simplebezier': {
      const [path, labelX, labelY] = getSimpleBezierPath(pathArgs);
      return { path, labelX, labelY };
    }
    case 'bezier':
    default: {
      const [path, labelX, labelY] = getBezierPath(pathArgs);
      return { path, labelX, labelY };
    }
  }
}
