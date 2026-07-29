/** Where the divider between the canvas and the notebook is allowed to sit. */

import { describe, expect, it } from 'vitest';
import { clampRatio } from './use-split-resize';

describe('the share the canvas takes of the split', () => {
  it('leaves a ratio that suits both panes alone', () => {
    expect(clampRatio(0.6, 1200, 280)).toBeCloseTo(0.6);
  });

  it('stops before either pane is narrower than its minimum', () => {
    // 280 of the 1200 the panes divide, either side, so the divider travels between
    // these two shares and a pane clamped there is exactly 280 wide.
    expect(clampRatio(0.02, 1200, 280)).toBeCloseTo(280 / 1200);
    expect(clampRatio(0.02, 1200, 280) * 1200).toBeCloseTo(280);
    expect(clampRatio(0.99, 1200, 280)).toBeCloseTo(1 - 280 / 1200);
  });

  it('splits a width too narrow for both minimums evenly', () => {
    // Nothing else is fair: any other answer would take the shortfall from one side.
    expect(clampRatio(0.9, 500, 280)).toBe(0.5);
  });

  it('splits evenly rather than passing on a width it cannot use', () => {
    // The container is measured before the first frame is laid out, and a ratio read
    // from a stored value may be anything at all.
    expect(clampRatio(0.6, 0, 280)).toBe(0.5);
    expect(clampRatio(Number.NaN, 1200, 280)).toBe(0.5);
  });
});
