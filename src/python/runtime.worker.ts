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
import type { CellOutput } from '../types/notebook';
import DISPLAY_SHIMS_SOURCE from './display-shims.py?raw';
import HINTS_MODULE_SOURCE from './hints.py?raw';
import NEMO_MODULE_SOURCE from './nemo-module.py?raw';
import SESSION_MODULE_SOURCE from './session.py?raw';
import type { HostMessage, RunOutcome, WorkerMessage } from './protocol';

/** Where the bridge module is written so `import nemo` finds it. */
const NEMO_MODULE_PATH = '/home/pyodide/nemo.py';

/** Where the display protocol is written; `nemo` and the prompt both reach it. */
const DISPLAY_MODULE_PATH = '/home/pyodide/_nemo_display.py';

/** Where the model's own adapter is written, for `nemo.network()` to call into. */
const SOLVER_MODULE_PATH = '/home/pyodide/_nemo_solver.py';

/** Where the session's own bookkeeping is written: what names it holds, and forgetting them. */
const SESSION_MODULE_PATH = '/home/pyodide/_nemo_session.py';

/** Where the completer is written: what could finish a name, and what a call takes. */
const HINTS_MODULE_PATH = '/home/pyodide/_nemo_hints.py';

/**
 * Set up before every submission and read by `nemo.case()`. Assigning the case here
 * rather than answering a request for it is what lets the Python side stay ordinary,
 * synchronous code: there is nothing to wait for, because it already arrived.
 */
const host = {
  caseJson: '{}',
  /**
   * The model's own words about itself, read by `nemo` when it fits itself to the model:
   * the second name it wants for `nemo.build()`, and a few lines worth running. Set once
   * at boot, since an interpreter belongs to one model.
   */
  handle: '',
  example: '',
  emit: (json: string): void => {
    post({ kind: 'bridge', call: JSON.parse(json) });
  },
  // Outputs arrive already in the shape a notebook file holds them, so nothing on the
  // way to the screen or to disk has to reshape them.
  display: (json: string): void => {
    post({ kind: 'display', runId: activeRun, output: JSON.parse(json) as CellOutput });
  },
};

let pyodide: PyodideInterface | null = null;
/** Pyodide's `PyodideConsole`, which holds the partially entered block between pushes. */
let pyconsole: any = null;
/** The display protocol, on the Python side: what turns a value into what is shown. */
let display: any = null;
/** `__main__`'s namespace, which the prompt and the notebook both work in. */
let mainNamespace: any = null;
/** What names the session holds, and forgetting them. */
let session: any = null;
/** What could finish what is being typed, and what the call it is inside takes. */
let hints: any = null;
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

const stream = (name: 'stdout' | 'stderr') => (text: string) => {
  post({ kind: 'display', runId: activeRun, output: { output_type: 'stream', name, text } });
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

const boot = async ({
  indexURL,
  wheels,
  adapter,
  handle,
  example,
}: Extract<HostMessage, { kind: 'boot' }>): Promise<void> => {
  post({ kind: 'booting', step: 'starting Python' });
  // Loaded from wherever the distribution is served rather than bundled, so the
  // interpreter and the packages it resolves always come from the same build.
  const { loadPyodide } = (await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)) as {
    loadPyodide: (options: { indexURL: string }) => Promise<PyodideInterface>;
  };
  const py = await loadPyodide({ indexURL });

  const packages = await installWheels(py, wheels);

  // Set before `nemo` is imported, since that is where they are read.
  host.handle = handle;
  host.example = example;
  py.registerJsModule('_nemo_host', host);
  py.FS.writeFile(NEMO_MODULE_PATH, NEMO_MODULE_SOURCE);
  py.FS.writeFile(DISPLAY_MODULE_PATH, DISPLAY_SHIMS_SOURCE);
  py.FS.writeFile(SESSION_MODULE_PATH, SESSION_MODULE_SOURCE);
  py.FS.writeFile(HINTS_MODULE_PATH, HINTS_MODULE_SOURCE);

  // Built inside a function so the names it needs are local to it. Run at the top level
  // this would work in __main__ -- which is the prompt's own namespace -- and leave
  // `sys`, `PyodideConsole` and the rest sitting among whatever the user goes on to
  // define, both in the way and listed as theirs.
  pyconsole = py.runPython(`
def _build_console():
    import __main__
    import _nemo_display
    import nemo
    from pyodide.console import PyodideConsole

    # The prompt works in __main__, so a name bound at the prompt is where a script would
    # expect to find it, and 'nemo' and 'display' are already there rather than waiting
    # to be imported -- as they are in a notebook.
    __main__.__dict__["nemo"] = nemo
    __main__.__dict__["display"] = _nemo_display.display
    return PyodideConsole(__main__.__dict__)

_build_console()
`);
  pyconsole.stdout_callback = stream('stdout');
  pyconsole.stderr_callback = stream('stderr');
  display = py.pyimport('_nemo_display');
  session = py.pyimport('_nemo_session');
  hints = py.pyimport('_nemo_hints');
  mainNamespace = py.runPython('import __main__; __main__.__dict__');

  const described = loadAdapter(py, adapter);

  // After the adapter, since what `nemo` fits itself with is partly the adapter's own
  // documentation. The fitting is all in the `nemo` module, so the two interpreters
  // cannot come to describe themselves differently.
  py.runPython('import nemo; nemo._bind_model()');

  pyodide = py;
  post({
    kind: 'ready',
    python: py.runPython('__import__("sys").version.split()[0]'),
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
const run = async (
  runId: number,
  source: string,
  caseJson: string,
  mode: 'line' | 'block'
): Promise<RunOutcome> => {
  host.caseJson = caseJson;
  activeRun = runId;

  if (mode === 'block') {
    // A whole cell, run and reported by the same Python the local interpreter uses, so
    // the two cannot drift on what a cell means.
    const status = await display.run_block(source, mainNamespace);
    return { status: status === 'failed' ? 'failed' : 'complete' };
  }

  let outcome: RunOutcome = { status: 'complete' };
  for (const line of source.split('\n')) {
    const future = pyconsole.push(line);
    const check = future.syntax_check;
    if (check === 'incomplete') {
      outcome = { status: 'incomplete' };
      continue;
    }
    if (check === 'syntax-error') {
      reportError(pythonError(null, future));
      pyconsole.buffer.clear();
      return { status: 'failed' };
    }
    try {
      // A copy is awaited rather than the future itself. Awaiting consumes what is
      // awaited, and the traceback has to be read off the future afterwards -- it is
      // only written when the line has finished, which is to say after the await.
      const value = await future.copy();
      if (value !== undefined) {
        // Asked for every representation it can offer, not just its repr: that is what
        // lets a figure be a figure here and still print as text anywhere else.
        display.result(value);
      }
      if (value && typeof (value as { destroy?: unknown }).destroy === 'function') {
        (value as { destroy: () => void }).destroy();
      }
      outcome = { status: 'complete' };
    } catch (error) {
      reportError(pythonError(error, future));
      pyconsole.buffer.clear();
      return { status: 'failed' };
    } finally {
      future.destroy();
    }
  }
  return outcome;
};

/**
 * Reports a failure as the output a notebook stores for one.
 *
 * The name and the message are split out of the formatted traceback rather than caught
 * separately, because that is the text the interpreter itself produced and the only one
 * guaranteed to say what actually happened.
 */
const reportError = (formatted: string): void => {
  const lines = formatted.split('\n');
  const last = lines[lines.length - 1] ?? '';
  const [ename, evalue] = last.includes(': ')
    ? [last.slice(0, last.indexOf(': ')), last.slice(last.indexOf(': ') + 2)]
    : [last, ''];
  post({
    kind: 'display',
    runId: activeRun,
    output: { output_type: 'error', ename, evalue, traceback: lines },
  });
};

/**
 * Answers a question about what is being typed.
 *
 * Nothing here starts an interpreter or waits for one: a question asked before Python is
 * up, or while it is inside a solve, is answered with nothing rather than held. Someone
 * typing would rather have no list than a pause.
 */
const answerHint = (message: HostMessage & { kind: 'complete' | 'signature' }): void => {
  if (message.kind === 'complete') {
    if (!hints) {
      post({ kind: 'completions', hintId: message.hintId, items: [], from: 0 });
      return;
    }
    const found = hints.completions(message.source, mainNamespace);
    const { items, from } = found.toJs({ dict_converter: Object.fromEntries });
    found.destroy();
    post({ kind: 'completions', hintId: message.hintId, items, from });
    return;
  }
  if (!hints) {
    post({ kind: 'signature', hintId: message.hintId, hint: null });
    return;
  }
  const found = hints.signature(message.source, mainNamespace);
  const hint = found ? found.toJs({ dict_converter: Object.fromEntries }) : null;
  found?.destroy();
  post({ kind: 'signature', hintId: message.hintId, hint });
};

self.onmessage = async (event: MessageEvent<HostMessage>) => {
  const message = event.data;
  if (message.kind === 'complete' || message.kind === 'signature') {
    try {
      answerHint(message);
    } catch {
      // A question about half-written code is allowed to have no answer, and saying so
      // is the whole of what a failure here means.
      if (message.kind === 'complete') {
        post({ kind: 'completions', hintId: message.hintId, items: [], from: 0 });
      } else {
        post({ kind: 'signature', hintId: message.hintId, hint: null });
      }
    }
    return;
  }
  if (message.kind === 'boot') {
    try {
      await boot(message);
    } catch (error) {
      post({ kind: 'boot-failed', error: errorText(error) });
    }
    return;
  }
  if (message.kind === 'reset') {
    pyconsole?.buffer.clear();
    return;
  }
  if (message.kind === 'workspace' || message.kind === 'clear-workspace') {
    if (!session) {
      post({ kind: 'workspace', variables: [] });
      return;
    }
    if (message.kind === 'clear-workspace') session.clear(mainNamespace);
    const listed = session.variables(mainNamespace);
    post({ kind: 'workspace', variables: listed.toJs({ dict_converter: Object.fromEntries }) });
    listed.destroy();
    return;
  }
  if (message.kind === 'run') {
    activeRun = message.runId;
    if (!pyodide) {
      reportError('RuntimeError: the interpreter is not running');
      post({ kind: 'ran', runId: message.runId, outcome: { status: 'failed' } });
      activeRun = -1;
      return;
    }
    try {
      post({
        kind: 'ran',
        runId: message.runId,
        outcome: await run(message.runId, message.source, message.caseJson, message.mode),
      });
    } catch (error) {
      reportError(errorText(error));
      post({ kind: 'ran', runId: message.runId, outcome: { status: 'failed' } });
    } finally {
      activeRun = -1;
    }
  }
};
