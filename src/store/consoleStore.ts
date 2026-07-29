import { create } from 'zustand';
import {
  CONSOLE_VERBOSITY_DEFAULT,
  CONSOLE_VERBOSITY_OPTIONS,
  LOG_LEVEL_RANK,
  type ConsoleLogEntry,
  type ConsoleLogLevel,
  type ConsoleVerbosity,
} from '../types/console';

const MAX_LOG_ENTRIES = 500;

/** Where the verbosity choice is remembered between sessions. */
export const VERBOSITY_KEY = 'nemo.console.verbosity';

/** The verbosity as last set, or the default when there is nothing usable stored. */
const readStoredVerbosity = (): ConsoleVerbosity => {
  try {
    const stored = localStorage.getItem(VERBOSITY_KEY);
    // Checked against the choices that are actually offered, not against the levels a
    // message can have. Those are not the same set — `error` is a level but not a
    // choice — and a stored `error`, which nothing here writes but a later version or
    // a hand-edited store might, would quietly drop the warnings too.
    return CONSOLE_VERBOSITY_OPTIONS.some((option) => option.value === stored)
      ? (stored as ConsoleVerbosity)
      : CONSOLE_VERBOSITY_DEFAULT;
  } catch {
    return CONSOLE_VERBOSITY_DEFAULT;
  }
};

interface ConsoleStore {
  entries: ConsoleLogEntry[];
  /**
   * Messages appended since the console was last viewed. Bumped on every
   * append and reset to zero by {@link ConsoleStore.markRead} (called while the
   * pane is open). Drives the unread indicator on the collapsed pane header.
   */
  unreadCount: number;
  /**
   * The quietest message worth recording. Anything below it is dropped rather than
   * hidden: a log holds a bounded number of messages, and a run of trace ones would
   * otherwise push out the error that was worth keeping.
   */
  verbosity: ConsoleVerbosity;
  append: (level: ConsoleLogLevel, message: string) => void;
  setVerbosity: (verbosity: ConsoleVerbosity) => void;
  markRead: () => void;
  clear: () => void;
}

const createEntry = (level: ConsoleLogLevel, message: string): ConsoleLogEntry => ({
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  level,
  message,
});

export const useConsoleStore = create<ConsoleStore>((set) => ({
  entries: [],
  unreadCount: 0,
  verbosity: readStoredVerbosity(),
  append: (level, message) =>
    set((state) => {
      if (LOG_LEVEL_RANK[level] < LOG_LEVEL_RANK[state.verbosity]) return {};
      const next = [...state.entries, createEntry(level, message)];
      const unreadCount = state.unreadCount + 1;
      if (next.length <= MAX_LOG_ENTRIES) return { entries: next, unreadCount };
      return { entries: next.slice(next.length - MAX_LOG_ENTRIES), unreadCount };
    }),
  setVerbosity: (verbosity) => {
    try {
      localStorage.setItem(VERBOSITY_KEY, verbosity);
    } catch {
      /* localStorage unavailable */
    }
    set({ verbosity });
  },
  markRead: () => set((state) => (state.unreadCount === 0 ? {} : { unreadCount: 0 })),
  clear: () => set({ entries: [], unreadCount: 0 }),
}));
