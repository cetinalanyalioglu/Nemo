/**
 * What a build without the optional parts does with a case that has them.
 *
 * The switches are build-time constants, so the only way to exercise the other build
 * from here is to stand in for the module that reports them. Everything below runs as
 * if `VITE_FEATURE_PYTHON_CONSOLE=false`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveFilePayload } from '../types/flow';

vi.mock('./features', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./features')>()),
  PYTHON_CONSOLE: false,
  NOTEBOOK: false,
  FEATURES: { pythonConsole: false, notebook: false },
}));

const { useGraphStore } = await import('../store/graphStore');
const { useNotebookStore } = await import('../store/notebookStore');
const { tabsFor } = await import('../components/console-pane');

/** A minimal case document, optionally carrying notebook cells. */
const caseWith = (notebook?: { cells: unknown[] }): SaveFilePayload => ({
  version: '2.0.0',
  timestamp: new Date().toISOString(),
  meta: { title: 'Carried' },
  ...(notebook ? { notebook } : {}),
  model: {
    id: undefined,
    globalAttributes: {},
    nodes: [{ id: 'n1', type: 'x', attributes: { label: 'A' } }],
    edges: [],
  },
  uiAttributes: { nodes: [{ id: 'n1', position: { x: 0, y: 0 } }] },
  uiState: { counters: { nodeCounters: {}, totalNodeCounters: {} } },
});

const CELLS = { cells: [{ cell_type: 'code', source: ['net = nemo.network()\n'] }] };

describe('a case opened in a build without the notebook', () => {
  beforeEach(() => {
    useGraphStore.getState().reset();
  });

  it('keeps the cells it arrived with and writes them back out', () => {
    // The whole point: someone whose build cannot show the Results tab can still open a
    // colleague's case, move an element and save, without quietly dropping their work.
    useGraphStore.getState().applySaveData(caseWith(CELLS));
    expect(useGraphStore.getState().carriedNotebook).toEqual(CELLS);
    expect(useGraphStore.getState().generateSaveData().notebook).toEqual(CELLS);
  });

  it('does not open them into a notebook nobody can see', () => {
    useNotebookStore.getState().reset();
    useGraphStore.getState().applySaveData(caseWith(CELLS));
    const written = useNotebookStore
      .getState()
      .toNotebook({ outputs: false })
      .cells.map((cell) => cell.source)
      .join('');

    expect(written).not.toContain('nemo.network');
  });

  it('writes no notebook for a case that never had one', () => {
    useGraphStore.getState().applySaveData(caseWith());
    expect(useGraphStore.getState().generateSaveData().notebook).toBeUndefined();
  });

  it('lets go of the cells when the canvas is cleared', () => {
    useGraphStore.getState().applySaveData(caseWith(CELLS));
    useGraphStore.getState().reset();

    expect(useGraphStore.getState().carriedNotebook).toBeNull();
    expect(useGraphStore.getState().generateSaveData().notebook).toBeUndefined();
  });
});

describe('the console pane in a build without Python', () => {
  it('offers the message log and nothing else', () => {
    expect(tabsFor(false).map((tab) => tab.id)).toEqual(['logs']);
  });

  it('offers all three where Python is on', () => {
    expect(tabsFor(true).map((tab) => tab.id)).toEqual(['logs', 'python', 'variables']);
  });
});
