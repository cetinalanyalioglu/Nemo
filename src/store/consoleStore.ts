import { create } from 'zustand';
import type { ConsoleLogEntry, ConsoleLogLevel } from '../types/console';

const MAX_LOG_ENTRIES = 500;

interface ConsoleStore {
  entries: ConsoleLogEntry[];
  /**
   * Messages appended since the console was last viewed. Bumped on every
   * append and reset to zero by {@link ConsoleStore.markRead} (called while the
   * pane is open). Drives the unread indicator on the collapsed pane header.
   */
  unreadCount: number;
  append: (level: ConsoleLogLevel, message: string) => void;
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
  append: (level, message) =>
    set((state) => {
      const next = [...state.entries, createEntry(level, message)];
      const unreadCount = state.unreadCount + 1;
      if (next.length <= MAX_LOG_ENTRIES) return { entries: next, unreadCount };
      return { entries: next.slice(next.length - MAX_LOG_ENTRIES), unreadCount };
    }),
  markRead: () => set((state) => (state.unreadCount === 0 ? {} : { unreadCount: 0 })),
  clear: () => set({ entries: [], unreadCount: 0 }),
}));
