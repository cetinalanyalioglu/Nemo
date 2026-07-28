import { describe, expect, it } from 'vitest';
import { grayscaleResidualColors } from './monochrome';

const XLINK_NS = 'http://www.w3.org/1999/xlink';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** An `<svg>` holding one `<image>` at `href`, as the export builds one. */
const withImage = (href: string): SVGSVGElement => {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const image = document.createElementNS(SVG_NS, 'image');
  image.setAttribute('href', href);
  image.setAttributeNS(XLINK_NS, 'href', href);
  svg.appendChild(image);
  return svg as SVGSVGElement;
};

const svgDataUri = (source: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`;

const decode = (href: string) =>
  decodeURIComponent(href.replace(/^data:image\/svg\+xml[^,]*,/, ''));

/** A miniature of what a pinned figure is: a finished plot, in colour. */
const FIGURE = `<svg xmlns="http://www.w3.org/2000/svg">
  <rect style="fill: rgb(255, 255, 255)"/>
  <path style="stroke: rgb(37, 99, 235); fill: none"/>
  <path style="stroke: #ea580c"/>
  <path style="fill: rgba(37, 99, 235, 0.2)"/>
  <text style="fill: rgb(82, 96, 109)">190k</text>
</svg>`;

describe('a picture placed in a black-and-white drawing', () => {
  it('has its colours mapped to gray, inside the picture', () => {
    // A pinned figure is a finished SVG behind a data URI: past where a theme token
    // could reach it, and one opaque element to anything walking the drawing. Left
    // alone it is a colour plot in the middle of line art.
    const svg = withImage(svgDataUri(FIGURE));
    grayscaleResidualColors(svg);

    const source = decode(svg.querySelector('image')!.getAttribute('href')!);
    expect(source).not.toContain('rgb(37, 99, 235)');
    expect(source).not.toContain('#ea580c');
    expect(source).toMatch(/#[0-9a-f]{6}/);
  });

  it('keeps two series apart, rather than flattening both to black', () => {
    const svg = withImage(svgDataUri(FIGURE));
    grayscaleResidualColors(svg);
    const source = decode(svg.querySelector('image')!.getAttribute('href')!);

    const grays = [...source.matchAll(/stroke: (#[0-9a-f]{6})/g)].map((m) => m[1]);
    expect(grays).toHaveLength(2);
    expect(grays[0]).not.toBe(grays[1]);
  });

  it('keeps a translucent fill translucent', () => {
    // A band under a curve is see-through on purpose; a solid slab would hide it.
    const svg = withImage(svgDataUri(FIGURE));
    grayscaleResidualColors(svg);
    const source = decode(svg.querySelector('image')!.getAttribute('href')!);
    expect(source).toMatch(/rgba\(\d+, \d+, \d+, 0\.2\)/);
  });

  it('writes the result to both spellings of the link', () => {
    // Renderers disagree about which one to read; the export sets both.
    const svg = withImage(svgDataUri(FIGURE));
    grayscaleResidualColors(svg);
    const image = svg.querySelector('image')!;
    expect(image.getAttribute('href')).toBe(image.getAttributeNS(XLINK_NS, 'href'));
    expect(decode(image.getAttribute('href')!)).not.toContain('rgb(37, 99, 235)');
  });

  it('leaves a picture it cannot recolour exactly as it was', () => {
    // A photograph or a screenshot has no colours to rewrite; better whole than lost.
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const svg = withImage(png);
    grayscaleResidualColors(svg);
    expect(svg.querySelector('image')!.getAttribute('href')).toBe(png);
  });

  it('leaves a picture that was already gray alone', () => {
    const gray = svgDataUri('<svg><path style="stroke: #808080"/></svg>');
    const svg = withImage(gray);
    grayscaleResidualColors(svg);
    expect(svg.querySelector('image')!.getAttribute('href')).toBe(gray);
  });
});
