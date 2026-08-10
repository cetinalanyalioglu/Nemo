/**
 * Notebook cells and their outputs, in the shapes `nbformat` specifies.
 *
 * These are not a private format that happens to resemble one. They are the objects a
 * `.ipynb` file holds, so a notebook read from disk needs no translating on the way in,
 * one written here needs none on the way out, and what a cell shows is exactly what
 * Jupyter would show it. The interpreter emits them directly; nothing in between
 * reshapes them.
 *
 * Only nbformat 4 is handled, which is every notebook written since 2015.
 *
 * See https://nbformat.readthedocs.io/en/latest/format_description.html — where this
 * file and the spec disagree, the spec is right.
 */

/** The nbformat version written, and the only major version read. */
export const NBFORMAT_MAJOR = 4;
export const NBFORMAT_MINOR = 5;

/**
 * A value keyed by media type: `text/plain`, `text/html`, `image/png`,
 * `application/vnd.plotly.v1+json`, … Every producer offers what it can and the richest
 * one a renderer understands is shown, which is how a plotly figure draws here and
 * still prints as text somewhere that cannot draw it.
 */
export type MimeBundle = Record<string, unknown>;

/** Text that a producer may hand over as one string or as a list of lines. */
export type MultilineString = string | string[];

/** Something printed to stdout or stderr while a cell ran. */
export interface StreamOutput {
  output_type: 'stream';
  name: 'stdout' | 'stderr';
  text: MultilineString;
}

/** The value of a cell's last expression. */
export interface ExecuteResultOutput {
  output_type: 'execute_result';
  execution_count: number | null;
  data: MimeBundle;
  metadata: Record<string, unknown>;
}

/** Something shown mid-cell, by `display()` or by a figure showing itself. */
export interface DisplayDataOutput {
  output_type: 'display_data';
  data: MimeBundle;
  metadata: Record<string, unknown>;
}

/** A cell that raised. */
export interface ErrorOutput {
  output_type: 'error';
  ename: string;
  evalue: string;
  traceback: string[];
}

export type CellOutput = StreamOutput | ExecuteResultOutput | DisplayDataOutput | ErrorOutput;

/** Whether an output carries a MIME bundle to choose a renderer from. */
export const hasData = (output: CellOutput): output is ExecuteResultOutput | DisplayDataOutput =>
  output.output_type === 'execute_result' || output.output_type === 'display_data';

/** A multiline string as one string, whichever of the two forms it arrived in. */
export const joinLines = (text: MultilineString | undefined): string =>
  Array.isArray(text) ? text.join('') : (text ?? '');

/**
 * `outputs` with `output` on the end, run together with the one before it where they
 * belong together.
 *
 * Printing arrives in whatever pieces the interpreter flushes: `print("hi")` is two
 * writes, the text and the newline, and a loop is thousands. Consecutive writes to the
 * same stream are therefore joined into one output, which is what a notebook file
 * holds and what anything reading one expects to find.
 */
export const appendOutput = (outputs: CellOutput[], output: CellOutput): CellOutput[] => {
  const last = outputs[outputs.length - 1];
  if (
    last &&
    last.output_type === 'stream' &&
    output.output_type === 'stream' &&
    last.name === output.name
  ) {
    const merged: StreamOutput = {
      ...last,
      text: joinLines(last.text) + joinLines(output.text),
    };
    return [...outputs.slice(0, -1), merged];
  }
  return [...outputs, output];
};

/** What a cell is: Python to run, or prose to read. */
export type CellKind = 'code' | 'markdown';

/**
 * One cell.
 *
 * `id` is nbformat's own cell id (4.5 and later), so it survives a round trip through a
 * file. `outputs` and `execution_count` are absent on a markdown cell, as the spec has
 * it, and are dropped when the notebook is stored with the case — a case carries what
 * was written, never what it printed.
 */
export interface NotebookCell {
  id: string;
  cell_type: CellKind;
  source: MultilineString;
  metadata: Record<string, unknown>;
  outputs?: CellOutput[];
  execution_count?: number | null;
}

/** A whole notebook, as the file holds it. */
export interface Notebook {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

/** How a cell stands with respect to the interpreter. Session state, never saved. */
export type CellRunState =
  /** Not run, or edited since it was. */
  | 'idle'
  /** Sent, and waiting behind whatever is running. */
  | 'queued'
  /** Running now. */
  | 'running'
  /** Ran, and its outputs are what is shown. */
  | 'done'
  /** Raised; the traceback is among its outputs. */
  | 'failed';
