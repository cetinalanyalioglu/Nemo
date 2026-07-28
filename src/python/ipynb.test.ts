import { describe, expect, it } from 'vitest';
import { fromCaseNotebook, parseNotebook, serializeNotebook, toCaseNotebook } from './ipynb';
import { joinLines, type Notebook } from '../types/notebook';

/** A notebook as another tool would have written it: sources as lines, ids absent. */
const FROM_JUPYTER = JSON.stringify({
  cells: [
    {
      cell_type: 'markdown',
      metadata: {},
      source: ['# Findings\n', '\n', 'Pressure drops across the nozzle.'],
    },
    {
      cell_type: 'code',
      execution_count: 3,
      metadata: { tags: ['slow'] },
      source: ['net = nemo.network()\n', 'net.solve()'],
      outputs: [
        { output_type: 'stream', name: 'stdout', text: ['solved\n'] },
        {
          output_type: 'execute_result',
          execution_count: 3,
          data: { 'text/plain': 'Solution(converged=True)' },
          metadata: {},
        },
      ],
    },
  ],
  metadata: { kernelspec: { name: 'python3' } },
  nbformat: 4,
  nbformat_minor: 4,
});

describe('opening a notebook written elsewhere', () => {
  it('reads its cells without translating them', () => {
    const notebook = parseNotebook(FROM_JUPYTER);
    expect(notebook.cells.map((c) => c.cell_type)).toEqual(['markdown', 'code']);
    // A source may be one string or a list of lines; both are the same document.
    expect(joinLines(notebook.cells[0].source)).toBe(
      '# Findings\n\nPressure drops across the nozzle.'
    );
    expect(notebook.cells[1].outputs).toHaveLength(2);
    expect(notebook.cells[1].execution_count).toBe(3);
  });

  it('gives every cell an id, since a file may predate them carrying one', () => {
    const notebook = parseNotebook(FROM_JUPYTER);
    const ids = notebook.cells.map((c) => c.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps the metadata it was given', () => {
    expect(parseNotebook(FROM_JUPYTER).metadata).toEqual({ kernelspec: { name: 'python3' } });
    expect(parseNotebook(FROM_JUPYTER).cells[1].metadata).toEqual({ tags: ['slow'] });
  });

  it('refuses a version it cannot read rather than half-reading it', () => {
    const old = JSON.stringify({ cells: [], metadata: {}, nbformat: 3, nbformat_minor: 0 });
    expect(() => parseNotebook(old)).toThrow(/version 3/);
  });

  it('says plainly when the file is not a notebook at all', () => {
    expect(() => parseNotebook('{"hello": 1}')).toThrow(/not a notebook/);
    expect(() => parseNotebook('not json')).toThrow(/not JSON/);
  });

  it('drops entries in an outputs list that are not outputs', () => {
    const odd = JSON.stringify({
      cells: [{ cell_type: 'code', source: 'x', metadata: {}, outputs: [{ nope: true }, null] }],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    });
    expect(parseNotebook(odd).cells[0].outputs).toEqual([]);
  });
});

describe('writing one', () => {
  it('round-trips a notebook unchanged', () => {
    const opened = parseNotebook(FROM_JUPYTER);
    const reread = parseNotebook(serializeNotebook(opened));
    expect(reread.cells).toEqual(opened.cells);
    expect(reread.metadata).toEqual(opened.metadata);
  });

  it('writes the version it claims to write', () => {
    const written = JSON.parse(serializeNotebook(parseNotebook(FROM_JUPYTER)));
    expect(written.nbformat).toBe(4);
    expect(written.nbformat_minor).toBe(5);
  });
});

describe('what the case file carries', () => {
  const notebook: Notebook = parseNotebook(FROM_JUPYTER);

  it('keeps what was written and leaves out what was printed', () => {
    // A case describes a network. Outputs are the bulk of a notebook and are not that,
    // so they are left for a .ipynb export.
    const stored = toCaseNotebook(notebook);
    expect(stored.cells).toHaveLength(2);
    expect(stored.cells[1].outputs).toEqual([]);
    expect(joinLines(stored.cells[1].source)).toContain('nemo.network()');
  });

  it('reads back what it stored', () => {
    const reopened = fromCaseNotebook(toCaseNotebook(notebook));
    expect(reopened?.cells.map((c) => c.cell_type)).toEqual(['markdown', 'code']);
  });

  it('treats an absent or empty notebook as nothing to open', () => {
    // Loading a case without one must not wipe what is already in the Results tab.
    expect(fromCaseNotebook(undefined)).toBeNull();
    expect(fromCaseNotebook({ cells: [] })).toBeNull();
    expect(fromCaseNotebook('nonsense')).toBeNull();
  });
});
