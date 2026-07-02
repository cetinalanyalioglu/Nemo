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
  /** Renders the glyph paths in its own viewBox coords, filled `currentColor`. */
  render: () => ReactNode;
}
