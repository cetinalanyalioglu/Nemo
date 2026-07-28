/**
 * The console's half of the boundary: starting the interpreter, feeding it lines, and
 * handing what comes back to the transcript, the canvas, or the message log.
 *
 * There is one interpreter per session and it outlives the pane, so this is a module
 * with state rather than a hook. It starts on the first submission rather than at load,
 * because starting it means fetching some tens of megabytes and most sessions never
 * open the console at all.
 */

import { useGraphStore } from '../store/graphStore';
import { usePythonStore } from '../store/pythonStore';
import { logger } from '../utils/logger';
import { applyBridgeCall } from './bridge';
import type { HostMessage, RunOutcome, WorkerMessage } from './protocol';

/**
 * Which Pyodide build to fetch. Kept in step with the `pyodide` dependency, whose types
 * this is checked against; `python-runtime.test.ts` fails if the two drift apart.
 */
export const PYODIDE_VERSION = '314.0.3';

/** Where that build is served from. The distribution is far too large to bundle. */
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

/** Lists the wheels installed on top of the base interpreter, relative to itself. */
const WHEEL_MANIFEST = 'wheels/manifest.json';

interface WheelManifest {
  wheels?: string[];
}

let worker: Worker | null = null;
let runCounter = 0;
/** Resolves when the submission with this id reports back. */
let awaitingRun: { runId: number; resolve: (outcome: RunOutcome) => void } | null = null;
/** Settles when boot finishes, either way; shared by every caller that waits on it. */
let booting: Promise<void> | null = null;
let bootSettled: (() => void) | null = null;

const store = () => usePythonStore.getState();

/** The wheels to install, as absolute URLs. An absent manifest means none. */
const readWheelManifest = async (): Promise<string[]> => {
  const base = new URL(WHEEL_MANIFEST, new URL(import.meta.env.BASE_URL, window.location.href));
  const response = await fetch(base.href);
  if (!response.ok) return [];
  const manifest = (await response.json()) as WheelManifest;
  return (manifest.wheels ?? []).map((wheel) => new URL(wheel, base).href);
};

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

    case 'output':
      store().appendStream(message.stream === 'err' ? 'error' : 'output', message.text);
      return;

    case 'bridge':
      applyBridgeCall(message.call);
      return;

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
  worker?.postMessage(message);
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

  booting = new Promise<void>((resolve) => {
    bootSettled = resolve;

    store().setStatus('starting', 'fetching the interpreter');
    worker = new Worker(new URL('./runtime.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerMessage>) => onMessage(event.data);
    worker.onerror = (event) => {
      store().setStatus('failed', 'the interpreter stopped');
      store().append('error', event.message || 'the interpreter stopped unexpectedly');
      settleBoot();
    };

    void (async () => {
      let wheels: string[] = [];
      try {
        wheels = await readWheelManifest();
      } catch {
        // No manifest is a console without Nefes, not a console that cannot start.
        wheels = [];
      }
      post({ kind: 'boot', indexURL: PYODIDE_INDEX_URL, wheels });
    })();
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
export const runPython = async (source: string): Promise<RunOutcome> => {
  await startPython();
  if (store().status === 'failed') {
    return { status: 'failed', error: 'the interpreter is not running; use Restart to try again' };
  }

  const runId = ++runCounter;
  const caseJson = JSON.stringify(useGraphStore.getState().captureCase());

  store().setStatus('busy');
  const outcome = await new Promise<RunOutcome>((resolve) => {
    awaitingRun = { runId, resolve };
    post({ kind: 'run', runId, source, caseJson });
  });
  store().setStatus(store().status === 'failed' ? 'failed' : 'ready');
  return outcome;
};

/** Abandons a half-typed block, leaving the interpreter and its names alone. */
export const resetPythonBlock = (): void => {
  post({ kind: 'reset' });
  store().setPending([]);
};

/**
 * Stops the interpreter and starts a fresh one.
 *
 * This is also how a run is stopped. A worker that is inside a solve cannot be asked to
 * stop and answer — interrupting it needs memory shared with this thread, which the
 * browser only grants a page served with headers a static host cannot set. So the
 * interpreter is discarded instead, and with it every name defined in the session.
 */
export const restartPython = async (): Promise<void> => {
  worker?.terminate();
  worker = null;
  booting = null;
  if (awaitingRun) {
    awaitingRun.resolve({ status: 'failed', error: 'the interpreter was restarted' });
    awaitingRun = null;
  }
  bootSettled = null;
  store().setPending([]);
  store().append('note', 'The interpreter was restarted; names defined here are gone.');
  await startPython();
};
