import { create } from 'zustand';
import { runPython } from '../python/python-runtime';
import {
  appendOutput,
  joinLines,
  NBFORMAT_MAJOR,
  NBFORMAT_MINOR,
  type CellKind,
  type CellOutput,
  type CellRunState,
  type Notebook,
  type NotebookCell,
} from '../types/notebook';

/**
 * The notebook shown in the Results tab.
 *
 * Cells are held in the shape a `.ipynb` file holds them, so opening and saving one is
 * a read and a write rather than a translation. What is *not* in that shape is kept
 * beside them: which cell is running and which is selected are facts about this
 * session, not about the document, and are never written out.
 *
 * Execution goes through the same interpreter as the console prompt and shares its
 * namespace, so a name defined in a cell is there at the prompt and the other way
 * round. Cells run one at a time and in the order they were asked for, which is the
 * only order a notebook's names make sense in.
 */
interface NotebookStore {
  cells: NotebookCell[];
  /** Notebook-level metadata, carried through a round trip untouched. */
  metadata: Record<string, unknown>;
  /** Per-cell run state, keyed by cell id. Session only. */
  runState: Record<string, CellRunState>;
  /** The cell the toolbar acts on, or null when none is selected. */
  selectedId: string | null;
  /** Counts executions, as a notebook numbers its cells. */
  executionCount: number;
  /** Whether anything has changed since the notebook was opened or saved. */
  dirty: boolean;
  /** Set while cells are running, so a second Run All does not interleave. */
  running: boolean;

  select: (id: string | null) => void;
  addCell: (kind: CellKind, afterId?: string | null) => string;
  removeCell: (id: string) => void;
  moveCell: (id: string, delta: number) => void;
  setSource: (id: string, source: string) => void;
  setKind: (id: string, kind: CellKind) => void;
  clearOutputs: (id?: string) => void;

  /** Runs one cell, and resolves when it has finished. */
  runCell: (id: string) => Promise<void>;
  /** Runs every code cell from the top, stopping at the first that fails. */
  runAll: () => Promise<void>;

  /** Replaces the notebook, as opening a file does. */
  open: (notebook: Notebook) => void;
  /** The notebook as a file would hold it; `outputs` decides whether they come too. */
  toNotebook: (options?: { outputs?: boolean }) => Notebook;
  /** Empties it back to one blank cell. */
  reset: () => void;
  markSaved: () => void;
}

/** nbformat 4.5 wants a cell id: short, and unique within the notebook. */
const newId = (): string => `c${Math.random().toString(36).slice(2, 10)}`;

const blankCell = (kind: CellKind = 'code'): NotebookCell => ({
  id: newId(),
  cell_type: kind,
  source: '',
  metadata: {},
  ...(kind === 'code' ? { outputs: [], execution_count: null } : {}),
});

/** A markdown cell holds no outputs, and a code cell always holds a list. */
const asKind = (cell: NotebookCell, kind: CellKind): NotebookCell =>
  kind === 'code'
    ? { ...cell, cell_type: 'code', outputs: cell.outputs ?? [], execution_count: null }
    : { id: cell.id, cell_type: 'markdown', source: cell.source, metadata: cell.metadata };

export const useNotebookStore = create<NotebookStore>((set, get) => ({
  cells: [blankCell()],
  metadata: {},
  runState: {},
  selectedId: null,
  executionCount: 0,
  dirty: false,
  running: false,

  select: (selectedId) => set({ selectedId }),

  addCell: (kind, afterId) => {
    const cell = blankCell(kind);
    set((s) => {
      const at = afterId ? s.cells.findIndex((c) => c.id === afterId) : s.cells.length - 1;
      const cells = [...s.cells];
      cells.splice(at + 1, 0, cell);
      return { cells, selectedId: cell.id, dirty: true };
    });
    return cell.id;
  },

  removeCell: (id) =>
    set((s) => {
      const remaining = s.cells.filter((c) => c.id !== id);
      // A notebook always has somewhere to type; removing the last cell leaves a blank.
      const cells = remaining.length > 0 ? remaining : [blankCell()];
      const { [id]: _dropped, ...runState } = s.runState;
      return {
        cells,
        runState,
        dirty: true,
        selectedId: s.selectedId === id ? null : s.selectedId,
      };
    }),

  moveCell: (id, delta) =>
    set((s) => {
      const from = s.cells.findIndex((c) => c.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= s.cells.length) return {};
      const cells = [...s.cells];
      const [cell] = cells.splice(from, 1);
      cells.splice(to, 0, cell);
      return { cells, dirty: true };
    }),

  setSource: (id, source) =>
    set((s) => ({
      cells: s.cells.map((c) => (c.id === id ? { ...c, source } : c)),
      // Edited since it ran, so what is shown below it is no longer what it produces.
      runState: s.runState[id] === 'done' ? { ...s.runState, [id]: 'idle' } : s.runState,
      dirty: true,
    })),

  setKind: (id, kind) =>
    set((s) => ({
      cells: s.cells.map((c) => (c.id === id ? asKind(c, kind) : c)),
      dirty: true,
    })),

  clearOutputs: (id) =>
    set((s) => ({
      cells: s.cells.map((c) =>
        c.cell_type === 'code' && (id === undefined || c.id === id)
          ? { ...c, outputs: [], execution_count: null }
          : c
      ),
      runState: id === undefined ? {} : { ...s.runState, [id]: 'idle' },
    })),

  runCell: async (id) => {
    const cell = get().cells.find((c) => c.id === id);
    if (!cell || cell.cell_type !== 'code') return;

    const source = joinLines(cell.source);
    const count = get().executionCount + 1;
    set((s) => ({
      executionCount: count,
      runState: { ...s.runState, [id]: 'running' },
      cells: s.cells.map((c) => (c.id === id ? { ...c, outputs: [], execution_count: null } : c)),
    }));

    // Outputs are appended as they arrive rather than collected and set at the end, so
    // a long cell shows its progress instead of nothing until it finishes.
    const collect = (output: CellOutput) =>
      set((s) => ({
        cells: s.cells.map((c) =>
          c.id === id ? { ...c, outputs: appendOutput(c.outputs ?? [], output) } : c
        ),
      }));

    const outcome = await runPython(source, collect);
    set((s) => ({
      runState: { ...s.runState, [id]: outcome.status === 'failed' ? 'failed' : 'done' },
      cells: s.cells.map((c) => (c.id === id ? { ...c, execution_count: count } : c)),
      dirty: true,
    }));
  },

  runAll: async () => {
    if (get().running) return;
    set({ running: true });
    try {
      // Read the ids up front: running a cell can change what is in the store, but the
      // run is over the cells as they stood when it was asked for.
      const ids = get()
        .cells.filter((c) => c.cell_type === 'code')
        .map((c) => c.id);
      set((s) => ({
        runState: ids.reduce((acc, id) => ({ ...acc, [id]: 'queued' }), { ...s.runState }),
      }));
      for (const id of ids) {
        await get().runCell(id);
        // A notebook is read top to bottom, so what follows a failure was written
        // expecting the failure not to have happened.
        if (get().runState[id] === 'failed') {
          set((s) => ({
            runState: ids.reduce(
              (acc, other) => (acc[other] === 'queued' ? { ...acc, [other]: 'idle' } : acc),
              { ...s.runState }
            ),
          }));
          break;
        }
      }
    } finally {
      set({ running: false });
    }
  },

  open: (notebook) =>
    set({
      // A file may carry cells without ids (nbformat before 4.5); they get one here so
      // everything downstream can key on it.
      cells: (notebook.cells ?? []).map((cell) => ({ ...cell, id: cell.id || newId() })),
      metadata: notebook.metadata ?? {},
      runState: {},
      selectedId: null,
      executionCount: 0,
      dirty: false,
    }),

  toNotebook: ({ outputs = true } = {}) => ({
    cells: get().cells.map((cell) => {
      if (cell.cell_type !== 'code') return cell;
      return outputs ? cell : { ...cell, outputs: [], execution_count: null };
    }),
    metadata: get().metadata,
    nbformat: NBFORMAT_MAJOR,
    nbformat_minor: NBFORMAT_MINOR,
  }),

  reset: () =>
    set({
      cells: [blankCell()],
      metadata: {},
      runState: {},
      selectedId: null,
      executionCount: 0,
      dirty: false,
    }),

  markSaved: () => set({ dirty: false }),
}));
