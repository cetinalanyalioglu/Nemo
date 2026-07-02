import { memo } from 'react';
import { resolveGlyph } from './glyphs';
import type { PortSide } from '../../types/flow';

/**
 * Rectangular ("box") element frame, drawn as a single SVG — the rect sibling of
 * CircularNodeFrame. A gray interior fill sits behind a schematic glyph (whose
 * flow passage is `var(--color-surface)`, so gray shows only in the empty
 * zones), with orange port triangles on the edges and the border stroke drawn
 * LAST so it clips the port bases and any glyph that runs under it.
 *
 * The glyph is placed by two per-element whitespace insets, aspect-preserving:
 * `insetX`/`insetY` are the gray margins (as a fraction of the glyph's own
 * width/height) on each side. `insetX` may be 0 or negative — negative runs the
 * passage under the side borders so it meets the ports. The frame's aspect is
 * therefore derived from the glyph aspect + insets; the node locks to it.
 */

/** All constants below are in viewBox units; the glyph is a nominal 100 wide. */
const GW = 100;
const T = 4; // border thickness
const H = 9; // port-triangle height (radial extent past the border)
const BASE = 20; // port-triangle base
const PM = H + 1; // margin around the frame so outward port tips fit the viewBox

export type PortDirection = 'target' | 'source';

/** A box port resolved to an edge and a fractional position along that edge. */
export interface BoxPort {
  suffix: string;
  side: PortSide;
  /** 0..1 position along the edge (top/bottom: left→right; left/right: top→bottom). */
  offset: number;
  direction: PortDirection;
}

export interface BoxLayout {
  vw: number;
  vh: number;
  /** Node box aspect (vw/vh); the node is locked to this. */
  aspect: number;
  t: number;
  glyph: { x: number; y: number; w: number; h: number };
  grayRect: { x: number; y: number; w: number; h: number };
  borderRect: { x: number; y: number; w: number; h: number };
  /** Point on the border centreline for a port, plus its outward unit normal. */
  portAnchor: (side: PortSide, offset: number) => { x: number; y: number; nx: number; ny: number };
}

/** Pure frame geometry, shared by the renderer and GenericNode (handles/aspect). */
export const boxLayout = (glyphAspect: number, insetX: number, insetY: number): BoxLayout => {
  const gh = GW / glyphAspect;
  const iw = GW * (1 + 2 * insetX);
  const ih = gh * (1 + 2 * insetY);
  const ow = iw + 2 * T;
  const oh = ih + 2 * T;
  const vw = ow + 2 * PM;
  const vh = oh + 2 * PM;
  const ix = PM + T; // interior top-left
  const iy = PM + T;

  return {
    vw,
    vh,
    aspect: vw / vh,
    t: T,
    glyph: { x: ix + insetX * GW, y: iy + insetY * gh, w: GW, h: gh },
    grayRect: { x: PM, y: PM, w: ow, h: oh },
    borderRect: { x: PM + T / 2, y: PM + T / 2, w: ow - T, h: oh - T },
    portAnchor: (side, offset) => {
      switch (side) {
        case 'left':
          return { x: PM + T / 2, y: iy + offset * ih, nx: -1, ny: 0 };
        case 'right':
          return { x: PM + ow - T / 2, y: iy + offset * ih, nx: 1, ny: 0 };
        case 'top':
          return { x: ix + offset * iw, y: PM + T / 2, nx: 0, ny: -1 };
        case 'bottom':
        default:
          return { x: ix + offset * iw, y: PM + oh - T / 2, nx: 0, ny: 1 };
      }
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
  const ty = nx; // tangent
  const d = direction === 'source' ? H : -H;
  const px = x + d * nx;
  const py = y + d * ny; // tip
  const f = (n: number) => n.toFixed(3);
  return `${f(x + (BASE / 2) * tx)},${f(y + (BASE / 2) * ty)} ${f(px)},${f(py)} ${f(
    x - (BASE / 2) * tx
  )},${f(y - (BASE / 2) * ty)}`;
};

interface RectNodeFrameProps {
  glyphKey?: string;
  /** Per-node-instance id prefix, namespacing the glyph's internal marker ids. */
  idPrefix: string;
  insetX: number;
  insetY: number;
  ports: BoxPort[];
}

const RectNodeFrame = ({ glyphKey, idPrefix, insetX, insetY, ports }: RectNodeFrameProps) => {
  const glyph = resolveGlyph(glyphKey);
  const aspect = glyph?.aspect ?? 1.6;
  const L = boxLayout(aspect, insetX, insetY);

  return (
    <svg className="box-node-frame" viewBox={`0 0 ${L.vw} ${L.vh}`} aria-hidden>
      <rect
        className="box-node-fill"
        x={L.grayRect.x}
        y={L.grayRect.y}
        width={L.grayRect.w}
        height={L.grayRect.h}
      />
      {glyph && (
        <svg
          x={L.glyph.x}
          y={L.glyph.y}
          width={L.glyph.w}
          height={L.glyph.h}
          viewBox={glyph.viewBox}
          preserveAspectRatio="none"
          className="box-node-glyph"
        >
          {glyph.render(idPrefix)}
        </svg>
      )}
      {ports.map((p) => (
        <polygon
          key={p.suffix}
          className="box-node-port"
          points={trianglePoints(L.portAnchor(p.side, p.offset), p.direction)}
        />
      ))}
      <rect
        className="box-node-ring"
        x={L.borderRect.x}
        y={L.borderRect.y}
        width={L.borderRect.w}
        height={L.borderRect.h}
        strokeWidth={L.t}
        fill="none"
      />
    </svg>
  );
};

export default memo(RectNodeFrame);
