/**
 * Black-and-white export mode.
 *
 * The goal is a *true* black-and-white drawing, not a desaturated screenshot of
 * the theme. The live theme is already close to grayscale (ink is
 * `--color-text-secondary` #6c757d, edges are `--color-edge` #4a4a4aa9 — a gray
 * with 66% alpha), so simply dropping saturation would export exactly the muddy
 * mid-grays we are trying to get rid of.
 *
 * Instead of recolouring the finished SVG, this remaps the *theme tokens* for
 * the duration of the build. Every paint in the export already resolves through
 * `getComputedStyle` — per-element inlining, the rebuilt `<rect>`/`<text>`
 * pieces, the legend, and the root-level `var(--…)` baking — so overriding the
 * tokens at the root makes all of them emit #000/#fff with no other changes.
 * That keeps the mapping *semantic*: a token becomes black because it is ink,
 * not because it happened to be dark. Luminance alone cannot make that call —
 * `--color-border` (#dee2e6) and `--box-node-fill` (#e6e6e6) are within 3% of
 * each other yet must land on opposite ends.
 *
 * The override is applied as an inline style on `<html>`, which outranks both
 * `:root` and `[data-theme='dark']`, and is removed again in a `finally`.
 * `buildCanvasSvg` is synchronous, so the browser never paints an intermediate
 * frame and the on-screen canvas does not flicker.
 */

const INK = '#000000';
const PAPER = '#ffffff';

/**
 * Tokens that carry ink — borders, strokes, glyph and text colour, ports, and
 * the status/validation colours that tint edges.
 */
const INK_TOKENS = [
  '--color-text-primary',
  '--color-text-secondary',
  '--color-text-muted',
  '--color-text-body',
  '--color-text-control',
  '--color-text-icon-secondary',
  '--color-text-nav',
  '--color-text-disabled',
  '--color-border',
  '--color-border-light',
  '--color-border-subtle',
  '--color-border-status',
  '--color-edge',
  '--color-accent',
  '--color-accent-hover',
  '--color-accent-active',
  '--circular-node-ink',
  '--circular-node-port',
  '--box-node-ink',
  '--box-node-port',
  '--port-connected',
  '--color-success',
  '--color-error',
  '--color-error-strong',
  '--color-invalid',
];

/**
 * Tokens that carry paper — node fills, flow-passage interiors, card surfaces,
 * and the text colour used *on top of* an accent fill (which is now black).
 */
const PAPER_TOKENS = [
  '--color-surface',
  '--color-surface-subtle',
  '--color-surface-muted',
  '--color-surface-hover',
  '--color-surface-sidebar',
  '--color-surface-input',
  '--color-surface-statusbar',
  '--color-surface-control-hover',
  '--circular-node-fill',
  '--box-node-fill',
  '--color-text-on-accent',
  '--color-accent-subtle-bg',
  '--color-accent-subtle-bg-alt',
  '--color-invalid-bg',
];

/**
 * Applies the monochrome token overrides and returns a function that restores
 * whatever inline values were there before.
 */
export function applyMonochromeTokens(): () => void {
  const root = document.documentElement;

  // Node rings carry `transition: stroke 0.2s` (custom-node.css), and several
  // other pieces transition colour too. Retargeting a token starts those
  // transitions, and `getComputedStyle` then reports an interpolated value —
  // or still the old one — so the harvest would sample mid-flight grays rather
  // than the black we just asked for. Suppress transitions for the build.
  const freeze = document.createElement('style');
  freeze.textContent = '*, *::before, *::after { transition: none !important; }';
  document.head.appendChild(freeze);

  const previous = new Map<string, string>();
  const set = (name: string, value: string) => {
    previous.set(name, root.style.getPropertyValue(name));
    root.style.setProperty(name, value);
  };
  INK_TOKENS.forEach((name) => set(name, INK));
  PAPER_TOKENS.forEach((name) => set(name, PAPER));

  // Force a style recalc so the new values are what the harvest reads.
  void document.body.offsetHeight;

  return () => {
    previous.forEach((value, name) => {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    });
    freeze.remove();
  };
}

/** Paint properties that can hold a colour, as inline style and as attribute. */
const COLOR_PROPS = ['fill', 'stroke', 'stop-color', 'color', 'flood-color'] as const;

/** Parses a CSS colour to 8-bit RGB, or null when it isn't a concrete colour. */
function parseColor(value: string): { r: number; g: number; b: number } | null {
  const v = value.trim().toLowerCase();
  if (!v || v === 'none' || v === 'transparent' || v === 'currentcolor') return null;
  if (v.startsWith('url(')) return null;

  const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgb) {
    const parts = rgb[1]
      .split(/[,/\s]+/)
      .filter(Boolean)
      .map(parseFloat);
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return { r: parts[0], g: parts[1], b: parts[2] };
  }

  const hex = /^#([0-9a-f]{3,8})$/.exec(v);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    };
  }
  return null;
}

/** True when the channels are equal, i.e. the colour is already achromatic. */
const isGray = (c: { r: number; g: number; b: number }) => c.r === c.g && c.g === c.b;

/**
 * Second pass, for the colours the token override cannot reach: data-driven
 * paints (contour fills and the legend's colormap ramp) are computed from a
 * colormap, not from a theme token. Snapping those to pure black/white would
 * turn a continuous field into a meaningless two-tone pattern, so they are
 * mapped to their luminance instead — an honest grayscale of the same data.
 * Everything token-driven is already exactly #000/#fff, hence achromatic, and
 * is left untouched.
 */
export function grayscaleResidualColors(svg: SVGSVGElement): void {
  const elements: Element[] = [svg, ...Array.from(svg.querySelectorAll('*'))];
  for (const node of elements) {
    const style = (node as SVGElement).style as CSSStyleDeclaration | undefined;
    for (const prop of COLOR_PROPS) {
      if (style) {
        const inline = style.getPropertyValue(prop);
        const parsed = inline ? parseColor(inline) : null;
        if (parsed && !isGray(parsed)) style.setProperty(prop, toGray(parsed));
      }
      const attr = node.getAttribute(prop);
      const parsedAttr = attr ? parseColor(attr) : null;
      if (parsedAttr && !isGray(parsedAttr)) node.setAttribute(prop, toGray(parsedAttr));
    }
  }
}

/** Rec. 709 relative luminance, as an opaque gray. */
function toGray({ r, g, b }: { r: number; g: number; b: number }): string {
  const y = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
  const h = y.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}
