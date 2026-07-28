/**
 * The console's half of the boundary: starting the interpreter, feeding it lines, and
 * handing what comes back to the transcript, the canvas, or the message log.
 *
 * There is one interpreter per session and it outlives the pane, so this is a module
 * with state rather than a hook. It starts on the first submission rather than at load,
 * because starting it may mean fetching some tens of megabytes and most sessions never
 * open the console at all.
 *
 * Where that interpreter runs is a {@link Transport} and nothing here depends on which
 * one it is.
 */

import { useGraphStore } from '../store/graphStore';
import { usePythonStore } from '../store/pythonStore';
import { logger } from '../utils/logger';
import { applyBridgeCall } from './bridge';
import type { CellOutput } from '../types/notebook';
import type { Completion, HostMessage, RunOutcome, SignatureHint, WorkerMessage } from './protocol';
import {
  browserTransport,
  LOCAL_ADDRESS_KEY,
  localTransport,
  RUNTIME_KIND_KEY,
  type RuntimeKind,
  type Transport,
} from './transport';

/**
 * Which Pyodide build to fetch. Kept in step with the `pyodide` dependency, whose types
 * this is checked against; `python-runtime.test.ts` fails if the two drift apart.
 */
export const PYODIDE_VERSION = '314.0.3';

/** Where that build is served from. The distribution is far too large to bundle. */
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** Where one submission's outputs are collected: a transcript, or a notebook cell. */
export type OutputSink = (output: CellOutput) => void;

let transport: Transport | null = null;
let runCounter = 0;
let hintCounter = 0;
/**
 * Questions about what is being typed, waiting on their answers, by `hintId`. Each keeps
 * what to answer with if the interpreter goes away before it replies, so nothing typed
 * against a discarded interpreter waits forever.
 */
const awaitingHints = new Map<number, { settle: (answer: unknown) => void; fallback: unknown }>();
/** Resolves when the submission with this id reports back, and where its outputs go. */
let awaitingRun: {
  runId: number;
  sink: OutputSink;
  resolve: (outcome: RunOutcome) => void;
} | null = null;
/** Settles when boot finishes, either way; shared by every caller that waits on it. */
let booting: Promise<void> | null = null;
let bootSettled: (() => void) | null = null;
/** Which model the running interpreter was started for; a change means a restart. */
let bootedFor: string | null = null;
/** Which transport it was started on, for the same reason. */
let bootedOn: RuntimeKind | null = null;

const store = () => usePythonStore.getState();

/**
 * The solver the model on the canvas declared, with its packages resolved to addresses
 * that can be fetched.
 *
 * This is the whole of what the console knows about solvers: a model may name packages
 * and some Python, and neither means anything here. A model that declares none gets a
 * prompt that reads and draws the canvas and has nothing to compute with.
 */
const activeSolver = (): {
  id: string | null;
  wheels: string[];
  adapter: string;
  handle: string;
  example: string;
} => {
  const model = useGraphStore.getState().model;
  const solver = model?.solver ?? null;
  const base = new URL(import.meta.env.BASE_URL, window.location.href);
  return {
    id: model?.id ?? null,
    wheels: (solver?.packages ?? []).map((pkg) => resolvePackage(pkg, base)),
    adapter: solver?.adapter ?? '',
    handle: solver?.handle ?? '',
    example: solver?.example ?? '',
  };
};

/**
 * Where one of a model's packages comes from.
 *
 * A path is something the app is serving — the wheel beside it — and is resolved
 * against wherever the app is being served from. A bare name is a requirement, resolved
 * wherever the installer resolves requirements, and must be handed over as written:
 * turning `plotly` into an address of this app asks for a file that is not there.
 */
export const resolvePackage = (pkg: string, base: URL): string =>
  pkg.includes('/') ? new URL(pkg, base).href : pkg;

/** Releases everything waiting on boot. Called however boot ends, so nothing waits forever. */
const settleBoot = (): void => {
  const settle = bootSettled;
  bootSettled = null;
  settle?.();
};

const onMessage = (message: WorkerMessage): void => {
  switch (message.kind) {
    case 'booting':
      store().setStatus('starting', message.step);
      return;

    case 'ready': {
      const detail = ['Python ' + message.python, ...message.packages].join(' · ');
      store().setStatus('ready', detail);
      store().append('note', detail);
      settleBoot();
      return;
    }

    case 'boot-failed':
      store().setStatus('failed', 'the interpreter could not start');
      store().append('error', message.error);
      logger.error(`The Python console could not start: ${message.error}`);
      settleBoot();
      return;

    case 'display':
      // Outputs belong to whatever asked for the run: they are lines in the prompt's
      // transcript or they are a cell's, and only the caller knows which.
      if (awaitingRun?.runId === message.runId) awaitingRun.sink(message.output);
      return;

    case 'bridge':
      applyBridgeCall(message.call);
      return;

    case 'workspace':
      store().setVariables(message.variables);
      return;

    case 'completions':
    case 'signature': {
      // Typing has moved on since the question was asked, but whoever asked it decides
      // whether the answer is still worth anything; here it is only handed back.
      const waiting = awaitingHints.get(message.hintId);
      awaitingHints.delete(message.hintId);
      waiting?.settle(message);
      return;
    }

    case 'ran':
      if (awaitingRun && awaitingRun.runId === message.runId) {
        const { resolve } = awaitingRun;
        awaitingRun = null;
        resolve(message.outcome);
      }
      return;
  }
};

const post = (message: HostMessage): void => {
  transport?.send(message);
};

/** Where this session wants its Python, and how a local one is reached. */
export const runtimeKind = (): RuntimeKind =>
  localStorage.getItem(RUNTIME_KIND_KEY) === 'local' ? 'local' : 'browser';

export const localAddress = (): string => localStorage.getItem(LOCAL_ADDRESS_KEY) ?? '';

/**
 * Chooses where Python runs from here on. The interpreter in use is discarded, since
 * the choice is what an interpreter *is*; the next submission starts one in the new
 * place.
 */
export const setRuntime = (kind: RuntimeKind, address?: string): void => {
  localStorage.setItem(RUNTIME_KIND_KEY, kind);
  if (address !== undefined) localStorage.setItem(LOCAL_ADDRESS_KEY, address);
  void stopPython();
  store().setStatus('off', '');
};

/**
 * Brings the interpreter up, once, and resolves when it is ready to be typed at rather
 * than when it has been asked to start — the first submission is made by someone who
 * has just pressed Enter and would otherwise be told there is no interpreter.
 *
 * Concurrent callers share the same attempt, and a failed one is remembered so the
 * console does not try again on every keystroke; {@link restartPython} is the retry.
 */
export const startPython = (): Promise<void> => {
  if (booting) return booting;

  const solver = activeSolver();
  const kind = runtimeKind();
  bootedFor = solver.id;
  bootedOn = kind;

  booting = new Promise<void>((resolve) => {
    bootSettled = resolve;

    if (kind === 'local' && localAddress().length === 0) {
      store().setStatus('failed', 'no address for a local interpreter');
      store().append(
        'error',
        'No address set for a local interpreter. Start one with ' +
          '`python src/python/console_server.py` and paste the address it prints.'
      );
      settleBoot();
      return;
    }

    store().setStatus('starting', kind === 'local' ? 'connecting' : 'fetching the interpreter');
    transport =
      kind === 'local' ? localTransport(localAddress(), onMessage) : browserTransport(onMessage);

    post({
      kind: 'boot',
      indexURL: PYODIDE_INDEX_URL,
      wheels: solver.wheels,
      adapter: solver.adapter,
      handle: solver.handle,
      example: solver.example,
    });
  });

  return booting;
};

/**
 * Runs one submission and returns what the interpreter made of it.
 *
 * The canvas is read here rather than in the worker, and sent along with the line: what
 * `nemo.case()` returns is therefore the canvas as it stood when the line was entered,
 * whatever it is edited into while the line runs.
 */
export const runPython = async (
  source: string,
  sink: OutputSink,
  mode: 'line' | 'block' = 'line'
): Promise<RunOutcome> => {
  // An interpreter carries the solver it was started with — its packages are installed,
  // not chosen per call — so one belonging to something else is no use. A model switch
  // discards it outright (see `startFresh`), which leaves the runtime pick: choosing
  // where Python runs is a change of interpreter, and the check is kept general so it
  // stays true of any other way the two could come apart.
  if (booting && (bootedFor !== activeSolver().id || bootedOn !== runtimeKind())) {
    store().append('note', 'Starting an interpreter for what is selected now.');
    await restartPython();
  }
  await startPython();
  if (store().status === 'failed') {
    sink({
      output_type: 'error',
      ename: 'RuntimeError',
      evalue: 'the interpreter is not running; use Restart to try again',
      traceback: ['the interpreter is not running; use Restart to try again'],
    });
    return { status: 'failed' };
  }

  const runId = ++runCounter;
  const caseJson = JSON.stringify(useGraphStore.getState().captureCase());

  store().setStatus('busy');
  const outcome = await new Promise<RunOutcome>((resolve) => {
    awaitingRun = { runId, sink, resolve };
    post({ kind: 'run', runId, source, caseJson, mode });
  });
  store().setStatus(store().status === 'failed' ? 'failed' : 'ready');
  return outcome;
};

/**
 * Whether a question about half-written code can be answered at all.
 *
 * Only a running interpreter can say what a name means, and only an idle one can say it
 * now: a question put while a solve is running would be answered when the solve ends,
 * which is minutes too late to be about what is on the screen. Neither case is worth
 * starting an interpreter for — someone typing has not asked for one.
 */
const canAnswerHints = (): boolean => booting !== null && store().status === 'ready';

/**
 * Puts one question about what is being typed, and resolves with the answer.
 *
 * Unanswerable questions resolve with `fallback` rather than rejecting, so a caller can
 * treat "no interpreter" and "nothing to offer" as the same thing, which for a list of
 * suggestions they are.
 */
const askHint = <T>(kind: 'complete' | 'signature', source: string, fallback: T): Promise<T> => {
  if (!canAnswerHints()) return Promise.resolve(fallback);
  const hintId = ++hintCounter;
  return new Promise<T>((resolve) => {
    awaitingHints.set(hintId, { settle: resolve as (answer: unknown) => void, fallback });
    post({ kind, hintId, source });
  });
};

/**
 * What could finish the word at the end of `source`, and where in it the answers start.
 *
 * The names come from the objects the session is holding, so they are the solver's own
 * and follow whatever model is on the canvas. Nothing being typed is run to find them.
 */
export const askForCompletions = async (
  source: string
): Promise<{ items: Completion[]; from: number }> => {
  const answer = await askHint<{ items: Completion[]; from: number }>('complete', source, {
    items: [],
    from: source.length,
  });
  return { items: answer.items ?? [], from: answer.from ?? source.length };
};

/** What the call being written takes, or null where the caret is in no call. */
export const askForSignature = async (source: string): Promise<SignatureHint | null> => {
  const answer = await askHint<{ hint: SignatureHint | null }>('signature', source, { hint: null });
  return answer.hint ?? null;
};

/**
 * Asks what names the session is holding. The answer arrives as a message and lands in
 * the store, so this returns nothing.
 */
export const askForVariables = (): void => {
  if (booting) post({ kind: 'workspace' });
  else store().setVariables([]);
};

/**
 * Forgets them all.
 *
 * Not a restart: the interpreter, its imported modules and the time spent starting it
 * all stay, and only the names go. Restart is the heavier one, and is what stops
 * something still running.
 */
export const clearVariables = (): void => {
  if (!booting) return;
  post({ kind: 'clear-workspace' });
  store().append('note', 'The names defined here were forgotten; the interpreter is still up.');
};

/** Abandons a half-typed block, leaving the interpreter and its names alone. */
export const resetPythonBlock = (): void => {
  post({ kind: 'reset' });
  store().setPending([]);
};

/** Drops the interpreter and everything waiting on it, without starting another. */
const stopPython = (): void => {
  transport?.stop();
  transport = null;
  booting = null;
  bootSettled = null;
  bootedFor = null;
  bootedOn = null;
  if (awaitingRun) {
    awaitingRun.resolve({ status: 'failed' });
    awaitingRun = null;
  }
  for (const { settle, fallback } of awaitingHints.values()) settle(fallback);
  awaitingHints.clear();
  store().setPending([]);
  store().setVariables([]);
};

/**
 * Puts the console back to how it starts: no interpreter, and nothing said yet.
 *
 * An interpreter belongs to the model it was started for — its packages are installed,
 * not chosen per call — so when the canvas changes to something else it is not stale,
 * it is wrong. Dropping it here rather than at the next submission also keeps the status
 * line honest: it would otherwise go on naming a solver that is no longer on the canvas.
 */
export const discardPython = (): void => {
  stopPython();
  store().reset();
  store().setStatus('off', '');
};

/**
 * Stops the interpreter and starts a fresh one.
 *
 * This is also how a run is stopped. An interpreter that is inside a solve cannot be
 * asked to stop and answer — in the browser that needs memory shared with this thread,
 * which is only granted a page served with headers a static host cannot set. So it is
 * discarded instead, and with it every name defined in the session.
 */
export const restartPython = async (): Promise<void> => {
  stopPython();
  store().append('note', 'The interpreter was restarted; names defined here are gone.');
  await startPython();
};
