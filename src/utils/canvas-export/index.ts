/**
 * Public entry point for exporting the canvas as vector graphics.
 * Builds a native SVG of the current flow network and downloads it in the
 * requested format.
 */
import type { ReactFlowInstance } from 'reactflow';
import { buildCanvasSvg } from './build-svg';
import { downloadSvg, downloadPng, downloadPdf } from './export-formats';
import { logger } from '../logger';

export type ExportFormat = 'svg' | 'png' | 'pdf';

const BASENAME = 'nemo-canvas';

/**
 * Exports the canvas. Returns true on success, false when there was nothing to
 * export (empty canvas or missing renderer).
 */
export async function exportCanvas(
  format: ExportFormat,
  instance: ReactFlowInstance
): Promise<boolean> {
  const built = buildCanvasSvg(instance);
  if (!built) return false;

  try {
    if (format === 'svg') downloadSvg(built, `${BASENAME}.svg`);
    else if (format === 'png') await downloadPng(built, `${BASENAME}.png`);
    else await downloadPdf(built, `${BASENAME}.pdf`);
    return true;
  } catch (error) {
    logger.error(`Canvas export (${format}) failed: ${String(error)}`);
    throw error;
  }
}
