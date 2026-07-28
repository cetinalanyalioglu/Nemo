/**
 * Types for the Python console: what the interpreter is doing, and what has been
 * printed in it.
 *
 * The transcript is a flat list of lines rather than a tree of submissions, because
 * that is how it reads and how it scrolls. Which kind a line is decides only how it is
 * marked; nothing downstream interprets the text.
 */

/** Where the interpreter is in its life. */
export type PythonStatus =
  /** Not started. It boots on the first submission, so this is the resting state. */
  | 'off'
  /** Fetching the interpreter and installing packages. */
  | 'starting'
  /** Up, and waiting for a line. */
  | 'ready'
  /** Running a submission. */
  | 'busy'
  /** It could not start; the reason is in the transcript. */
  | 'failed';

/** What one line of the transcript is. */
export type PythonEntryKind =
  /** The first line of a submission, shown behind the prompt. */
  | 'input'
  /** A further line of the same submission, shown behind the continuation prompt. */
  | 'continuation'
  /** Something printed to stdout. */
  | 'output'
  /** Something printed to stderr, or a traceback. */
  | 'error'
  /** The value of a trailing expression, as the interpreter reprs it. */
  | 'value'
  /** The console speaking for itself: boot progress, a restart, what version is up. */
  | 'note';

/** One line of the transcript. */
export interface PythonEntry {
  /** Stable id assigned on append. */
  id: string;
  kind: PythonEntryKind;
  text: string;
}

/** Longest transcript kept; older lines are dropped from the top. */
export const PYTHON_MAX_ENTRIES = 1000;

/** Longest recall list kept for the up/down arrows. */
export const PYTHON_MAX_HISTORY = 200;

/** The prompt shown for a new submission, and for the continuation of an open block. */
export const PYTHON_PROMPT = '>>>';
export const PYTHON_CONTINUATION_PROMPT = '...';
