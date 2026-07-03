import { getBezierPath, getStraightPath, getSmoothStepPath, getSimpleBezierPath } from 'reactflow';
import { Position } from 'reactflow';
import type { EdgePathStyle } from '../../context/AppStateContext';

export const EDGE_MIDPOINT_MARKER_RADIUS = 6;

/**
 * Half the framed-node (circle/box/rail) handle size, in flow px. React Flow
 * reports a port's connection point at the handle's OUTER edge — half a handle
 * past the element border (`getHandlePosition`: right→`x+width`, left→`x`, …) —
 * so a handle centred on the port point sits half a width proud. Handles stay
 * centred (their hit area belongs over the port, not inside the node body); the
 * drawn edge is instead pulled back inward by this much to meet the element
 * flush. Keep in sync with the framed handle size in custom-node.css.
 */
export const FRAMED_PORT_HANDLE_HALF = 7;

/** Element shapes whose ports use the centred framed handle (and thus the inset). */
export const FRAMED_SHAPES = new Set(['circle', 'box', 'rail']);

/**
 * Pulls an edge endpoint inward (toward its node) by `amount` along the port's
 * outward normal, so React Flow's handle-edge connection point lands back on the
 * element border. A `0` amount (non-framed nodes) is a no-op.
 */
export const insetEndpoint = (
  x: number,
  y: number,
  position: Position,
  amount: number
): { x: number; y: number } => {
  switch (position) {
    case Position.Left:
      return { x: x + amount, y };
    case Position.Right:
      return { x: x - amount, y };
    case Position.Top:
      return { x, y: y + amount };
    case Position.Bottom:
      return { x, y: y - amount };
    default:
      return { x, y };
  }
};

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
