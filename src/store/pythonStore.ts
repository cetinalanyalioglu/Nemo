import { create } from 'zustand';
import {
  PYTHON_MAX_ENTRIES,
  PYTHON_MAX_HISTORY,
  type PythonEntry,
  type PythonEntryKind,
  type PythonStatus,
} from '../types/python';

/**
 * The Python console's transcript and prompt state.
 *
 * Everything the console shows lives here: the lines printed so far, whether the
 * interpreter is busy, and the block being typed when it spans several lines. The
 * interpreter itself is not here — it runs in a worker and reports to this store
 * through {@link ../python/python-runtime}, so the pane can be closed, reopened, or
 * re-rendered without disturbing it.
 */
interface PythonStore {
  status: PythonStatus;
  /** A short phrase for the status line: the boot step, or what is installed. */
  detail: string;
  entries: PythonEntry[];
  /** Submitted lines, oldest first, for the up/down arrows. */
  history: string[];
  /**
   * The lines of an unfinished block. Non-empty means the interpreter is waiting for
   * the rest of it, and the prompt shows the continuation marker.
   */
  pending: string[];

  setStatus: (status: PythonStatus, detail?: string) => void;
  append: (kind: PythonEntryKind, text: string) => void;
  /**
   * Adds text to the last line when it is of the same kind, and starts a new one
   * otherwise. Output arrives in whatever pieces the interpreter flushes it in, and a
   * `print` split across two of them should still read as one line.
   */
  appendStream: (kind: PythonEntryKind, text: string) => void;
  remember: (source: string) => void;
  setPending: (pending: string[]) => void;
  clear: () => void;
}

let nextId = 0;
const makeEntry = (kind: PythonEntryKind, text: string): PythonEntry => ({
  id: `py-${nextId++}`,
  kind,
  text,
});

/** `entries` with `entry` on the end, capped at the transcript limit. */
const capped = (entries: PythonEntry[], entry: PythonEntry): PythonEntry[] => {
  const next = [...entries, entry];
  return next.length <= PYTHON_MAX_ENTRIES ? next : next.slice(next.length - PYTHON_MAX_ENTRIES);
};

export const usePythonStore = create<PythonStore>((set) => ({
  status: 'off',
  detail: '',
  entries: [],
  history: [],
  pending: [],

  setStatus: (status, detail) => set((s) => ({ status, detail: detail ?? s.detail })),

  append: (kind, text) => set((s) => ({ entries: capped(s.entries, makeEntry(kind, text)) })),

  appendStream: (kind, text) =>
    set((s) => {
      const last = s.entries[s.entries.length - 1];
      if (last && last.kind === kind && !last.text.endsWith('\n')) {
        const merged = { ...last, text: last.text + text };
        return { entries: [...s.entries.slice(0, -1), merged] };
      }
      return { entries: capped(s.entries, makeEntry(kind, text)) };
    }),

  remember: (source) =>
    set((s) => {
      // A line repeated straight after itself is not worth a second slot in the recall.
      if (source.trim().length === 0 || s.history[s.history.length - 1] === source) return {};
      const next = [...s.history, source];
      return {
        history:
          next.length <= PYTHON_MAX_HISTORY ? next : next.slice(next.length - PYTHON_MAX_HISTORY),
      };
    }),

  setPending: (pending) => set({ pending }),

  clear: () => set({ entries: [], pending: [] }),
}));
