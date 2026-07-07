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

/** 2-D vector in flow coordinates (y grows downward). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Outward unit normal of each port side in the node's local frame. */
const PORT_BASE_NORMAL: Record<Position, Vec2> = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};

/**
 * Outward unit normal of a port after the node's on-canvas rotation. React Flow
 * keeps reporting the handle's unrotated `Position`, so a rotated element needs
 * its true departure direction reconstructed for the edge to leave the border
 * orthogonally (the handles themselves are left untouched).
 */
export const rotatedPortNormal = (position: Position, rotationDeg: number): Vec2 => {
  const base = PORT_BASE_NORMAL[position] ?? PORT_BASE_NORMAL[Position.Right];
  if (!rotationDeg) return base;
  // CSS rotate() is clockwise in screen coordinates (y down).
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: base.x * cos - base.y * sin, y: base.x * sin + base.y * cos };
};

/** Pulls an endpoint inward (against the outward normal) by `amount`. */
export const insetEndpointAlongNormal = (x: number, y: number, n: Vec2, amount: number): Vec2 => ({
  x: x - n.x * amount,
  y: y - n.y * amount,
});

/** Snaps an arbitrary outward normal to the dominant axis-aligned `Position`. */
const nearestPosition = (n: Vec2): Position => {
  if (Math.abs(n.x) >= Math.abs(n.y)) {
    return n.x >= 0 ? Position.Right : Position.Left;
  }
  return n.y >= 0 ? Position.Bottom : Position.Top;
};

/**
 * Control-point distance used by React Flow's bezier: half the forward gap, or
 * a gentle square-root reach when the other endpoint lies behind the port.
 */
const bezierControlOffset = (distance: number, curvature = 0.25): number =>
  distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance);

interface RotatedEdgePathArgs {
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  /** True outward normal at the source port (rotation applied). */
  sourceNormal: Vec2;
  /** True outward normal at the target port (rotation applied). */
  targetNormal: Vec2;
}

/**
 * Edge path for endpoints whose ports point in arbitrary (rotated) directions.
 * The bezier styles generalize React Flow's control-point construction from the
 * four axis-aligned sides to any normal, so the edge always leaves and enters
 * orthogonally to the element border; `smoothstep` snaps each normal to its
 * dominant axis (orthogonal routing has no notion of oblique ports); `straight`
 * is direction-free.
 */
export function computeRotatedEdgePathGeometry(
  args: RotatedEdgePathArgs,
  edgePathStyle: EdgePathStyle
): EdgePathGeometry {
  const { sourceX, sourceY, targetX, targetY, sourceNormal, targetNormal } = args;

  if (edgePathStyle === 'straight') {
    const [path, labelX, labelY] = getStraightPath({ sourceX, sourceY, targetX, targetY });
    return { path, labelX, labelY };
  }

  if (edgePathStyle === 'smoothstep') {
    const [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition: nearestPosition(sourceNormal),
      targetX,
      targetY,
      targetPosition: nearestPosition(targetNormal),
    });
    return { path, labelX, labelY };
  }

  // Forward gaps: how far the other endpoint lies along each port's normal.
  const sourceGap = (targetX - sourceX) * sourceNormal.x + (targetY - sourceY) * sourceNormal.y;
  const targetGap = (sourceX - targetX) * targetNormal.x + (sourceY - targetY) * targetNormal.y;
  // `simplebezier` places controls at the halfway projection regardless of
  // sign; the default bezier adds the square-root reach for backward targets.
  const sourceOffset =
    edgePathStyle === 'simplebezier' ? 0.5 * sourceGap : bezierControlOffset(sourceGap);
  const targetOffset =
    edgePathStyle === 'simplebezier' ? 0.5 * targetGap : bezierControlOffset(targetGap);

  const c1x = sourceX + sourceNormal.x * sourceOffset;
  const c1y = sourceY + sourceNormal.y * sourceOffset;
  const c2x = targetX + targetNormal.x * targetOffset;
  const c2y = targetY + targetNormal.y * targetOffset;

  const path = `M${sourceX},${sourceY} C${c1x},${c1y} ${c2x},${c2y} ${targetX},${targetY}`;
  // Cubic midpoint B(1/2) = (s + 3*c1 + 3*c2 + t) / 8, matching where React
  // Flow places its labels.
  const labelX = 0.125 * (sourceX + 3 * c1x + 3 * c2x + targetX);
  const labelY = 0.125 * (sourceY + 3 * c1y + 3 * c2y + targetY);
  return { path, labelX, labelY };
}

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
