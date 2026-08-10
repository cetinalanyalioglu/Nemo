/**
 * Turns a built canvas `<svg>` into a downloadable SVG, PNG, or PDF file.
 * The SVG is already self-contained (inlined styles, embedded image data URIs,
 * no external refs), so rasterization and PDF conversion stay taint-free.
 */
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { downloadBlob } from '../download-blob';
import type { BuiltCanvasSvg } from './build-svg';

/** Default supersampling factor for PNG so raster output stays crisp. */
const PNG_SCALE = 2;

function serialize(svg: SVGSVGElement): string {
  const source = new XMLSerializer().serializeToString(svg);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${source}`;
}

export function downloadSvg(built: BuiltCanvasSvg, filename: string): void {
  const blob = new Blob([serialize(built.svg)], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

/** Rasterizes the SVG to a transparent PNG via an offscreen canvas. */
export async function downloadPng(
  built: BuiltCanvasSvg,
  filename: string,
  scale = PNG_SCALE
): Promise<void> {
  const svgString = serialize(built.svg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(built.width * scale));
    canvas.height = Math.max(1, Math.round(built.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not obtain a 2D canvas context.');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Canvas produced no PNG blob.');
    downloadBlob(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load the SVG for rasterization.'));
    image.src = src;
  });
}

/** Renders the SVG to a single-page, vector PDF sized to the artwork. */
export async function downloadPdf(built: BuiltCanvasSvg, filename: string): Promise<void> {
  const { width, height } = built;
  const orientation = width >= height ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: [width, height] });

  // svg2pdf needs the element attached to the document to resolve layout.
  const svg = built.svg.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('style', 'position:absolute; left:-99999px; top:0;');
  document.body.appendChild(svg);
  try {
    await svg2pdf(svg, pdf, { x: 0, y: 0, width, height });
    pdf.save(filename);
  } finally {
    svg.remove();
  }
}
