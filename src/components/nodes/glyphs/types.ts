import type { ReactNode } from 'react';

/**
 * A math/symbol glyph drawn inside a circular element frame. Authored to fill
 * its own `viewBox` tightly, monochrome via `currentColor`, so the frame can
 * scale and recolor it freely.
 */
export interface GlyphAsset {
  /** The glyph's own coordinate space; the ink fills it tightly (no padding). */
  viewBox: string;
  /** Ink-box aspect ratio (width / height). */
  aspect: number;
  /**
   * Fraction (0..1) down the ink box where the glyph's OPTICAL centre sits — the
   * point the frame aligns to its centre. Lets a tall accent (e.g. the overdot
   * of ṁ) float above centre instead of dragging the body low. Use 0.5 for a
   * glyph whose ink box is already optically centred.
   */
  opticalCenterY: number;
  /**
   * Fraction (0..1) down the viewBox where the flow-passage centerline runs.
   * Left/right ports of a box frame anchor to this height so they meet the
   * passage instead of the frame's mid-height. Use 0.5 for a glyph whose
   * passage is vertically centred (the default).
   */
  portCenterY: number;
  /**
   * Renders the glyph in its own viewBox coords, filled `currentColor`. Glyphs
   * that carry internal ids (e.g. `<marker>` defs) receive a per-node-instance
   * `idPrefix` to namespace them so they don't collide across nodes; simple
   * path glyphs ignore it.
   */
  render: (idPrefix?: string) => ReactNode;
}
