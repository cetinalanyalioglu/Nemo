import {
  getBezierPath,
  getStraightPath,
  getSmoothStepPath,
  getSimpleBezierPath,
  internalsSymbol,
} from 'reactflow';
import { Position } from 'reactflow';
import type { Node } from 'reactflow';
import type { EdgePathStyle } from '../../context/AppStateContext';

export const EDGE_MIDPOINT_MARKER_RADIUS = 6;

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

/** An edge endpoint resolved to the exact port point, with its outward normal. */
export interface PortAnchor {
  x: number;
  y: number;
  normal: Vec2;
}

/**
 * True on-canvas centre of an endpoint's handle, with the port's outward
 * normal. This bypasses React Flow's own endpoint math, which anchors the edge
 * at a handle-box EDGE picked by the handle's unrotated `Position`
 * (`getHandlePosition`: right→`x+width`, left→`x`, …). Our handles are centred
 * on the port point, so that is half a handle off even upright — and on a
 * rotated element the measured box is the rotated handle's enlarged AABB, whose
 * `Position`-edge drifts further with the angle. The AABB *centre*, in
 * contrast, is rotation-invariant: it is exactly the drawn port point at any
 * rotation (the rotation transform sits on the node's inner content div, so
 * handle offsets are measured relative to React Flow's unrotated node origin).
 *
 * `radial` (circular elements) derives the normal from the disc centre through
 * the port, so a manually-rotated port keeps an exact outward departure;
 * otherwise the handle's side normal is rotated with the element.
 *
 * Returns null until React Flow has measured the node (first paint).
 */
export const measuredPortAnchor = (
  node: Node | undefined,
  handleId: string | null | undefined,
  type: 'source' | 'target',
  radial: boolean
): PortAnchor | null => {
  const bounds = node?.[internalsSymbol]?.handleBounds?.[type];
  const handle = (handleId != null ? bounds?.find((h) => h.id === handleId) : bounds?.[0]) ?? null;
  const { positionAbsolute, width, height } = node ?? {};
  if (!node || !handle || !positionAbsolute || !width || !height) return null;

  const rotation = typeof node.data?.rotation === 'number' ? (node.data.rotation as number) : 0;
  // React Flow measures a handle's x/y from its on-screen bounding box (the
  // rotated AABB) but its width/height from offsetWidth/offsetHeight (the
  // unrotated box), so the AABB extents are reconstructed from the rotation to
  // land on the box centre — which is rotation-invariant.
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const aabbW = handle.width * cos + handle.height * sin;
  const aabbH = handle.width * sin + handle.height * cos;
  const x = positionAbsolute.x + handle.x + aabbW / 2;
  const y = positionAbsolute.y + handle.y + aabbH / 2;

  let normal: Vec2;
  if (radial) {
    const cx = positionAbsolute.x + width / 2;
    const cy = positionAbsolute.y + height / 2;
    const len = Math.hypot(x - cx, y - cy) || 1;
    normal = { x: (x - cx) / len, y: (y - cy) / len };
  } else {
    normal = rotatedPortNormal(handle.position, rotation);
  }
  return { x, y, normal };
};

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
