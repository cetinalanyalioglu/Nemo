/**
 * Handing the built drawing over as a file.
 *
 * Only the SVG path is reachable from here. The PNG one rasterizes through an `<img>` and
 * a canvas, and the PDF one runs the drawing through svg2pdf; jsdom decodes no images and
 * paints nothing, so both would be testing a stand-in rather than the conversion. What is
 * checked is the part they share — the serialization — and the wrapper the file is
 * handed over in, which is what decides whether a browser opens it as a drawing.
 */

import { describe, expect, it, vi } from 'vitest';
import { downloadSvg } from './export-formats';
import { downloadBlob } from '../download-blob';
import type { BuiltCanvasSvg } from './build-svg';

vi.mock('../download-blob', () => ({ downloadBlob: vi.fn() }));

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A built drawing holding one rect, as the builder would return it. */
const built = (): BuiltCanvasSvg => {
  const svg = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('viewBox', '0 0 10 20');
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('width', '10');
  svg.appendChild(rect);
  return { svg, width: 10, height: 20 };
};

/** The blob and filename the last save was given. */
const lastSave = (): { blob: Blob; filename: string } => {
  const calls = vi.mocked(downloadBlob).mock.calls;
  const [blob, filename] = calls[calls.length - 1];
  return { blob, filename };
};

/** The text inside a blob. jsdom's `Blob` has no `text()`, so it is read the long way. */
const textOf = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

describe('saving the drawing as an SVG', () => {
  it('saves it under the name it was asked for', () => {
    downloadSvg(built(), 'network.svg');
    expect(lastSave().filename).toBe('network.svg');
  });

  it('declares it as an SVG, with the encoding its text is in', () => {
    // Without the type a browser downloads the file instead of opening it, and without
    // the encoding any label carrying a Greek symbol or a degree sign arrives mangled.
    downloadSvg(built(), 'network.svg');
    expect(lastSave().blob.type).toBe('image/svg+xml;charset=utf-8');
  });

  it('opens the file with an XML declaration', async () => {
    // The drawing is a standalone document once it is written out, not a fragment of a
    // page; some readers will not take it as one without the declaration.
    downloadSvg(built(), 'network.svg');
    const text = await textOf(lastSave().blob);
    expect(text.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('writes out the drawing itself, namespace and all', async () => {
    downloadSvg(built(), 'network.svg');
    const text = await textOf(lastSave().blob);
    expect(text).toContain(`xmlns="${SVG_NS}"`);
    expect(text).toContain('viewBox="0 0 10 20"');
    expect(text).toContain('<rect');
  });
});
