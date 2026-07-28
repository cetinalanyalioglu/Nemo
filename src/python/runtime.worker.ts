/// <reference lib="webworker" />

/**
 * The Python interpreter, off the main thread.
 *
 * A solve runs for as long as it runs, and on the main thread that is a frozen canvas,
 * so the interpreter lives here instead and speaks to the console through
 * {@link ./protocol}. It is Pyodide, fetched at boot; the wheels it is given are
 * installed on top of it.
 *
 * Submissions go through Pyodide's own interactive console rather than a bare `exec`,
 * which is what makes this a console and not a script runner: it knows when a block is
 * still open, echoes the value of a trailing expression, and formats a traceback with
 * the console's own frames stripped out.
 */

import type { PyodideInterface } from 'pyodide';
import NEMO_MODULE_SOURCE from './nemo-module.py?raw';
import type { HostMessage, RunOutcome, WorkerMessage } from './protocol';

/** Where the bridge module is written so `import nemo` finds it. */
const NEMO_MODULE_PATH = '/home/pyodide/nemo.py';

/** Where the model's own adapter is written, for `nemo.network()` to call into. */
const SOLVER_MODULE_PATH = '/home/pyodide/_nemo_solver.py';

/** Longest repr echoed back for a value; beyond this the middle is elided. */
const REPR_LIMIT = 4000;

/**
 * Set up before every submission and read by `nemo.case()`. Assigning the case here
 * rather than answering a request for it is what lets the Python side stay ordinary,
 * synchronous code: there is nothing to wait for, because it already arrived.
 */
const host = {
  caseJson: '{}',
  emit: (json: string): void => {
    post({ kind: 'bridge', call: JSON.parse(json) });
  },
};

let pyodide: PyodideInterface | null = null;
/** Pyodide's `PyodideConsole`, which holds the partially entered block between pushes. */
let pyconsole: any = null;
/** `repr` with a length cap, so one careless line cannot fill the pane. */
let reprShorten: ((value: unknown, limit: number) => string) | null = null;
/** The submission being run, so stream output can be attributed to it. */
let activeRun = -1;

const post = (message: WorkerMessage): void => {
  self.postMessage(message);
};

const errorText = (error: unknown): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
};

/** Reports a Python error with its traceback when there is one, its text otherwise. */
const pythonError = (error: unknown, future: any): string => {
  const formatted = future?.formatted_error;
  return typeof formatted === 'string' && formatted.length > 0
    ? formatted.trimEnd()
    : errorText(error);
};

const stream = (kind: 'out' | 'err') => (text: string) => {
  post({ kind: 'output', runId: activeRun, stream: kind, text });
};

/** Installs each wheel in order, reporting progress and naming what failed. */
const installWheels = async (py: PyodideInterface, wheels: string[]): Promise<string[]> => {
  if (wheels.length === 0) return [];
  post({ kind: 'booting', step: 'installing packages' });
  await py.loadPackage('micropip');
  const micropip = py.pyimport('micropip');
  const installed: string[] = [];
  for (const wheel of wheels) {
    const name = wheel.split('/').pop() ?? wheel;
    post({ kind: 'booting', step: `installing ${name}` });
    await micropip.install(wheel);
    installed.push(name);
  }
  micropip.destroy();
  return installed;
};

/**
 * Runs the model's adapter, and returns how it describes itself.
 *
 * The adapter is Python the model file carries: `nemo.network()` and `nemo.publish()`
 * are calls into it, and it is the only place any particular solver is named. It is run
 * as a module rather than into the prompt's namespace, so what it defines does not
 * shadow anything typed and the prompt stays a clean slate.
 *
 * An adapter that fails to run leaves the console working without it. Whatever it is
 * reaching for is not there, which is worth saying, but a prompt that reads the canvas
 * is still better than no prompt.
 */
const loadAdapter = (py: PyodideInterface, adapter: string): string[] => {
  if (!adapter.trim()) return [];
  py.FS.writeFile(SOLVER_MODULE_PATH, adapter);
  const described = py.runPython(`
def _load():
    import importlib, sys, traceback
    try:
        module = importlib.import_module("_nemo_solver")
    except Exception:
        sys.modules.pop("_nemo_solver", None)
        return ["the model's solver could not be loaded", traceback.format_exc().rstrip()]
    describe = getattr(module, "describe", None)
    if describe is None:
        return []
    try:
        return [str(describe())]
    except Exception:
        return ["the model's solver did not describe itself"]
_load()
`);
  const lines = described.toJs() as string[];
  described.destroy();
  return lines;
};

const boot = async (indexURL: string, wheels: string[], adapter: string): Promise<void> => {
  post({ kind: 'booting', step: 'starting Python' });
  // Loaded from wherever the distribution is served rather than bundled, so the
  // interpreter and the packages it resolves always come from the same build.
  const { loadPyodide } = (await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)) as {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>;
  };
  const py = await loadPyodide({ indexURL });

  const packages = await installWheels(py, wheels);

  py.registerJsModule('_nemo_host', host);
  py.FS.writeFile(NEMO_MODULE_PATH, NEMO_MODULE_SOURCE);

  pyconsole = py.runPython(`
import __main__
import nemo
from pyodide.console import PyodideConsole

# The prompt works in __main__, so a name bound at the prompt is where a script would
# expect to find it, and 'nemo' is already there rather than waiting to be imported.
__main__.__dict__["nemo"] = nemo
PyodideConsole(__main__.__dict__)
`);
  pyconsole.stdout_callback = stream('out');
  pyconsole.stderr_callback = stream('err');
  reprShorten = py.runPython('from pyodide.console import repr_shorten; repr_shorten');

  const described = loadAdapter(py, adapter);

  pyodide = py;
  post({
    kind: 'ready',
    python: py.runPython('import sys; ".".join(str(v) for v in sys.version_info[:3])'),
    // What the adapter says about itself when it says anything, and the package
    // filenames otherwise -- something has to name what was installed.
    packages: described.length > 0 ? described : packages,
  });
};

/**
 * Runs one submission, a line at a time.
 *
 * The interpreter is fed line by line because that is how it decides whether a block
 * has ended: a pasted function definition arrives as one submission but is several
 * pushes, of which only the last runs anything. The outcome reported is the last
 * line's, so a submission that ends mid-block is reported incomplete and the console
 * keeps the prompt open.
 */
const run = async (runId: number, source: string, caseJson: string): Promise<RunOutcome> => {
  host.caseJson = caseJson;
  activeRun = runId;

  let outcome: RunOutcome = { status: 'complete', repr: null };
  for (const line of source.split('\n')) {
    const future = pyconsole.push(line);
    const check = future.syntax_check;
    if (check === 'incomplete') {
      outcome = { status: 'incomplete' };
      continue;
    }
    if (check === 'syntax-error') {
      const error = pythonError(null, future);
      pyconsole.buffer.clear();
      return { status: 'failed', error };
    }
    try {
      // A copy is awaited rather than the future itself. Awaiting consumes what is
      // awaited, and the traceback has to be read off the future afterwards -- it is
      // only written when the line has finished, which is to say after the await.
      const value = await future.copy();
      outcome = {
        status: 'complete',
        repr: value === undefined ? null : reprShorten!(value, REPR_LIMIT),
      };
      if (value && typeof (value as { destroy?: unknown }).destroy === 'function') {
        (value as { destroy: () => void }).destroy();
      }
    } catch (error) {
      pyconsole.buffer.clear();
      return { status: 'failed', error: pythonError(error, future) };
    } finally {
      future.destroy();
    }
  }
  return outcome;
};

self.onmessage = async (event: MessageEvent<HostMessage>) => {
  const message = event.data;
  if (message.kind === 'boot') {
    try {
      await boot(message.indexURL, message.wheels, message.adapter);
    } catch (error) {
      post({ kind: 'boot-failed', error: errorText(error) });
    }
    return;
  }
  if (message.kind === 'reset') {
    pyconsole?.buffer.clear();
    return;
  }
  if (message.kind === 'run') {
    if (!pyodide) {
      post({
        kind: 'ran',
        runId: message.runId,
        outcome: { status: 'failed', error: 'the interpreter is not running' },
      });
      return;
    }
    try {
      post({
        kind: 'ran',
        runId: message.runId,
        outcome: await run(message.runId, message.source, message.caseJson),
      });
    } catch (error) {
      post({
        kind: 'ran',
        runId: message.runId,
        outcome: { status: 'failed', error: errorText(error) },
      });
    } finally {
      activeRun = -1;
    }
  }
};
