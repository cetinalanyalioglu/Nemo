import type { GlyphAsset } from './types';

/**
 * Builds a {@link GlyphAsset} from a normalized SVG resource string (imported via
 * `?raw` from `src/assets/glyphs`). The resources are authored monochrome —
 * strokes/ink as `currentColor`, any filled passage as `var(--color-surface)` —
 * and any internal ids (e.g. arrowhead `<marker>` defs) carry an `__IDP__`
 * placeholder that is swapped for a per-node-instance prefix at render time so
 * they never collide across nodes. The inner markup is injected verbatim
 * (`dangerouslySetInnerHTML`) since it may contain `<defs>`/`<marker>` and raw
 * presentation attributes.
 */
export const svgGlyph = (raw: string, opticalCenterY = 0.5): GlyphAsset => {
  const viewBox = raw.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 100 100';
  const [, , w, h] = viewBox.split(/\s+/).map(Number);
  const inner = raw.slice(raw.indexOf('>', raw.indexOf('<svg')) + 1, raw.lastIndexOf('</svg>'));

  return {
    viewBox,
    aspect: w / h,
    opticalCenterY,
    render: (idPrefix = 'g') => (
      <g dangerouslySetInnerHTML={{ __html: inner.replace(/__IDP__/g, idPrefix) }} />
    ),
  };
};
