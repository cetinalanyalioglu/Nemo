import { useConsoleStore } from '../store/consoleStore';
import type { ConsoleLogLevel } from '../types/console';

export const logToConsole = (message: string, level: ConsoleLogLevel = 'info'): void => {
  useConsoleStore.getState().append(level, message);
};

/** @deprecated Use logToConsole instead */
export const appendConsoleMessage = logToConsole;
