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

export type PortDirection = 'target' | 'source';

/** A rail port: a side (left/right), plus its index within that side's stack. */
export interface RailPort {
  suffix: string;
  side: Extract<PortSide, 'left' | 'right'>;
  index: number;
  count: number;
  direction: PortDirection;
  /** True when an edge is attached: the triangle is tinted ink-gray. */
  connected?: boolean;
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
}

/** Pure rail geometry, shared by the renderer and GenericNode (handles/size). */
export const railLayout = (maxPorts: number, glyphAspect: number): RailLayout => {
  const n = Math.max(1, maxPorts);
  const ih = (n - 1) * PITCH + 2 * END_PAD;
  const lw = LABEL_H * glyphAspect; // aspect = w / h
  // Interior width hugs the (fixed-size) label so there is only a small gap
  // between the glyph and the side ports, whatever the label's aspect.
  const iw = Math.max(MIN_IW, lw + 2 * SIDE_GAP);
  const ow = iw + 2 * T;
  const oh = ih + 2 * T;
  const vw = ow + 2 * PAD_X;
  const vh = oh + 2 * PAD_Y;
  const iy = PAD_Y + T; // interior top

  return {
    vw,
    vh,
    t: T,
    rx: RX,
    fillRect: { x: PAD_X, y: PAD_Y, w: ow, h: oh },
    borderRect: { x: PAD_X + T / 2, y: PAD_Y + T / 2, w: ow - T, h: oh - T },
    label: { x: vw / 2 - lw / 2, y: vh / 2 - LABEL_H / 2, w: lw, h: LABEL_H },
    portAnchor: (side, index, count) => {
      const span = (count - 1) * PITCH;
      const y0 = iy + (ih - span) / 2;
      const y = y0 + index * PITCH;
      if (side === 'left') return { x: PAD_X + T / 2, y, nx: -1, ny: 0 };
      return { x: PAD_X + ow - T / 2, y, nx: 1, ny: 0 };
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
          points={trianglePoints(L.portAnchor(p.side, p.index, p.count), p.direction)}
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
