import { describe, expect, it } from 'vitest';
import { railLayout, resolveRailAnchor, snapRailOffset } from './RailNodeFrame';
import type { RailPort } from './RailNodeFrame';

// A representative rail: 4 target ports, a moderately wide label aspect so the
// top/bottom edges are long enough to admit a moved port.
const L = railLayout(4, 0.6);

describe('railLayout.anchorAt', () => {
  it('places a port on the correct border with a cardinal outward normal', () => {
    const left = L.anchorAt('left', 0.5);
    expect(left.nx).toBe(-1);
    expect(left.ny).toBe(0);
    expect(left.x).toBeCloseTo(L.borderRect.x, 5);

    const right = L.anchorAt('right', 0.5);
    expect(right.nx).toBe(1);
    expect(right.x).toBeCloseTo(L.borderRect.x + L.borderRect.w, 5);

    const top = L.anchorAt('top', 0.5);
    expect(top.ny).toBe(-1);
    expect(top.y).toBeCloseTo(L.borderRect.y, 5);

    const bottom = L.anchorAt('bottom', 0.5);
    expect(bottom.ny).toBe(1);
    expect(bottom.y).toBeCloseTo(L.borderRect.y + L.borderRect.h, 5);
  });

  it('offset 0.5 lands at the side midpoint; the endpoints stay off the corners', () => {
    const mid = L.anchorAt('left', 0.5);
    expect(mid.y).toBeCloseTo(L.borderRect.y + L.borderRect.h / 2, 5);
    // Inset from the corners: the extremes never reach the border rect corners.
    const start = L.anchorAt('left', 0);
    const end = L.anchorAt('left', 1);
    expect(start.y).toBeGreaterThan(L.borderRect.y);
    expect(end.y).toBeLessThan(L.borderRect.y + L.borderRect.h);
  });

  it('clamps out-of-range offsets to the usable segment', () => {
    expect(L.anchorAt('left', -1)).toEqual(L.anchorAt('left', 0));
    expect(L.anchorAt('left', 2)).toEqual(L.anchorAt('left', 1));
  });
});

describe('railLayout.project', () => {
  it('projects a point beyond the left border onto the left side', () => {
    const target = L.anchorAt('left', 0.5);
    const hit = L.project(target.x - 20, target.y);
    expect(hit.side).toBe('left');
    expect(hit.offset).toBeCloseTo(0.5, 2);
  });

  it('projects a point above the top border onto the top side', () => {
    const target = L.anchorAt('top', 0.5);
    const hit = L.project(target.x, target.y - 20);
    expect(hit.side).toBe('top');
    expect(hit.offset).toBeCloseTo(0.5, 2);
  });

  it('round-trips anchorAt → project for every side', () => {
    (['left', 'right', 'top', 'bottom'] as const).forEach((side) => {
      const p = L.anchorAt(side, 0.3);
      // Nudge outward along the normal so the nearest side is unambiguous.
      const hit = L.project(p.x + p.nx * 5, p.y + p.ny * 5);
      expect(hit.side).toBe(side);
      expect(hit.offset).toBeCloseTo(0.3, 2);
    });
  });
});

describe('snapRailOffset', () => {
  it('snaps the along-side position to the centre and the pitch lattice', () => {
    // The centre of any side is always a detent.
    expect(snapRailOffset(L, 'left', 0.5)).toBeCloseTo(0.5, 5);
    // A slightly-off offset snaps back onto a lattice point around the centre.
    const near = snapRailOffset(L, 'left', 0.52);
    expect(Math.abs(near - 0.5)).toBeLessThan(0.5);
    // Snapping is idempotent: snapping a snapped value doesn't move it.
    expect(snapRailOffset(L, 'left', near)).toBeCloseTo(near, 5);
  });

  it('stays within [0,1]', () => {
    (['left', 'right', 'top', 'bottom'] as const).forEach((side) => {
      for (const o of [0, 0.1, 0.37, 0.9, 1]) {
        const s = snapRailOffset(L, side, o);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('resolveRailAnchor', () => {
  it('uses the stacked slot when no offset is set', () => {
    const port: RailPort = {
      suffix: '0',
      side: 'left',
      index: 0,
      count: 2,
      direction: 'target',
    };
    expect(resolveRailAnchor(L, port)).toEqual(L.portAnchor('left', 0, 2));
  });

  it('uses the explicit offset when the port has been moved', () => {
    const port: RailPort = {
      suffix: '0',
      side: 'top',
      index: 0,
      count: 2,
      direction: 'target',
      offset: 0.25,
    };
    expect(resolveRailAnchor(L, port)).toEqual(L.anchorAt('top', 0.25));
  });
});
