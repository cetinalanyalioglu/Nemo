import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { dropDanglingMarkers } from './build-svg';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Builds a detached SVG from markup, the way the export assembles one. */
const svgFrom = (inner: string): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.innerHTML = inner;
  return svg;
};

describe('dropDanglingMarkers', () => {
  it('drops an attribute reference to an id the SVG does not carry', () => {
    const svg = svgFrom('<path d="M0,0 L10,10" marker-end="url(#nope)"/>');
    dropDanglingMarkers(svg);
    expect(svg.querySelector('path')?.hasAttribute('marker-end')).toBe(false);
  });

  it('drops a style reference to an id the SVG does not carry', () => {
    // The form the glyph assets use: the reference lives in the style attribute,
    // where it outranks — and outlives — any attribute of the same name.
    const svg = svgFrom('<path d="M0,0 L10,10" style="marker-mid:url(#nope)"/>');
    dropDanglingMarkers(svg);
    expect(svg.querySelector('path')?.style.getPropertyValue('marker-mid')).toBe('');
  });

  it('keeps a reference whose marker is defined in the same SVG', () => {
    const svg = svgFrom(
      '<defs><marker id="tip"><path d="M0,0 L4,2 L0,4 Z"/></marker></defs>' +
        '<path d="M0,0 L10,10" style="marker-end:url(#tip)" marker-start="url(#tip)"/>'
    );
    dropDanglingMarkers(svg);
    const path = svg.querySelector('path[d="M0,0 L10,10"]');

    expect(path?.getAttribute('marker-start')).toBe('url(#tip)');
    expect((path as SVGElement).style.getPropertyValue('marker-end')).toBe('url(#tip)');
  });

  it('leaves every other kind of reference alone', () => {
    // Fills, strokes and clips that do not resolve are the PDF writer's own problem,
    // and it already handles them. Touching them here would only lose paint.
    const svg = svgFrom('<rect style="fill:url(#nope);clip-path:url(#nope)"/>');
    dropDanglingMarkers(svg);
    const rect = svg.querySelector('rect') as SVGElement;

    expect(rect.style.getPropertyValue('fill')).toBe('url(#nope)');
    expect(rect.style.getPropertyValue('clip-path')).toBe('url(#nope)');
  });

  it('keeps `none`, which is a value rather than a reference', () => {
    const svg = svgFrom('<path d="M0,0 L10,10" marker-end="none"/>');
    dropDanglingMarkers(svg);
    expect(svg.querySelector('path')?.getAttribute('marker-end')).toBe('none');
  });
});

/**
 * The glyph assets themselves. A marker reference that resolves to nothing draws
 * nothing in the browser, so it is invisible until a PDF export walks it — which is
 * how one sat in `sudden-area-change.svg` unnoticed. Cheaper to catch here.
 */
describe('the shipped glyph assets', () => {
  const dir = resolve(__dirname, '../../assets/glyphs');
  const files = readdirSync(dir).filter((name) => name.endsWith('.svg'));

  it.each(files)('%s references only markers it defines', (name) => {
    const raw = readFileSync(resolve(dir, name), 'utf8');
    const defined = new Set([...raw.matchAll(/<marker[^>]*\sid="([^"]+)"/g)].map((m) => m[1]));
    const referenced = [...raw.matchAll(/marker-(?:start|mid|end)\s*[:=]\s*"?url\(#([^)"]+)\)/g)];

    expect(referenced.filter((m) => !defined.has(m[1])).map((m) => m[1])).toEqual([]);
  });
});

/** The shape sudden-area-change.svg had: a marker defined as -4, referenced without it. */
const glyphLike = (): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('width', '100');
  svg.setAttribute('height', '100');
  svg.innerHTML =
    '<defs><marker id="Sudden1-abc-Triangle-4" markerWidth="1" markerHeight="1" viewBox="0 0 1 1">' +
    '<path d="M0,0 L1,0.5 L0,1 Z"/></marker></defs>' +
    '<path d="M10,10 L50,10 L50,50" style="stroke:#000;fill:none;' +
    'marker-mid:url(#Sudden1-abc-Triangle);marker-end:url(#Sudden1-abc-Triangle)"/>';
  return svg;
};

const toPdf = async (svg: SVGSVGElement) => {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [100, 100] });
  await svg2pdf(svg, pdf, { x: 0, y: 0, width: 100, height: 100 });
  return pdf.output('arraybuffer').byteLength;
};

describe('PDF export of a glyph with a dangling marker', () => {
  it('is what crashed the export', async () => {
    await expect(toPdf(glyphLike())).rejects.toThrow(/Cannot read properties of undefined/);
  });

  it('converts once the dangling reference is dropped', async () => {
    const svg = glyphLike();
    dropDanglingMarkers(svg);
    expect(await toPdf(svg)).toBeGreaterThan(0);
  });

  it('still draws a marker that does resolve', async () => {
    const svg = glyphLike();
    svg.querySelector('path')?.style.setProperty('marker-end', 'url(#Sudden1-abc-Triangle-4)');
    dropDanglingMarkers(svg);
    expect(svg.querySelector('path')?.style.getPropertyValue('marker-end')).toBe(
      'url(#Sudden1-abc-Triangle-4)'
    );
    expect(await toPdf(svg)).toBeGreaterThan(0);
  });
});
