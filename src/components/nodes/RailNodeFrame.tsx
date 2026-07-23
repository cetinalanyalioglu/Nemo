import { memo } from 'react';
import { resolveGlyph } from './glyphs';
import type { PortSide } from '../../types/flow';

/**
 * Manifold-rail element frame — a tall rounded bar for dynamic-port elements
 * (the splitter/junction family). Unlike the circle and box frames, the rail is
 * NOT scaled to fit a resizable box: its geometry is authored in px-equivalent
 * units and the node locks to those dimensions, so nothing distorts and the
 * label keeps a fixed size. Height grows with the port count; width is fixed.
 *
 * Draw order matches the other frames: interior fill → label → port triangles →
 * border stroke LAST, so the border clips the port bases seamlessly.
 *
 * The label (a rotated LaTeX glyph) is drawn at a FIXED size, centred — it does
 * not stretch as more ports lengthen the rail.
 */

/** All constants below are in design units (== px at zoom 1). */
const T = 1.4; // border thickness (rendered ~1.4px at zoom 1, matching circle/box)
const SIDE_GAP = 5.5; // horizontal gap between the label and each side border
const MIN_IW = 16; // floor on interior width, so a very narrow label still has a bar
// Port triangles are kept the same on-canvas size as the circular element's
// ports (base 0.6·R, height 0.285·R on a 40px/100-unit disc), so ports look
// consistent across the element library rather than larger on the rail.
const PORT_H = 4.7; // port-triangle height (radial extent past the border)
const PORT_BASE = 9.8; // port-triangle base
const PITCH = 22; // vertical spacing between adjacent ports on a side
const END_PAD = 15; // gap from the interior top/bottom to the first/last port
const PAD_X = PORT_H + 3; // margin so outward port tips fit the viewBox
const PAD_Y = 4;
const RX = 9; // corner radius
const LABEL_H = 44; // fixed label height (design units); never scales with the rail
// A near-square glyph (aspect >= BEAD_ASPECT, e.g. the junction's centre dot) is drawn as a
// fixed-size bead on a thin rail rather than a fat bar hugging the square glyph: the bar then
// takes the same slim width as the tall-glyph rails (the splitter), sized from BEAD_BAR_ASPECT.
const BEAD_ASPECT = 0.7;
const BEAD_BAR_ASPECT = 0.22;
/** Inset (design units) from each rounded corner within which a moved port may
    sit, so a dragged port never lands on a corner arc. */
const EDGE_INSET = RX + 2;

export type PortDirection = 'target' | 'source';

/** A rail port. Auto ports stack on the left/right at their `index`; a
    manually-moved port carries an explicit `side` and `offset` instead. */
export interface RailPort {
  suffix: string;
  /** Side the port renders on. Auto ports are left/right; a moved port may sit on
      any side (it also carries an explicit `offset`). */
  side: PortSide;
  index: number;
  count: number;
  direction: PortDirection;
  /** True when an edge is attached: the triangle is tinted ink-gray. */
  connected?: boolean;
  /** Normalized position [0,1] along `side` for a manually-moved port. When
      undefined the port uses its automatic stacked slot (`index`/`count`). */
  offset?: number;
}

export interface RailLayout {
  vw: number;
  vh: number;
  t: number;
  rx: number;
  fillRect: { x: number; y: number; w: number; h: number };
  borderRect: { x: number; y: number; w: number; h: number };
  label: { x: number; y: number; w: number; h: number };
  /** Point on the border centreline for a stacked port, plus its outward normal. */
  portAnchor: (
    side: 'left' | 'right',
    index: number,
    count: number
  ) => { x: number; y: number; nx: number; ny: number };
  /** Point on the border for an arbitrary side + normalized offset, plus its
      outward normal. Used for manually-moved ports. */
  anchorAt: (side: PortSide, offset: number) => { x: number; y: number; nx: number; ny: number };
  /** Nearest movable side + normalized offset for a point in viewBox units — the
      drag projection (closest point on the four corner-inset border segments). */
  project: (x: number, y: number) => { side: PortSide; offset: number };
  /** Usable straight length (design units) of a side's movable segment. */
  sideLength: (side: PortSide) => number;
}

/** Pure rail geometry, shared by the renderer and GenericNode (handles/size). */
export const railLayout = (maxPorts: number, glyphAspect: number): RailLayout => {
  const n = Math.max(1, maxPorts);
  const ih = (n - 1) * PITCH + 2 * END_PAD;
  // A tall glyph fills the bar (bar width hugs it); a near-square "bead" glyph is drawn at a
  // fixed square size, centred, over a thin bar sized like the tall-glyph rails, so the two
  // rail families read at the same proportions.
  const bead = glyphAspect >= BEAD_ASPECT;
  const gw = LABEL_H * (bead ? 1 : glyphAspect); // glyph box width (square for a bead)
  const barLw = LABEL_H * (bead ? BEAD_BAR_ASPECT : glyphAspect); // width the side bar hugs
  // Interior width hugs the bar reference so there is only a small gap between it and the side
  // ports; a bead's glyph may overflow this thin bar (it is centred and mostly transparent).
  const iw = Math.max(MIN_IW, barLw + 2 * SIDE_GAP);
  const ow = iw + 2 * T;
  const oh = ih + 2 * T;
  const vw = ow + 2 * PAD_X;
  const vh = oh + 2 * PAD_Y;
  const iy = PAD_Y + T; // interior top

  // Border centreline rectangle: port bases sit on it, so the stroke covers them.
  const leftX = PAD_X + T / 2;
  const rightX = PAD_X + ow - T / 2;
  const topY = PAD_Y + T / 2;
  const botY = PAD_Y + oh - T / 2;

  // Usable straight span on each side, inset from the rounded corners so a moved
  // port never lands on a corner arc. Collapses to the side midpoint when a side
  // is too short to admit the inset (narrow rails), so a port still centres cleanly.
  const usable = (lo: number, hi: number): [number, number] => {
    const a = lo + EDGE_INSET;
    const b = hi - EDGE_INSET;
    if (a <= b) return [a, b];
    const mid = (lo + hi) / 2;
    return [mid, mid];
  };
  const [vTop, vBot] = usable(topY, botY); // left/right run top → bottom
  const [hLeft, hRight] = usable(leftX, rightX); // top/bottom run left → right

  // Each movable side as a segment (a → b) with its outward normal.
  type Seg = { ax: number; ay: number; bx: number; by: number; nx: number; ny: number };
  const segments: Record<PortSide, Seg> = {
    left: { ax: leftX, ay: vTop, bx: leftX, by: vBot, nx: -1, ny: 0 },
    right: { ax: rightX, ay: vTop, bx: rightX, by: vBot, nx: 1, ny: 0 },
    top: { ax: hLeft, ay: topY, bx: hRight, by: topY, nx: 0, ny: -1 },
    bottom: { ax: hLeft, ay: botY, bx: hRight, by: botY, nx: 0, ny: 1 },
  };

  return {
    vw,
    vh,
    t: T,
    rx: RX,
    fillRect: { x: PAD_X, y: PAD_Y, w: ow, h: oh },
    borderRect: { x: leftX, y: topY, w: ow - T, h: oh - T },
    label: { x: vw / 2 - gw / 2, y: vh / 2 - LABEL_H / 2, w: gw, h: LABEL_H },
    portAnchor: (side, index, count) => {
      const span = (count - 1) * PITCH;
      const y0 = iy + (ih - span) / 2;
      const y = y0 + index * PITCH;
      if (side === 'left') return { x: leftX, y, nx: -1, ny: 0 };
      return { x: rightX, y, nx: 1, ny: 0 };
    },
    anchorAt: (side, offset) => {
      const s = segments[side];
      const t = Math.min(1, Math.max(0, offset));
      return { x: s.ax + t * (s.bx - s.ax), y: s.ay + t * (s.by - s.ay), nx: s.nx, ny: s.ny };
    },
    sideLength: (side) => {
      const s = segments[side];
      return Math.hypot(s.bx - s.ax, s.by - s.ay);
    },
    project: (x, y) => {
      let best: { side: PortSide; offset: number } = { side: 'left', offset: 0 };
      let bestDist = Infinity;
      (Object.keys(segments) as PortSide[]).forEach((side) => {
        const s = segments[side];
        const dx = s.bx - s.ax;
        const dy = s.by - s.ay;
        const len2 = dx * dx + dy * dy;
        let t = len2 === 0 ? 0 : ((x - s.ax) * dx + (y - s.ay) * dy) / len2;
        t = Math.min(1, Math.max(0, t));
        const cx = s.ax + t * dx;
        const cy = s.ay + t * dy;
        const dist = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (dist < bestDist) {
          bestDist = dist;
          best = { side, offset: t };
        }
      });
      return best;
    },
  };
};

/** Three-vertex `points` string for one port triangle (base on the border). */
const trianglePoints = (
  anchor: { x: number; y: number; nx: number; ny: number },
  direction: PortDirection
): string => {
  const { x, y, nx, ny } = anchor;
  const tx = -ny;
  const ty = nx; // tangent (vertical for left/right sides)
  const d = direction === 'source' ? PORT_H : -PORT_H;
  const px = x + d * nx;
  const py = y + d * ny; // tip
  const f = (v: number) => v.toFixed(3);
  return `${f(x + (PORT_BASE / 2) * tx)},${f(y + (PORT_BASE / 2) * ty)} ${f(px)},${f(py)} ${f(
    x - (PORT_BASE / 2) * tx
  )},${f(y - (PORT_BASE / 2) * ty)}`;
};

/** Resolve a rail port to its point on the border: an explicit `offset` (a moved
    port) wins over the automatic stacked slot. Shared by the frame (triangles)
    and GenericNode (handles) so both land on the same point. */
export const resolveRailAnchor = (
  L: RailLayout,
  p: RailPort
): { x: number; y: number; nx: number; ny: number } =>
  p.offset != null
    ? L.anchorAt(p.side, p.offset)
    : L.portAnchor(p.side as 'left' | 'right', p.index, p.count);

/** Snap a normalized along-side offset to the rail's row rhythm (PITCH), centred
    on the side, so a moved port lines up with the automatic stack. The angle-snap
    analog for the rail. */
export const snapRailOffset = (L: RailLayout, side: PortSide, offset: number): number => {
  const len = L.sideLength(side);
  if (len <= 0) return 0.5;
  const c = len / 2;
  const snapped = c + Math.round((offset * len - c) / PITCH) * PITCH;
  return Math.min(1, Math.max(0, snapped / len));
};

interface RailNodeFrameProps {
  glyphKey?: string;
  /** Per-node-instance id prefix, namespacing the glyph's internal ids. */
  idPrefix: string;
  maxPorts: number;
  ports: RailPort[];
}

const RailNodeFrame = ({ glyphKey, idPrefix, maxPorts, ports }: RailNodeFrameProps) => {
  const glyph = resolveGlyph(glyphKey);
  const aspect = glyph?.aspect ?? 0.25;
  const L = railLayout(maxPorts, aspect);

  return (
    <svg className="rail-node-frame" viewBox={`0 0 ${L.vw} ${L.vh}`} aria-hidden>
      <rect
        className="rail-node-fill"
        x={L.fillRect.x}
        y={L.fillRect.y}
        width={L.fillRect.w}
        height={L.fillRect.h}
        rx={L.rx}
      />
      {glyph && (
        <svg
          x={L.label.x}
          y={L.label.y}
          width={L.label.w}
          height={L.label.h}
          viewBox={glyph.viewBox}
          preserveAspectRatio="xMidYMid meet"
          className="rail-node-label"
        >
          {glyph.render(idPrefix)}
        </svg>
      )}
      {ports.map((p) => (
        <polygon
          key={p.suffix}
          className={`rail-node-port${p.connected ? ' port-connected' : ''}`}
          points={trianglePoints(resolveRailAnchor(L, p), p.direction)}
        />
      ))}
      <rect
        className="rail-node-ring"
        x={L.borderRect.x}
        y={L.borderRect.y}
        width={L.borderRect.w}
        height={L.borderRect.h}
        rx={Math.max(0, L.rx - L.t / 2)}
        strokeWidth={L.t}
        fill="none"
      />
    </svg>
  );
};

export default memo(RailNodeFrame);
