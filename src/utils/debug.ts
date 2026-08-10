/**
 * Tracing helpers for paths that report what they did rather than what came of it.
 *
 * These are the logger's `debug` and `error` with the arguments joined into one line,
 * which is the only thing they add: whether a trace is worth recording is the message
 * log's verbosity to decide (see {@link ConsoleStore.verbosity}), in one place, rather
 * than a flag here that every call site would have to be trusted to respect.
 */

import { logger } from './logger';

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

export const debugLog = (...args: unknown[]): void => logger.debug(formatDebugArgs(args));

export const debugError = (...args: unknown[]): void => logger.error(formatDebugArgs(args));
