import { create } from 'zustand';
import type { ConsoleLogEntry, ConsoleLogLevel } from '../types/console';

const MAX_LOG_ENTRIES = 500;

interface ConsoleStore {
  entries: ConsoleLogEntry[];
  append: (level: ConsoleLogLevel, message: string) => void;
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
  append: (level, message) =>
    set((state) => {
      const next = [...state.entries, createEntry(level, message)];
      if (next.length <= MAX_LOG_ENTRIES) return { entries: next };
      return { entries: next.slice(next.length - MAX_LOG_ENTRIES) };
    }),
  clear: () => set({ entries: [] }),
}));
