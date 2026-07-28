export type ConsoleLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

/**
 * The two things the console pane shows: what the app has reported (`logs`), and a
 * Python prompt the drawn network can be worked on from (`python`).
 */
export type ConsoleTab = 'logs' | 'python';

/**
 * The two things the big surface can show: the network that is drawn, or the notebook
 * about it. The console pane stays docked below either.
 */
export type WorkspaceTab = 'canvas' | 'results';

export const CONSOLE_DEFAULT_HEIGHT = 200;
export const CONSOLE_MIN_HEIGHT = 120;
export const CONSOLE_MAX_HEIGHT_RATIO = 0.75;

export interface ConsoleLogEntry {
  id: string;
  timestamp: number;
  level: ConsoleLogLevel;
  message: string;
}
