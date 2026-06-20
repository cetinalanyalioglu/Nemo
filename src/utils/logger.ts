import { useConsoleStore } from '../store/consoleStore';
import type { ConsoleLogLevel } from '../types/console';

/**
 * Mirrors a console-pane entry to the matching browser console method so the
 * same message is visible in devtools and — for errors — captured by the
 * diagnostics bridge (see {@link installDiagnosticsBridge}).
 */
const mirrorToBrowser = (level: ConsoleLogLevel, message: string): void => {
  switch (level) {
    case 'error':
      console.error(message);
      break;
    case 'warn':
      console.warn(message);
      break;
    case 'success':
    case 'info':
      console.info(message);
      break;
    case 'debug':
      console.debug(message);
      break;
  }
};

/**
 * Records a leveled message on both the in-app console pane (so the user sees
 * it) and the browser console (devtools + diagnostics capture). This is the
 * single entry point every important path should use to report progress,
 * warnings, and failures; raw `console.*` calls never reach the console pane.
 */
export const log = (level: ConsoleLogLevel, message: string): void => {
  useConsoleStore.getState().append(level, message);
  mirrorToBrowser(level, message);
};

/** Leveled helpers around {@link log}. Prefer these at call sites. */
export const logger = {
  debug: (message: string): void => log('debug', message),
  info: (message: string): void => log('info', message),
  success: (message: string): void => log('success', message),
  warn: (message: string): void => log('warn', message),
  error: (message: string): void => log('error', message),
};
