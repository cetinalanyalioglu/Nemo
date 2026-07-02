import { memo } from 'react';
import { resolveGlyph } from './glyphs';

/**
 * Circular element frame, drawn as a single SVG so port triangles can be clipped
 * seamlessly by the border. Everything lives in a 100×100 viewBox that scales to
 * the (square) node box; the circle is inset from the box edge to leave room for
 * port tips that poke outward.
 *
 * Draw order is the whole trick: interior disc → glyph → port triangles → border
 * ring LAST. Each triangle's base sits on the ring's centreline, so drawing the
 * ring on top hides the base for BOTH orientations — an outward (source) triangle
 * appears to emerge from the outer edge, an inward (target) one from the inner
 * edge — with no visible seam, at any angle.
 */

/** viewBox is 100×100; all constants below are in those units. */
export const FRAME_BOX = 100;
const C = FRAME_BOX / 2;

/** Outer radius of the border. Inset from the box edge so the (taller) port
    tips still fit inside the 100×100 box. */
const R = 41;
/** Ratios (relative to the outer radius R), tuned against the reference artwork. */
const T = 0.085 * R; // border thickness
const BASE = 0.6 * R; // port-triangle base
const H = 0.285 * R; // port-triangle height
const GLYPH_W = 1.08 * R; // glyph ink width
/** Ring centreline: port bases sit here so the stroke covers them symmetrically. */
const RC = R - T / 2;

export type PortDirection = 'target' | 'source';

export interface FramePort {
  /** Positional port number (handle-id suffix). */
  suffix: string;
  /** Outward angle in math convention (0° = right, 90° = up). */
  angleDeg: number;
  /** Connection direction: `source` points outward, `target` points inward. */
  direction: PortDirection;
}

/** Outward unit vector for an angle (math convention; screen y grows down). */
const outward = (angleDeg: number) => {
  const a = (angleDeg * Math.PI) / 180;
  return { ux: Math.cos(a), uy: -Math.sin(a) };
};

/**
 * The point (in viewBox units, == percent of the box) where a port's handle sits:
 * on the border, along the port's angle. Shared with GenericNode so the invisible
 * React Flow handle lands exactly on the drawn triangle.
 */
export const portHandlePoint = (angleDeg: number) => {
  const { ux, uy } = outward(angleDeg);
  return { xPct: C + R * ux, yPct: C + R * uy };
};

/** Inner edge of the border stroke — the interior rim. */
const R_INNER = R - T;

/** Three-vertex `points` string for one port triangle. */
const trianglePoints = (angleDeg: number, direction: PortDirection): string => {
  const { ux, uy } = outward(angleDeg);
  const px = -uy;
  const py = ux; // tangent
  // Base radius by direction. A source (outward) keeps its base on the ring
  // centreline, so the ring hides it and the tip emerges from the OUTER edge. A
  // target (inward) drops its base onto the interior rim, so the whole triangle
  // sits inside the disc pointing in, its base cut by the INNER edge of the
  // border — the base corners fall just inside the stroke and stay hidden.
  const baseR = direction === 'source' ? RC : R_INNER;
  const bx = C + baseR * ux;
  const by = C + baseR * uy;
  const tipR = direction === 'source' ? baseR + H : baseR - H;
  const tx = C + tipR * ux;
  const ty = C + tipR * uy;
  const b1x = bx + (BASE / 2) * px;
  const b1y = by + (BASE / 2) * py;
  const b2x = bx - (BASE / 2) * px;
  const b2y = by - (BASE / 2) * py;
  const f = (n: number) => n.toFixed(3);
  return `${f(b1x)},${f(b1y)} ${f(tx)},${f(ty)} ${f(b2x)},${f(b2y)}`;
};

interface CircularNodeFrameProps {
  /** Glyph registry key drawn at the optical centre (e.g. `mdot`). */
  glyphKey?: string;
  ports: FramePort[];
}

const CircularNodeFrame = ({ glyphKey, ports }: CircularNodeFrameProps) => {
  const glyph = resolveGlyph(glyphKey);

  let glyphEl = null;
  if (glyph) {
    const gw = GLYPH_W;
    const gh = gw / glyph.aspect;
    const gx = C - gw / 2;
    // Align the glyph's optical centre (not its ink-box centre) to the frame centre.
    const gy = C - glyph.opticalCenterY * gh;
    glyphEl = (
      <svg
        x={gx}
        y={gy}
        width={gw}
        height={gh}
        viewBox={glyph.viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="circular-node-glyph"
      >
        {glyph.render()}
      </svg>
    );
  }

  return (
    <svg className="circular-node-frame" viewBox={`0 0 ${FRAME_BOX} ${FRAME_BOX}`} aria-hidden>
      <circle className="circular-node-disc" cx={C} cy={C} r={R} />
      {glyphEl}
      {ports.map((p) => (
        <polygon
          key={p.suffix}
          className="circular-node-port"
          points={trianglePoints(p.angleDeg, p.direction)}
        />
      ))}
      <circle className="circular-node-ring" cx={C} cy={C} r={RC} strokeWidth={T} fill="none" />
    </svg>
  );
};

export default memo(CircularNodeFrame);
