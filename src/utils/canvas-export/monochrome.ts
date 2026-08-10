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

/** Where a legacy `xlink:href` lives; some renderers still read only that one. */
const XLINK_NS = 'http://www.w3.org/1999/xlink';

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

  // Pictures placed in the drawing -- a pinned figure -- carry their own colours
  // inside them, where neither the token override nor the walk above can reach.
  for (const image of Array.from(svg.querySelectorAll('image'))) {
    const href = image.getAttribute('href') ?? image.getAttributeNS(XLINK_NS, 'href');
    const gray = href ? grayscaleEmbeddedSvg(href) : null;
    if (!gray) continue;
    image.setAttribute('href', gray);
    image.setAttributeNS(XLINK_NS, 'href', gray);
  }
}

/** Rec. 709 relative luminance, as an opaque gray. */
function toGray({ r, g, b }: { r: number; g: number; b: number }): string {
  const y = Math.max(0, Math.min(255, Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)));
  const h = y.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

/** Every colour literal a document can carry: `#abc`, `#aabbcc`, `rgb()`, `rgba()`. */
const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g;

/** The alpha of an `rgba(...)`, or `null` for anything opaque. */
function alphaOf(literal: string): number | null {
  const match = /^rgba\(([^)]+)\)$/i.exec(literal.trim());
  if (!match) return null;
  const parts = match[1]
    .split(/[,/\s]+/)
    .filter(Boolean)
    .map(parseFloat);
  return parts.length >= 4 && Number.isFinite(parts[3]) && parts[3] < 1 ? parts[3] : null;
}

/**
 * Every colour in a piece of source, mapped to its luminance.
 *
 * Transparency is kept: a fill under a curve is translucent on purpose, and turning it
 * into a solid slab would hide the curve it was drawn to sit behind.
 */
function grayscaleSource(source: string): string {
  return source.replace(COLOR_LITERAL, (literal) => {
    const parsed = parseColor(literal);
    if (!parsed || isGray(parsed)) return literal;
    const gray = toGray(parsed);
    const alpha = alphaOf(literal);
    if (alpha === null) return gray;
    const y = parseInt(gray.slice(1, 3), 16);
    return `rgba(${y}, ${y}, ${y}, ${alpha})`;
  });
}

/**
 * A picture embedded in the drawing, in gray.
 *
 * A pinned figure arrives as a finished SVG behind a data URI, so it is past the point
 * where a theme token could have reached it and past the point where walking elements
 * finds anything: to the export it is one opaque `<image>`. Left alone it is a colour
 * plot in the middle of black-and-white line art. Its source is read back out, mapped
 * the same way as everything else, and packed up again.
 *
 * Returns `null` for anything that is not an SVG behind a data URI -- a photograph, a
 * screenshot -- which cannot be recoloured this way and is better left as it is.
 */
function grayscaleEmbeddedSvg(href: string): string | null {
  const match = /^data:image\/svg\+xml([^,]*),([\s\S]*)$/.exec(href);
  if (!match) return null;
  const [, params, payload] = match;
  try {
    const base64 = /;base64/i.test(params);
    const source = base64
      ? new TextDecoder().decode(Uint8Array.from(atob(payload), (c) => c.charCodeAt(0)))
      : decodeURIComponent(payload);
    const gray = grayscaleSource(source);
    if (gray === source) return null;
    if (!base64) return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(gray)}`;
    const bytes = new TextEncoder().encode(gray);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  } catch {
    // An image that cannot be decoded is one that cannot be recoloured; a colour
    // picture in the export beats no picture at all.
    return null;
  }
}
