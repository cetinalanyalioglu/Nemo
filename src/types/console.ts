export type ConsoleLogLevel = 'debug' | 'info' | 'warn' | 'error' | 'success';

/**
 * How much a message is worth interrupting for, low to high.
 *
 * The order is what the verbosity setting cuts against, so it is about consequence
 * rather than tone: `debug` is a trace of what the app did, `info` is progress nobody
 * asked to be told about, `success` is an outcome that was asked for, and the last two
 * are things gone wrong.
 */
export const LOG_LEVEL_RANK: Record<ConsoleLogLevel, number> = {
  debug: 0,
  info: 1,
  success: 2,
  warn: 3,
  error: 4,
};

/**
 * The quietest level a message can be and still be recorded.
 *
 * Named by the lowest level it lets through, so a comparison against
 * {@link LOG_LEVEL_RANK} is the whole of the rule.
 */
export type ConsoleVerbosity = Extract<ConsoleLogLevel, 'debug' | 'info' | 'success' | 'warn'>;

/**
 * What the log shows by default: outcomes and problems, without the running commentary.
 *
 * Every step the app takes has something it could say, and saying all of it buries the
 * one line that mattered. What is left out is still written to the browser's own console,
 * so nothing is lost to someone looking for it.
 */
export const CONSOLE_VERBOSITY_DEFAULT: ConsoleVerbosity = 'success';

/** The choices offered in the Settings pane, quietest last. */
export const CONSOLE_VERBOSITY_OPTIONS: { value: ConsoleVerbosity; label: string }[] = [
  { value: 'debug', label: 'Everything' },
  { value: 'info', label: 'Detailed' },
  { value: 'success', label: 'Normal' },
  { value: 'warn', label: 'Problems only' },
];

/**
 * What the console pane shows: what the app has reported (`logs`), a Python prompt the
 * drawn network can be worked on from (`python`), and the names that prompt is holding
 * (`variables`).
 */
export type ConsoleTab = 'logs' | 'python' | 'variables';

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
