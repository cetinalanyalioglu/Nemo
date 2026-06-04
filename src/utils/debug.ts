import { appendConsoleMessage } from './console-log';

export const isDebugMode = (): boolean => {
  return true;
};

const formatDebugArgs = (args: unknown[]): string =>
  args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

export const debugLog = (...args: unknown[]): void => {
  if (isDebugMode()) {
    console.debug(...args);
    appendConsoleMessage(formatDebugArgs(args), 'info');
  }
};

export const debugError = (...args: unknown[]): void => {
  if (isDebugMode()) {
    console.error(...args);
    appendConsoleMessage(formatDebugArgs(args), 'error');
  }
};
