export type ConsoleLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

export const CONSOLE_DEFAULT_HEIGHT = 200;
export const CONSOLE_MIN_HEIGHT = 120;
export const CONSOLE_MAX_HEIGHT_RATIO = 0.75;

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;
  level: ConsoleLogLevel;
  message: string;
}
