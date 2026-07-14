/**
 * Native-vector serializer for the canvas.
 *
 * Reconstructs the current flow network as a single, self-contained `<svg>`
 * whose geometry lives in **flow coordinates** — the same layout space node
 * `positionAbsolute`/`width`/`height` and edge path `d` strings already use — so
 * the current pan/zoom is irrelevant. The output is real vector graphics
 * (editable paths and text), not a `foreignObject`-wrapped HTML snapshot.
 *
 * Strategy: harvest the live React Flow DOM rather than re-deriving each frame's
 * layout math. Elements that are already SVG (circle/box/rail frames, inlined
 * glyphs, port triangles, edge paths, midpoint markers) are deep-cloned and have
 * their CSS-variable-driven colors resolved into concrete inline attributes via
 * `getComputedStyle`. HTML-only pieces (text labels, the `rect` node body, the
 * data legend) are reconstructed as native `<rect>`/`<text>`/`<linearGradient>`.
 *
 * Positions of HTML pieces are read with `offsetLeft`/`offsetTop`, which are
 * layout-space and therefore ignore the viewport's zoom transform AND the
 * node's own `rotate()` transform. That keeps everything in one unrotated local
 * frame per node, which is then rotated exactly once via a wrapping `<g>`.
 */
import type { ReactFlowInstance } from 'reactflow';
import { ANNOTATION_NODE_TYPE, ANNOTATION_STYLE_DEFAULTS } from '../../types/annotations';
import type { AnnotationData } from '../../types/annotations';
import { sampleColormap } from '../colormap';
import { useDataStore, selectActiveItem, selectActiveDataset } from '../../store/dataStore';
import type { DataDisplayConfig, DataTarget } from '../../types/data';
import { logger } from '../logger';

const SVG_NS = 'http://www.w3.org/2000/svg';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** Padding (flow units) added around the content bounding box. */
const PADDING = 24;
/** Gap (flow units) between the graph and the legend card placed to its right. */
const LEGEND_GAP = 32;

export interface BuiltCanvasSvg {
  /** Detached `<svg>` element, ready to serialize or hand to svg2pdf. */
  svg: SVGSVGElement;
  width: number;
  height: number;
}

/**
 * Color/paint properties that come from CSS classes (and thus are NOT present as
 * attributes on the cloned node). `getComputedStyle` resolves `var(--…)` and
 * `currentColor` to concrete values, making the clone self-contained.
 */
const PAINT_PROPS = [
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-opacity',
  'stop-color',
  'stop-opacity',
  'opacity',
  'paint-order',
] as const;

/**
 * Stroke geometry that may come from CSS (e.g. edge `stroke-width` from
 * `--edge-width`). Only copied when the element lacks the matching attribute, so
 * hand-authored frame attributes win. `px` is stripped: in these SVGs one CSS
 * pixel equals one user unit.
 */
const STROKE_PROPS = [
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
] as const;

/** Copies resolved presentation styles from a live SVG element onto its clone. */
function inlinePaint(live: Element, clone: Element): void {
  const cs = getComputedStyle(live);
  const style = (clone as SVGElement).style;
  // Paint goes into the inline style, not an attribute: many glyphs author ink
  // as `style="fill:currentColor"`, and an inline style beats a presentation
  // attribute — so an attribute would leave `currentColor` (→ black) in place.
  for (const prop of PAINT_PROPS) {
    const value = cs.getPropertyValue(prop);
    if (value && value !== 'normal') style.setProperty(prop, value.trim());
  }
  for (const prop of STROKE_PROPS) {
    if (clone.hasAttribute(prop) || style.getPropertyValue(prop)) continue;
    const value = cs.getPropertyValue(prop).trim();
    if (value && value !== 'none' && value !== 'normal') {
      clone.setAttribute(prop, value.replace(/px/g, ''));
    }
  }
}

/** Recursively inline paint styles across a cloned SVG subtree, in lockstep with the live tree. */
function inlineTree(live: Element, clone: Element): void {
  inlinePaint(live, clone);
  const liveKids = live.children;
  const cloneKids = clone.children;
  for (let i = 0; i < cloneKids.length && i < liveKids.length; i += 1) {
    inlineTree(liveKids[i], cloneKids[i]);
  }
}

const el = (name: string): SVGElement => document.createElementNS(SVG_NS, name);

/**
 * The pure-translation part of an element's CSS transform, in layout px, or
 * {0,0} when the transform isn't a plain translate. Percentage translates —
 * e.g. the `translate(-50%, …)` that centers node captions horizontally on the
 * element — resolve to px in the computed matrix, so this recovers the centering
 * shift that `offsetLeft` alone misses. Rotations/scales are skipped: the export
 * re-applies node rotation itself, so only translations belong in the unrotated
 * local frame.
 */
function translateOf(node: HTMLElement): { x: number; y: number } {
  const transform = getComputedStyle(node).transform;
  if (!transform || transform === 'none') return { x: 0, y: 0 };
  const match = /^matrix\(([^)]+)\)$/.exec(transform);
  if (!match) return { x: 0, y: 0 };
  const p = match[1].split(',').map((v) => parseFloat(v));
  // matrix(a, b, c, d, e, f); a pure translation has a=1, b=0, c=0, d=1.
  if (p.length !== 6 || p[0] !== 1 || p[1] !== 0 || p[2] !== 0 || p[3] !== 1) {
    return { x: 0, y: 0 };
  }
  return { x: p[4] || 0, y: p[5] || 0 };
}

/**
 * Position (layout px) of `child` relative to `ancestor`, summing the
 * offsetParent chain. Layout offsets ignore CSS transforms, so each element's
 * own centering translate is folded back in via {@link translateOf}; the result
 * is the child's place in the node's unrotated, unzoomed local frame — flow units.
 */
function offsetWithin(child: HTMLElement, ancestor: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let node: HTMLElement | null = child;
  while (node && node !== ancestor && ancestor.contains(node)) {
    const t = translateOf(node);
    x += node.offsetLeft + t.x;
    y += node.offsetTop + t.y;
    node = node.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

type Anchor = 'start' | 'middle' | 'end';

/**
 * Reconstructs a text-bearing HTML element as a native, centered `<text>` placed
 * in the node's local frame (offset from the node origin `originX,originY`).
 * Multi-line content is stacked. Returns null when empty or not rendered.
 */
function textFrom(
  live: HTMLElement,
  origin: HTMLElement,
  originX: number,
  originY: number,
  align: Anchor = 'middle'
): SVGElement | null {
  if (live.offsetParent === null && live.getClientRects().length === 0) return null;
  const raw = (live.innerText ?? live.textContent ?? '').replace(/ /g, ' ').trimEnd();
  if (!raw) return null;
  const lines = raw.split('\n');
  const cs = getComputedStyle(live);
  const fontSize = parseFloat(cs.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return null;
  const lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.2;

  const box = offsetWithin(live, origin);
  const w = live.offsetWidth;
  const h = live.offsetHeight;
  const anchorX = originX + box.x + (align === 'start' ? 0 : align === 'end' ? w : w / 2);
  const centerY = originY + box.y + h / 2;

  const text = el('text');
  text.setAttribute('text-anchor', align);
  text.setAttribute('font-family', cs.fontFamily.replace(/"/g, "'"));
  text.setAttribute('font-size', String(fontSize));
  text.setAttribute('font-weight', cs.fontWeight);
  if (cs.fontStyle && cs.fontStyle !== 'normal') text.setAttribute('font-style', cs.fontStyle);
  text.setAttribute('fill', cs.color);
  const firstBaseline = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    const tspan = el('tspan');
    tspan.setAttribute('x', String(anchorX));
    tspan.setAttribute('y', String(firstBaseline + i * lineHeight));
    tspan.setAttribute('dominant-baseline', 'central');
    tspan.textContent = line;
    text.appendChild(tspan);
  });
  return text;
}

/** Wraps children in a rotation group about (cx,cy) when the node is rotated. */
function maybeRotate(children: SVGElement[], rotation: number, cx: number, cy: number): SVGElement {
  const g = el('g');
  if (rotation) g.setAttribute('transform', `rotate(${rotation} ${cx} ${cy})`);
  children.forEach((c) => g.appendChild(c));
  return g;
}

/** Reconstructs a bordered/filled HTML box as a native `<rect>`, or null if invisible. */
function boxFrom(box: HTMLElement, x: number, y: number, w: number, h: number): SVGElement | null {
  const cs = getComputedStyle(box);
  const hasBg = !!cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
  const borderW = parseFloat(cs.borderTopWidth);
  const hasBorder = Number.isFinite(borderW) && borderW > 0 && cs.borderTopStyle !== 'none';
  if (!hasBg && !hasBorder) return null;

  const rect = el('rect');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', String(y));
  rect.setAttribute('width', String(w));
  rect.setAttribute('height', String(h));
  const radius = parseFloat(cs.borderTopLeftRadius);
  if (Number.isFinite(radius) && radius > 0) rect.setAttribute('rx', String(radius));
  rect.setAttribute('fill', hasBg ? cs.backgroundColor : 'none');
  if (hasBorder) {
    rect.setAttribute('stroke', cs.borderTopColor);
    rect.setAttribute('stroke-width', String(borderW));
  }
  return rect;
}

/** Selectors for the visible on-node text pieces reconstructed natively. */
const NODE_TEXT_SELECTORS = ['.custom-node-label', '.custom-node-type', '.custom-node-data-value'];

/**
 * The element-index badge (shown by "Show indices") is absolutely positioned
 * and centered above the node via a CSS transform, which `textFrom`'s offset
 * math cannot read. Emit it directly, centered on the node and just above its
 * top edge, so it survives the export.
 */
function indexLabelFrom(nodeEl: HTMLElement, posX: number, posY: number, w: number): SVGElement | null {
  const live = nodeEl.querySelector<HTMLElement>('.element-index-label');
  if (!live) return null;
  const raw = (live.textContent ?? '').trim();
  if (!raw) return null;
  const cs = getComputedStyle(live);
  const fontSize = parseFloat(cs.fontSize) || 9;
  const text = el('text');
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-family', cs.fontFamily.replace(/"/g, "'"));
  text.setAttribute('font-size', String(fontSize));
  text.setAttribute('font-weight', cs.fontWeight);
  text.setAttribute('fill', cs.color);
  text.setAttribute('x', String(posX + w / 2));
  text.setAttribute('y', String(posY - 3));
  text.textContent = raw;
  return text;
}

function harvestModelNode(
  nodeEl: HTMLElement,
  posX: number,
  posY: number,
  w: number,
  h: number,
  rotation: number
): SVGElement | null {
  const parts: SVGElement[] = [];
  const frame = nodeEl.querySelector<SVGSVGElement>(
    '.circular-node-frame, .box-node-frame, .rail-node-frame'
  );

  if (frame) {
    // The SVG frame fills the node's core box; clone it verbatim and place it.
    const clone = frame.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('x', String(posX));
    clone.setAttribute('y', String(posY));
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('overflow', 'visible');
    inlineTree(frame, clone);
    parts.push(clone);
  } else {
    // `rect` shape: reconstruct the bordered HTML box as a rounded rect.
    const box = nodeEl.querySelector<HTMLElement>('.custom-node') ?? nodeEl;
    const rect = boxFrom(box, posX, posY, w, h);
    if (rect) parts.push(rect);
  }

  for (const sel of NODE_TEXT_SELECTORS) {
    nodeEl.querySelectorAll<HTMLElement>(sel).forEach((textEl) => {
      const t = textFrom(textEl, nodeEl, posX, posY);
      if (t) parts.push(t);
    });
  }

  const indexLabel = indexLabelFrom(nodeEl, posX, posY, w);
  if (indexLabel) parts.push(indexLabel);

  if (parts.length === 0) return null;
  return maybeRotate(parts, rotation, posX + w / 2, posY + h / 2);
}

function harvestAnnotation(
  nodeEl: HTMLElement,
  annotation: AnnotationData,
  posX: number,
  posY: number,
  w: number,
  h: number,
  rotation: number
): SVGElement | null {
  const parts: SVGElement[] = [];
  const cardEl = nodeEl.querySelector<HTMLElement>('.annotation-node') ?? nodeEl;

  const card = boxFrom(cardEl, posX, posY, w, h);
  if (card) parts.push(card);

  if (annotation.kind === 'image' && annotation.src) {
    const img = el('image');
    img.setAttribute('x', String(posX));
    img.setAttribute('y', String(posY));
    img.setAttribute('width', String(w));
    img.setAttribute('height', String(h));
    // Data URI — self-contained, works in SVG/PNG/PDF.
    img.setAttributeNS(XLINK_NS, 'href', annotation.src);
    img.setAttribute('href', annotation.src);
    parts.push(img);
  } else {
    // Text note: reconstruct the rendered text natively. Markdown emphasis is not
    // re-parsed — the raw note text is drawn with the annotation's font/color.
    const content =
      cardEl.querySelector<HTMLElement>('.annotation-content, .markdown-content') ?? cardEl;
    const align = String(annotation.style?.align ?? ANNOTATION_STYLE_DEFAULTS.align);
    const anchor: Anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
    const t = textFrom(content, nodeEl, posX, posY, anchor);
    if (t) parts.push(t);
  }

  if (parts.length === 0) return null;
  return maybeRotate(parts, rotation, posX + w / 2, posY + h / 2);
}

/** Clones every edge (path + midpoint marker + value label) as flow-space SVG. */
function harvestEdges(flowEl: Element): SVGElement {
  const group = el('g');
  group.setAttribute('class', 'export-edges');
  flowEl.querySelectorAll<SVGGElement>('.react-flow__edge').forEach((edge) => {
    const clone = edge.cloneNode(true) as SVGGElement;
    // Inline paint while the clone still mirrors the live subtree, so the
    // lockstep walk stays aligned. Pruning the interaction path first would
    // shift every later sibling (notably the midpoint marker) onto the wrong
    // live element and let it inherit that path's invisible paint.
    inlineTree(edge, clone);
    // Drop the invisible fat interaction path used for hit-testing.
    clone.querySelectorAll('.react-flow__edge-interaction').forEach((e) => e.remove());
    clone.removeAttribute('class');
    group.appendChild(clone);
  });
  return group;
}

function themeColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.body).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Makes the SVG self-contained by defining, on the root element, concrete values
 * for the dynamic paints that survive per-element inlining: `currentColor` (the
 * glyph ink) and any `var(--…)` still referenced (e.g. flow-passage fills, and
 * anything inside <defs>/<pattern>/<marker> whose used value can't be read).
 * They resolve by inheritance, and reflect whichever theme is active now.
 */
function bakeDynamicColors(svg: SVGSVGElement): void {
  // Glyph ink is authored as `currentColor`; anchor it to the frame ink color.
  svg.style.color = themeColor('--color-text-secondary', '#6c757d');

  const serialized = new XMLSerializer().serializeToString(svg);
  const used = new Set<string>();
  const re = /var\((--[A-Za-z0-9-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(serialized)) !== null) used.add(match[1]);
  used.forEach((name) => {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    if (value) svg.style.setProperty(name, value);
  });
}

function fmtTick(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(3);
}

/**
 * Builds the data-legend card as native vector (rounded card, gradient bar via
 * `<linearGradient>`, min/mid/max ticks), mirroring the live `DataLegend`.
 * Positioned at (x,y). Returns null when no contour is active.
 */
function buildLegend(x: number, y: number): { group: SVGElement } | null {
  const state = useDataStore.getState();
  const targets: { target: DataTarget; display: DataDisplayConfig }[] = [];
  for (const target of ['node', 'edge'] as DataTarget[]) {
    const display = target === 'node' ? state.nodeDisplay : state.edgeDisplay;
    if (!display.showContour) continue;
    if (selectActiveItem(state, target) && selectActiveDataset(state, target)) {
      targets.push({ target, display });
    }
  }
  if (targets.length === 0) return null;

  const PAD = 12;
  const ROW_GAP = 16;
  const BAR_H = 10;
  const CARD_W = 190;
  const rowH = 46;
  const cardH = PAD * 2 + targets.length * rowH + (targets.length - 1) * ROW_GAP;

  const surface = themeColor('--color-surface', '#ffffff');
  const border = themeColor('--color-border', '#dee2e6');
  const textMuted = themeColor('--color-text-muted', '#666666');

  const group = el('g');
  group.setAttribute('transform', `translate(${x} ${y})`);

  const card = el('rect');
  card.setAttribute('x', '0');
  card.setAttribute('y', '0');
  card.setAttribute('width', String(CARD_W));
  card.setAttribute('height', String(cardH));
  card.setAttribute('rx', '6');
  card.setAttribute('fill', surface);
  card.setAttribute('stroke', border);
  card.setAttribute('stroke-width', '1');
  group.appendChild(card);

  const defs = el('defs');
  group.appendChild(defs);

  targets.forEach(({ target, display }, idx) => {
    const top = PAD + idx * (rowH + ROW_GAP);
    const item = selectActiveItem(state, target);
    const dataset = selectActiveDataset(state, target);
    const name = `${dataset?.name ?? ''} / ${item?.name ?? ''}${item?.unit ? ` (${item.unit})` : ''}`;

    const label = el('text');
    label.setAttribute('x', String(PAD));
    label.setAttribute('y', String(top + 10));
    label.setAttribute('font-family', 'system-ui, sans-serif');
    label.setAttribute('font-size', '11');
    label.setAttribute('fill', textMuted);
    label.textContent = `${target}: ${name}`;
    group.appendChild(label);

    const gradId = `nemo-legend-grad-${target}`;
    const grad = el('linearGradient');
    grad.setAttribute('id', gradId);
    grad.setAttribute('x1', '0');
    grad.setAttribute('x2', '1');
    grad.setAttribute('y1', '0');
    grad.setAttribute('y2', '0');
    const SAMPLES = 12;
    for (let s = 0; s <= SAMPLES; s += 1) {
      const t = s / SAMPLES;
      const stop = el('stop');
      stop.setAttribute('offset', `${(t * 100).toFixed(1)}%`);
      stop.setAttribute('stop-color', sampleColormap(display.colormap, t));
      grad.appendChild(stop);
    }
    defs.appendChild(grad);

    const bar = el('rect');
    bar.setAttribute('x', String(PAD));
    bar.setAttribute('y', String(top + 18));
    bar.setAttribute('width', String(CARD_W - PAD * 2));
    bar.setAttribute('height', String(BAR_H));
    bar.setAttribute('rx', '2');
    bar.setAttribute('fill', `url(#${gradId})`);
    group.appendChild(bar);

    const mid = (display.min + display.max) / 2;
    const ticks: [number, string, Anchor][] = [
      [PAD, fmtTick(display.min), 'start'],
      [CARD_W / 2, fmtTick(mid), 'middle'],
      [CARD_W - PAD, fmtTick(display.max), 'end'],
    ];
    ticks.forEach(([tx, tv, anchor]) => {
      const tick = el('text');
      tick.setAttribute('x', String(tx));
      tick.setAttribute('y', String(top + 18 + BAR_H + 12));
      tick.setAttribute('font-family', 'system-ui, sans-serif');
      tick.setAttribute('font-size', '9');
      tick.setAttribute('fill', textMuted);
      tick.setAttribute('text-anchor', anchor);
      tick.textContent = tv;
      group.appendChild(tick);
    });
  });

  return { group };
}

/**
 * Serializes the current canvas into a detached native `<svg>` in flow
 * coordinates. Returns null when there is nothing to export.
 */
export function buildCanvasSvg(instance: ReactFlowInstance): BuiltCanvasSvg | null {
  const flowEl = document.querySelector('.react-flow');
  if (!flowEl) {
    logger.warn('Canvas export: React Flow root not found.');
    return null;
  }

  // Neutralize selection styling so highlights never leak into the export.
  const selected = Array.from(flowEl.querySelectorAll('.selected'));
  selected.forEach((e) => e.classList.remove('selected'));

  const svg = el('svg') as SVGSVGElement;
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('xmlns:xlink', XLINK_NS);
  const content = el('g');
  svg.appendChild(content);

  try {
    // Edges first so they sit under the nodes.
    content.appendChild(harvestEdges(flowEl));

    const nodesG = el('g');
    nodesG.setAttribute('class', 'export-nodes');
    for (const node of instance.getNodes()) {
      if (node.hidden) continue;
      const nodeEl = flowEl.querySelector<HTMLElement>(
        `.react-flow__node[data-id="${cssEscape(node.id)}"]`
      );
      if (!nodeEl) continue;
      const pos = node.positionAbsolute ?? node.position;
      const w = node.width ?? nodeEl.offsetWidth;
      const h = node.height ?? nodeEl.offsetHeight;
      const rotation = Number(node.data?.rotation) || 0;

      if (node.type === ANNOTATION_NODE_TYPE) {
        const annotation = node.data?.annotation as AnnotationData | undefined;
        if (!annotation || annotation.hidden) continue;
        const g = harvestAnnotation(nodeEl, annotation, pos.x, pos.y, w, h, rotation);
        if (g) nodesG.appendChild(g);
      } else {
        const g = harvestModelNode(nodeEl, pos.x, pos.y, w, h, rotation);
        if (g) nodesG.appendChild(g);
      }
    }
    content.appendChild(nodesG);
  } finally {
    selected.forEach((e) => e.classList.add('selected'));
  }

  // Measure the content bounds by briefly attaching offscreen.
  svg.setAttribute('data-export-measuring', '');
  svg.style.position = 'absolute';
  svg.style.left = '-99999px';
  svg.style.top = '0';
  svg.style.visibility = 'hidden';
  document.body.appendChild(svg);
  const graphics = content as unknown as SVGGraphicsElement;
  let bbox: DOMRect;
  try {
    bbox = graphics.getBBox();
  } catch {
    document.body.removeChild(svg);
    logger.warn('Canvas export: nothing to export.');
    return null;
  }

  if (!bbox || bbox.width === 0 || bbox.height === 0) {
    document.body.removeChild(svg);
    logger.warn('Canvas export: the canvas is empty.');
    return null;
  }

  // Legend: reproduce it where it visually sits over the canvas so the export is
  // WYSIWYG and honors any user drag. Project the live overlay's top-left corner
  // into flow coordinates; if it isn't in the DOM, fall back to a spot just right
  // of the graph. Recompute bounds to include it.
  const legendEl = flowEl.querySelector<HTMLElement>('.data-legend');
  let legendX = bbox.x + bbox.width + LEGEND_GAP;
  let legendY = bbox.y;
  if (legendEl) {
    const rect = legendEl.getBoundingClientRect();
    const flowPos = instance.screenToFlowPosition({ x: rect.left, y: rect.top });
    legendX = flowPos.x;
    legendY = flowPos.y;
  }
  const legend = buildLegend(legendX, legendY);
  if (legend) content.appendChild(legend.group);
  const full = graphics.getBBox();

  document.body.removeChild(svg);
  svg.removeAttribute('data-export-measuring');
  svg.removeAttribute('style');

  // Bake dynamic colors so the file is self-contained. `currentColor` (glyph
  // ink) and `var(--…)` inside <defs>/<pattern>/<marker> can't be resolved
  // per-element — those subtrees aren't in the render tree — so define them once
  // on the root, where they resolve by inheritance. Values follow the live theme.
  bakeDynamicColors(svg);

  const minX = full.x - PADDING;
  const minY = full.y - PADDING;
  const width = full.width + PADDING * 2;
  const height = full.height + PADDING * 2;
  svg.setAttribute('viewBox', `${minX} ${minY} ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));

  return { svg, width, height };
}

/** Minimal CSS.escape fallback for attribute selectors (node ids are simple). */
function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value);
  return value.replace(/["\\]/g, '\\$&');
}
