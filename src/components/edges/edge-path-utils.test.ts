/**
 * Where an edge leaves an element, and which way it is pointing when it does.
 *
 * React Flow anchors an edge at an edge of the handle's box, chosen by the handle's
 * `Position` — and it keeps reporting the unrotated `Position` however far the element
 * has been turned. Neither is what this canvas wants: the ports are drawn centred on
 * their point, and a turned element's ports have turned with it. So both the anchor and
 * the departure direction are reconstructed here, and the edge is built from those.
 *
 * The claim the reconstruction rests on is that a handle's *centre* is rotation-
 * invariant while its reported box is not, so that is what is checked at several angles
 * rather than at one.
 */

import { describe, expect, it } from 'vitest';
import {
  Position,
  getBezierPath,
  getSimpleBezierPath,
  getSmoothStepPath,
  getStraightPath,
  internalsSymbol,
} from 'reactflow';
import type { Node } from 'reactflow';
import type { EdgePathStyle } from '../../context/AppStateContext';
import {
  computeEdgePathGeometry,
  computeRotatedEdgePathGeometry,
  measuredPortAnchor,
  rotatedPortNormal,
  type Vec2,
} from './edge-path-utils';

describe('which way a port faces once its element has been turned', () => {
  it('faces the way it was drawn when nothing has been turned', () => {
    expect(rotatedPortNormal(Position.Right, 0)).toEqual({ x: 1, y: 0 });
    expect(rotatedPortNormal(Position.Left, 0)).toEqual({ x: -1, y: 0 });
    expect(rotatedPortNormal(Position.Top, 0)).toEqual({ x: 0, y: -1 });
    expect(rotatedPortNormal(Position.Bottom, 0)).toEqual({ x: 0, y: 1 });
  });

  it('turns clockwise on screen, where y grows downward', () => {
    // The direction CSS `rotate()` turns the element. Getting the sign wrong here is
    // invisible at 180° and wrong by a quarter turn everywhere else.
    const right = rotatedPortNormal(Position.Right, 90);
    expect(right.x).toBeCloseTo(0);
    expect(right.y).toBeCloseTo(1);
  });

  it('comes back to where it started after half a turn, and after a whole one', () => {
    const half = rotatedPortNormal(Position.Left, 180);
    expect(half.x).toBeCloseTo(1);
    expect(half.y).toBeCloseTo(0);
    const whole = rotatedPortNormal(Position.Top, 360);
    expect(whole.x).toBeCloseTo(0);
    expect(whole.y).toBeCloseTo(-1);
  });

  it('stays a unit vector at an angle that is not a right angle', () => {
    // The normal is used directly as a direction to place control points along; any
    // change in its length would scale the whole curve with it.
    const n = rotatedPortNormal(Position.Right, 37);
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(1);
  });

  it('falls back to pointing right for a side it does not recognise', () => {
    expect(rotatedPortNormal('nowhere' as Position, 0)).toEqual({ x: 1, y: 0 });
  });
});

/** Half-extents of a `w`×`h` box's bounding box once turned by `deg`. */
const aabb = (w: number, h: number, deg: number) => {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return { w: w * cos + h * sin, h: w * sin + h * cos };
};

/**
 * A node as React Flow reports it once measured, with one source handle whose drawn
 * centre sits at `centre` in flow coordinates.
 *
 * React Flow measures a handle's x/y off its on-screen bounding box — which grows as the
 * element turns — but its width/height off the unrotated element. This reproduces that
 * pairing, so what the anchor is given is what it would really be given at `rotation`.
 */
const nodeWithHandle = (opts: {
  centre: Vec2;
  rotation?: number;
  handle?: { w: number; h: number };
  position?: Position;
  id?: string | null;
  size?: { w: number; h: number };
}): Node => {
  const { centre, rotation = 0, handle = { w: 10, h: 10 }, position = Position.Right } = opts;
  const size = opts.size ?? { w: 80, h: 40 };
  const origin = { x: 100, y: 200 };
  const box = aabb(handle.w, handle.h, rotation);
  return {
    id: 'n1',
    type: 'generic',
    position: origin,
    positionAbsolute: origin,
    width: size.w,
    height: size.h,
    data: { rotation },
    [internalsSymbol]: {
      handleBounds: {
        source: [
          {
            id: opts.id ?? 'p1',
            position,
            // The bounding box's top-left, which is what React Flow hands over.
            x: centre.x - origin.x - box.w / 2,
            y: centre.y - origin.y - box.h / 2,
            width: handle.w,
            height: handle.h,
          },
        ],
      },
    },
  } as unknown as Node;
};

describe('the point an edge is anchored at', () => {
  it('lands on the drawn port, not on an edge of its box', () => {
    // React Flow would anchor at `x + width` for a right-hand port. The ports here are
    // drawn centred on their point, so that is half a handle out from the glyph.
    const node = nodeWithHandle({ centre: { x: 180, y: 220 } });
    const anchor = measuredPortAnchor(node, 'p1', 'source', false);
    expect(anchor!.x).toBeCloseTo(180);
    expect(anchor!.y).toBeCloseTo(220);
  });

  it('lands on the same point however far the element has been turned', () => {
    // The invariant the whole reconstruction rests on. The reported box grows with the
    // angle, so anything that used the unrotated width here would drift off the port —
    // a little at 30°, most at 45°, and back again at 90°, which is what makes it easy
    // to miss.
    for (const rotation of [0, 30, 45, 90, 137, 180, 271]) {
      const node = nodeWithHandle({ centre: { x: 180, y: 220 }, rotation });
      const anchor = measuredPortAnchor(node, 'p1', 'source', false);
      expect(anchor!.x).toBeCloseTo(180);
      expect(anchor!.y).toBeCloseTo(220);
    }
  });

  it('holds for a handle that is not square', () => {
    // A square handle hides a swapped width and height; an oblong one does not.
    const node = nodeWithHandle({
      centre: { x: 180, y: 220 },
      rotation: 40,
      handle: { w: 14, h: 6 },
    });
    const anchor = measuredPortAnchor(node, 'p1', 'source', false);
    expect(anchor!.x).toBeCloseTo(180);
    expect(anchor!.y).toBeCloseTo(220);
  });

  it('carries the port normal, turned with the element', () => {
    const node = nodeWithHandle({ centre: { x: 180, y: 220 }, rotation: 90 });
    const anchor = measuredPortAnchor(node, 'p1', 'source', false);
    expect(anchor!.normal.x).toBeCloseTo(0);
    expect(anchor!.normal.y).toBeCloseTo(1);
  });

  it('points a port on a circular element straight out of the disc', () => {
    // A port on a disc can be dragged anywhere round the rim, so its departure follows
    // the radius through it rather than whichever side it was declared on.
    const node = nodeWithHandle({
      centre: { x: 140, y: 200 },
      size: { w: 80, h: 80 },
      position: Position.Left,
    });
    const anchor = measuredPortAnchor(node, 'p1', 'source', true);
    // Centre of the disc is (140, 240); the port sits directly above it.
    expect(anchor!.normal.x).toBeCloseTo(0);
    expect(anchor!.normal.y).toBeCloseTo(-1);
  });

  it('takes the first handle when the edge names none', () => {
    const node = nodeWithHandle({ centre: { x: 180, y: 220 } });
    expect(measuredPortAnchor(node, null, 'source', false)).not.toBeNull();
  });

  it('is null for a handle the element does not have', () => {
    const node = nodeWithHandle({ centre: { x: 180, y: 220 } });
    expect(measuredPortAnchor(node, 'absent', 'source', false)).toBeNull();
  });

  it('is null on the side the edge does not attach to', () => {
    const node = nodeWithHandle({ centre: { x: 180, y: 220 } });
    expect(measuredPortAnchor(node, 'p1', 'target', false)).toBeNull();
  });

  it('is null until React Flow has measured the element', () => {
    // Every edge asks for this on the first paint, before any measurement exists. The
    // caller falls back to React Flow's own endpoints for that one frame.
    const unmeasured = { id: 'n1', position: { x: 0, y: 0 }, data: {} } as unknown as Node;
    expect(measuredPortAnchor(unmeasured, 'p1', 'source', false)).toBeNull();
    expect(measuredPortAnchor(undefined, 'p1', 'source', false)).toBeNull();
  });
});

/** Two ports facing each other across a gap, source on the left pointing right. */
const facing = {
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 0,
  sourceNormal: { x: 1, y: 0 },
  targetNormal: { x: -1, y: 0 },
};

/** The four control-point numbers out of `M sx,sy C c1x,c1y c2x,c2y tx,ty`. */
const controlsOf = (path: string): number[] => {
  const match = /C([-\d.]+),([-\d.]+) ([-\d.]+),([-\d.]+)/.exec(path);
  return match ? match.slice(1).map(Number) : [];
};

describe('the curve drawn between two turned ports', () => {
  it('leaves and enters along the normals it was given', () => {
    // Which is the point of the whole generalisation: the edge meets the border square
    // on at any angle, not only on the four sides React Flow knows about.
    const { path } = computeRotatedEdgePathGeometry(facing, 'bezier');
    const [c1x, c1y, c2x, c2y] = controlsOf(path);
    expect(c1y).toBeCloseTo(0);
    expect(c2y).toBeCloseTo(0);
    expect(c1x).toBeCloseTo(50);
    expect(c2x).toBeCloseTo(50);
  });

  it('reaches the control points half way along the gap', () => {
    const down = {
      ...facing,
      targetX: 0,
      targetY: 100,
      sourceNormal: { x: 0, y: 1 },
      targetNormal: { x: 0, y: -1 },
    };
    const [c1x, c1y, c2x, c2y] = controlsOf(computeRotatedEdgePathGeometry(down, 'bezier').path);
    expect(c1x).toBeCloseTo(0);
    expect(c1y).toBeCloseTo(50);
    expect(c2x).toBeCloseTo(0);
    expect(c2y).toBeCloseTo(50);
  });

  it('swings out gently when the other end lies behind the port', () => {
    // A port facing away from its partner has a negative gap. Halving that would pull
    // the control point backwards and fold the curve through the element; the square-
    // root reach bulges it out instead.
    const backward = { ...facing, sourceNormal: { x: -1, y: 0 }, targetNormal: { x: 1, y: 0 } };
    const [c1x] = controlsOf(computeRotatedEdgePathGeometry(backward, 'bezier').path);
    // gap = -100, so the reach is 0.25 * 25 * sqrt(100) = 62.5, out along the normal.
    expect(c1x).toBeCloseTo(-62.5);
  });

  it('puts the label where the curve actually passes', () => {
    // The midpoint marker is placed here, and it is dragged to move the edge, so a label
    // point off the curve is a marker the pointer does not find.
    const { path, labelX, labelY } = computeRotatedEdgePathGeometry(facing, 'bezier');
    const [c1x, c1y, c2x, c2y] = controlsOf(path);
    // B(1/2) of a cubic through the same four points.
    expect(labelX).toBeCloseTo(0.125 * (0 + 3 * c1x + 3 * c2x + 100));
    expect(labelY).toBeCloseTo(0.125 * (0 + 3 * c1y + 3 * c2y + 0));
  });

  it('halves the gap even backwards when the simple curve was asked for', () => {
    const backward = { ...facing, sourceNormal: { x: -1, y: 0 }, targetNormal: { x: 1, y: 0 } };
    const [c1x] = controlsOf(computeRotatedEdgePathGeometry(backward, 'simplebezier').path);
    expect(c1x).toBeCloseTo(50);
  });

  it('ignores the normals entirely when the edge is a straight line', () => {
    const oblique = { ...facing, sourceNormal: { x: 0.6, y: 0.8 } };
    expect(computeRotatedEdgePathGeometry(oblique, 'straight').path).toBe(
      computeRotatedEdgePathGeometry(facing, 'straight').path
    );
  });

  it('snaps an oblique port to a side when the route has to stay orthogonal', () => {
    // A stepped route is built from horizontal and vertical runs, so there is no oblique
    // departure for it to take; the normal is rounded to the side it points most nearly.
    const oblique = {
      ...facing,
      sourceNormal: { x: 0.94, y: 0.34 },
      targetNormal: { x: -0.94, y: 0.34 },
    };
    const [expected] = getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 0,
      targetPosition: Position.Left,
    });
    expect(computeRotatedEdgePathGeometry(oblique, 'smoothstep').path).toBe(expected);
  });

  it('resolves a normal poised exactly between two sides onto the horizontal', () => {
    // 45° is reachable by dragging a port, and a tie that resolved differently on each
    // call would flip the route between frames.
    const diagonal = {
      ...facing,
      sourceNormal: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
      targetNormal: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
    };
    const [expected] = getSmoothStepPath({
      sourceX: 0,
      sourceY: 0,
      sourcePosition: Position.Right,
      targetX: 100,
      targetY: 0,
      targetPosition: Position.Left,
    });
    expect(computeRotatedEdgePathGeometry(diagonal, 'smoothstep').path).toBe(expected);
  });
});

describe('the curve drawn between two upright ports', () => {
  const upright = {
    sourceX: 0,
    sourceY: 0,
    sourcePosition: Position.Right,
    targetX: 100,
    targetY: 50,
    targetPosition: Position.Left,
  };

  it('hands each style to the construction that belongs to it', () => {
    const helpers = {
      bezier: getBezierPath,
      simplebezier: getSimpleBezierPath,
      smoothstep: getSmoothStepPath,
      straight: getStraightPath,
    } as const;
    for (const [style, helper] of Object.entries(helpers)) {
      const [path, labelX, labelY] = helper(upright);
      expect(computeEdgePathGeometry(upright, style as EdgePathStyle)).toEqual({
        path,
        labelX,
        labelY,
      });
    }
  });

  it('draws a straight edge as one line to the other end', () => {
    expect(computeEdgePathGeometry(upright, 'straight').path).toBe('M 0,0L 100,50');
  });

  it('parts the two curved styles only where the other end lies behind', () => {
    // Forward, React Flow's bezier places its controls at the halfway projection, which
    // is exactly what the simple one always does — so the two coincide, and a test that
    // told them apart on a forward pair would be testing nothing.
    const forward = computeEdgePathGeometry(upright, 'bezier').path;
    expect(computeEdgePathGeometry(upright, 'simplebezier').path).toBe(forward);

    const behind = { ...upright, sourcePosition: Position.Left, targetPosition: Position.Right };
    expect(computeEdgePathGeometry(behind, 'simplebezier').path).not.toBe(
      computeEdgePathGeometry(behind, 'bezier').path
    );
  });

  it('falls back to the curved edge for a style it does not know', () => {
    // The style is read from saved settings, so a file written by a later version can
    // name one this build has never heard of.
    expect(computeEdgePathGeometry(upright, 'wobbly' as never).path).toBe(
      computeEdgePathGeometry(upright, 'bezier').path
    );
  });
});
