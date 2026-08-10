/**
 * Reading and writing real notebooks.
 *
 * A `.ipynb` file is JSON against a published schema, and the cells this app holds are
 * already in that shape, so both directions are mostly a check that what arrived is
 * what it claims to be. Nothing is translated: a notebook written elsewhere opens here
 * with its cells intact, and one written here opens in Jupyter.
 *
 * Only nbformat 4 is read. Earlier versions were a different document (worksheets
 * rather than cells) and have not been written by anything since 2015; a file that
 * claims one is refused by name rather than half-read.
 */

import {
  joinLines,
  NBFORMAT_MAJOR,
  NBFORMAT_MINOR,
  type CellKind,
  type CellOutput,
  type Notebook,
  type NotebookCell,
} from '../types/notebook';

/** nbformat 4.5 wants a cell id; a file written before that has none, so one is made. */
const newId = (): string => `c${Math.random().toString(36).slice(2, 10)}`;

const KINDS: CellKind[] = ['code', 'markdown'];

/** Whether `value` is an output object rather than something else in the list. */
const isOutput = (value: unknown): value is CellOutput => {
  if (!value || typeof value !== 'object') return false;
  const kind = (value as { output_type?: unknown }).output_type;
  return (
    kind === 'stream' || kind === 'execute_result' || kind === 'display_data' || kind === 'error'
  );
};

/**
 * One cell of a parsed file.
 *
 * A raw cell — the third kind, which nothing renders — is read as a note, since that is
 * what it looks most like and losing it would be worse.
 */
const readCell = (value: unknown, index: number): NotebookCell => {
  if (!value || typeof value !== 'object') {
    throw new Error(`cell ${index + 1} is not an object`);
  }
  const cell = value as Partial<NotebookCell> & { cell_type?: unknown };
  const kind: CellKind = KINDS.includes(cell.cell_type as CellKind)
    ? (cell.cell_type as CellKind)
    : 'markdown';
  const source = joinLines(cell.source as string | string[] | undefined);

  if (kind === 'markdown') {
    return {
      id: typeof cell.id === 'string' && cell.id ? cell.id : newId(),
      cell_type: 'markdown',
      source,
      metadata: (cell.metadata as Record<string, unknown>) ?? {},
    };
  }
  return {
    id: typeof cell.id === 'string' && cell.id ? cell.id : newId(),
    cell_type: 'code',
    source,
    metadata: (cell.metadata as Record<string, unknown>) ?? {},
    outputs: Array.isArray(cell.outputs) ? cell.outputs.filter(isOutput) : [],
    execution_count: typeof cell.execution_count === 'number' ? cell.execution_count : null,
  };
};

/**
 * Parses notebook JSON.
 *
 * @throws when the text is not JSON, is not a notebook, or is a version this cannot read.
 */
export const parseNotebook = (text: string): Notebook => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`not JSON: ${error instanceof Error ? error.message : error}`);
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('not a notebook');

  const document = parsed as Partial<Notebook>;
  if (!Array.isArray(document.cells)) {
    throw new Error('not a notebook: no "cells" list');
  }
  const major = typeof document.nbformat === 'number' ? document.nbformat : 0;
  if (major !== 0 && major !== NBFORMAT_MAJOR) {
    throw new Error(
      `this is a version ${major} notebook; only version ${NBFORMAT_MAJOR} can be read`
    );
  }

  return {
    cells: document.cells.map(readCell),
    metadata: (document.metadata as Record<string, unknown>) ?? {},
    nbformat: NBFORMAT_MAJOR,
    nbformat_minor: NBFORMAT_MINOR,
  };
};

/** A notebook as the text of a `.ipynb` file, indented the way Jupyter writes them. */
export const serializeNotebook = (notebook: Notebook): string =>
  `${JSON.stringify(notebook, null, 1)}\n`;

/**
 * The source cells of a notebook, as the case file stores them.
 *
 * Outputs are left behind on purpose: they are the largest part of a notebook by far,
 * they are not what was written, and a case is a description of a network rather than
 * a record of what was printed about it. Export a `.ipynb` to keep them.
 */
export const toCaseNotebook = (notebook: Notebook): { cells: NotebookCell[] } => ({
  cells: notebook.cells.map((cell) =>
    cell.cell_type === 'code' ? { ...cell, outputs: [], execution_count: null } : cell
  ),
});

/** Reads back what {@link toCaseNotebook} stored. */
export const fromCaseNotebook = (stored: unknown): Notebook | null => {
  if (!stored || typeof stored !== 'object') return null;
  const cells = (stored as { cells?: unknown }).cells;
  if (!Array.isArray(cells) || cells.length === 0) return null;
  return {
    cells: cells.map(readCell),
    metadata: {},
    nbformat: NBFORMAT_MAJOR,
    nbformat_minor: NBFORMAT_MINOR,
  };
};
