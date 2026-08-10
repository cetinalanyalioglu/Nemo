/**
 * The messages the console and its Python interpreter exchange.
 *
 * Python runs in a worker, so nothing it does can touch the canvas directly: every
 * crossing is one of the messages below. Two rules keep that boundary honest.
 *
 * The case travels as **JSON text**, not as an object. The interpreter would otherwise
 * hand back proxies whose lifetime the receiving side has to manage, and a case that
 * carries result values is mostly numbers anyway, which text moves as fast as anything.
 *
 * Reads are **pushed, not requested**. The host stamps the current case onto every
 * `run`, so `nemo.case()` reads a copy that is already there. A Python routine asking
 * across a worker boundary would have to wait for the answer, and waiting is what a
 * worker cannot do without the interpreter's own interrupt machinery; pushing removes
 * the question. Writes go the other way as {@link BridgeCall}s and are not waited on.
 */

import type { ConsoleLogLevel } from '../types/console';
import type { CellOutput } from '../types/notebook';

/**
 * How a submission ended.
 *
 * Only how — what it produced arrived as {@link WorkerMessage} `display`s while it ran.
 * Keeping the two apart is what lets one interpreter serve a prompt and a notebook: the
 * prompt needs to know a block is unfinished, the notebook needs the outputs, and
 * neither has to care about the other's half.
 */
export type RunOutcome =
  /** The block ran to the end. */
  | { status: 'complete' }
  /** The block is unfinished (an open bracket, a `def` without its body). */
  | { status: 'incomplete' }
  /** The block raised, or would not parse; the traceback came as an `error` output. */
  | { status: 'failed' };

/** One name the session is holding, as the Variables tab lists it. */
export interface WorkspaceVariable {
  name: string;
  /** What sort of thing it is: `module`, `class`, `function`, or its type's name. */
  kind: string;
  /** A short description: how big it is where that is knowable, its repr otherwise. */
  summary: string;
}

/** One name the interpreter offers to finish what is being written. */
export interface Completion {
  /** The name itself, which is what is written in when it is chosen. */
  label: string;
  /** What sort of thing it is: `function`, `class`, `namespace`, `keyword`, and so on. */
  kind: string;
  /** What it takes where it takes anything, what type it is otherwise. */
  detail: string;
}

/** What the call being written takes, read off the thing being called. */
export interface SignatureHint {
  /** The call written out: its name and its parameters. */
  label: string;
  /** The argument the caret is in, where that can be said. */
  parameter: string;
  /** What the documentation says about that argument, or the opening of the docstring. */
  doc: string;
}

/** Something Python asked the canvas to do. Fire-and-forget, applied in arrival order. */
export type BridgeCall =
  /** Add result datasets to the canvas, in the shape the case format declares. */
  | { op: 'datasets'; datasets: unknown[] }
  /** Replace the whole canvas from a case document. */
  | { op: 'case'; doc: unknown }
  /** Write a line to the message log. */
  | { op: 'log'; level: ConsoleLogLevel; message: string };

/** Sent by the host, into the worker. */
export type HostMessage =
  /**
   * Start the interpreter: fetch it from `indexURL`, install `wheels` in order, then
   * run `adapter` — the Python the active model brought, and the only thing in this
   * exchange that knows what a particular solver is. Empty where the model has none.
   *
   * `handle` and `example` are the model's words about itself, and are handed to the
   * `nemo` module to fit itself out with: the second name it wants for `nemo.build()`,
   * and a few lines worth running against it. They travel as data because the fitting
   * is done in one place, in Python, rather than once per interpreter here.
   */
  | {
      kind: 'boot';
      indexURL: string;
      wheels: string[];
      adapter: string;
      handle: string;
      example: string;
    }
  /**
   * Run one submission, against the case as it stands right now.
   *
   * `mode` is the difference between a prompt and a notebook. A prompt is fed a line at
   * a time because it has to know when a block is still open; a cell arrives whole and
   * is compiled whole, which is the only way to read one whose blank lines fall inside
   * a block.
   */
  | { kind: 'run'; runId: number; source: string; caseJson: string; mode: 'line' | 'block' }
  /** Abandon the block being built up and start a fresh prompt. */
  | { kind: 'reset' }
  /** What names is the session holding? Answered with a `workspace`. */
  | { kind: 'workspace' }
  /** Forget them. The interpreter and its imports stay; only the names go. */
  | { kind: 'clear-workspace' }
  /**
   * What could finish what has been written up to the caret, and what does the call it
   * is inside take?
   *
   * `hintId` rather than `runId`: these are asked while typing and answered out of turn,
   * so a slow answer to an old question has to be recognised and dropped rather than
   * shown against what is on the screen now. They run nothing and change nothing.
   */
  | { kind: 'complete'; hintId: number; source: string }
  | { kind: 'signature'; hintId: number; source: string };

/** Sent by the worker, back to the host. */
export type WorkerMessage =
  /** Progress during boot, phrased for the status line. */
  | { kind: 'booting'; step: string }
  /** The interpreter is up. `packages` names what was installed beyond the base. */
  | { kind: 'ready'; python: string; packages: string[] }
  /** The interpreter could not start; the console is unusable until it is restarted. */
  | { kind: 'boot-failed'; error: string }
  /**
   * Something `runId` produced: printed text, the value it ended on, a figure showing
   * itself, a traceback. These are nbformat output objects as they will be saved, so
   * nothing between here and the file reshapes them.
   */
  | { kind: 'display'; runId: number; output: CellOutput }
  /** `runId` finished. */
  | { kind: 'ran'; runId: number; outcome: RunOutcome }
  /** Python asked the canvas for something. */
  | { kind: 'bridge'; call: BridgeCall }
  /** The names the session is holding, in answer to a `workspace` or a clear. */
  | { kind: 'workspace'; variables: WorkspaceVariable[] }
  /** What could finish the word. `from` is the offset in the source that they replace. */
  | { kind: 'completions'; hintId: number; items: Completion[]; from: number }
  /** What the call being written takes, or null where there is no call to describe. */
  | { kind: 'signature'; hintId: number; hint: SignatureHint | null };
