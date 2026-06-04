import { useConsoleStore } from '../store/consoleStore';
import type { ConsoleLogLevel } from '../types/console';

export const appendConsoleMessage = (message: string, level: ConsoleLogLevel = 'info'): void => {
  useConsoleStore.getState().append(level, message);
};
