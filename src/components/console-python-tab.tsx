import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IoPlayOutline, IoRefreshOutline, IoTrashOutline } from 'react-icons/io5';
import {
  localAddress,
  resetPythonBlock,
  restartPython,
  runPython,
  runtimeKind,
  setRuntime,
} from '../python/python-runtime';
import type { RuntimeKind } from '../python/transport';
import { usePythonStore } from '../store/pythonStore';
import { solverExampleLines, useModelReady, useSolverExample } from '../python/example';
import { joinLines, type CellOutput, type MultilineString } from '../types/notebook';
import {
  PYTHON_CONTINUATION_PROMPT,
  PYTHON_PROMPT,
  type PythonEntry,
  type PythonStatus,
} from '../types/python';

/** What the status line reads while the interpreter is in each state. */
const STATUS_LABEL: Record<PythonStatus, string> = {
  off: 'not started',
  starting: 'starting',
  ready: 'ready',
  busy: 'running',
  failed: 'stopped',
};

/**
 * The first thing the pane says. It names the calls worth knowing, since everything
 * else is reachable from what they return, and `help(nemo)` documents the rest.
 */
const OPENING = [
  'Python, with the drawn network in reach. Enter runs a line; help(nemo) lists the rest.',
  'Something to start from:',
];

/**
 * Writes one output into the transcript, as a line of text.
 *
 * The prompt is a transcript of lines and shows what it can of an output: printed text,
 * a traceback, and the plain-text form of a value. A figure has one too — it just says
 * `Figure(...)`, which is the honest thing for a surface that cannot draw. The Results
 * tab keeps the whole output and draws it.
 */
const transcribe = (output: CellOutput): void => {
  const store = usePythonStore.getState();
  if (output.output_type === 'stream') {
    store.appendStream(output.name === 'stderr' ? 'error' : 'output', joinLines(output.text));
    return;
  }
  if (output.output_type === 'error') {
    store.append('error', output.traceback.join('\n').trimEnd());
    return;
  }
  const text = joinLines(output.data['text/plain'] as MultilineString | undefined);
  if (text.length > 0) store.append('value', text);
};

/**
 * Grows the prompt to fit what is in it, so a pasted block is seen as a block rather
 * than through a one-line window.
 *
 * A measurement is only taken when the prompt is on screen. Both tabs stay mounted, so
 * this runs on a prompt that has no layout at all whenever the other tab is showing,
 * and a height set from that measurement is zero — which does not correct itself,
 * because nothing measures again until the next keystroke, which cannot be typed into
 * something of no height.
 */
export const fitToContent = (input: HTMLTextAreaElement | null): void => {
  if (!input) return;
  input.style.height = 'auto';
  if (input.scrollHeight > 0) input.style.height = `${input.scrollHeight}px`;
};

/** The marker a transcript line is shown behind, where it has one. */
const LINE_PROMPT: Partial<Record<PythonEntry['kind'], string>> = {
  input: PYTHON_PROMPT,
  continuation: PYTHON_CONTINUATION_PROMPT,
};

const TranscriptLine = React.memo(({ entry }: { entry: PythonEntry }) => (
  <div className={`python-line ${entry.kind}`}>
    {LINE_PROMPT[entry.kind] && (
      <span className="python-line-prompt">{LINE_PROMPT[entry.kind]}</span>
    )}
    <span className="python-line-text">{entry.text}</span>
  </div>
));

TranscriptLine.displayName = 'TranscriptLine';

/**
 * Where Python runs, and — for a local interpreter — the address it was started at.
 *
 * The choice is the session's rather than the document's, so it lives beside the app
 * and not in the case file: which machine is running what is not a property of the
 * network someone drew.
 */
const RuntimePicker = React.memo(() => {
  const [kind, setKind] = useState<RuntimeKind>(() => runtimeKind());
  const [address, setAddress] = useState(() => localAddress());

  const choose = (next: RuntimeKind) => {
    setKind(next);
    setRuntime(next, address);
  };

  return (
    <div className="python-runtime">
      <label className="python-runtime-label" htmlFor="python-runtime-select">
        run in
      </label>
      <select
        id="python-runtime-select"
        className="python-runtime-select"
        value={kind}
        onChange={(event) => choose(event.target.value as RuntimeKind)}
        title="Where the console's Python runs. Either way the prompt is the same."
      >
        <option value="browser">the browser</option>
        <option value="local">this machine</option>
      </select>
      {kind === 'local' && (
        <input
          className="python-runtime-address"
          value={address}
          spellCheck={false}
          placeholder="http://127.0.0.1:8765/?token=…"
          aria-label="Address of the local interpreter"
          title="The address console_server.py prints when it starts"
          onChange={(event) => setAddress(event.target.value)}
          onBlur={() => setRuntime('local', address)}
        />
      )}
    </div>
  );
});

RuntimePicker.displayName = 'RuntimePicker';

const ConsolePythonTab = React.memo(() => {
  const entries = usePythonStore((s) => s.entries);
  const history = usePythonStore((s) => s.history);
  const pending = usePythonStore((s) => s.pending);
  const status = usePythonStore((s) => s.status);
  const detail = usePythonStore((s) => s.detail);
  const clear = usePythonStore((s) => s.clear);

  const example = useSolverExample();
  const modelReady = useModelReady();

  const [draft, setDraft] = useState('');
  /** How far back the up-arrow has walked; `history.length` means "at the new line". */
  const [recallAt, setRecallAt] = useState(history.length);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The opening message is written into the transcript rather than rendered above it,
  // so clearing the pane clears it too and the first line the user sees is their own.
  useEffect(() => {
    // Waits for the model, since the example is the model's and a model is fetched. A
    // transcript that already has something in it is left alone, so this happens once.
    if (!modelReady) return;
    const store = usePythonStore.getState();
    if (store.entries.length !== 0) return;
    OPENING.forEach((line) => store.append('note', line));
    // Shown as code but not as something entered: nothing has run it. The lines go into
    // the recall list so the up arrow offers them rather than making them be retyped.
    solverExampleLines(example).forEach((line) => {
      store.append('example', line);
      store.remember(line);
    });
    // The recall walks back from the end, and the end has just moved.
    setRecallAt(usePythonStore.getState().history.length);
  }, [modelReady, example]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [entries, pending]);

  useEffect(() => fitToContent(inputRef.current), [draft]);

  const submit = useCallback(async () => {
    const source = draft;
    const store = usePythonStore.getState();
    // One submission at a time: the interpreter answers in order, and a second line
    // sent while the first is still running would be waiting on the wrong answer.
    if (store.status === 'busy') return;
    if (source.trim().length === 0 && pending.length === 0) return;

    const openBlock = pending.length > 0;
    source
      .split('\n')
      .forEach((line, i) => store.append(openBlock || i > 0 ? 'continuation' : 'input', line));
    store.remember(source);
    setDraft('');
    setRecallAt(usePythonStore.getState().history.length);

    // Only what was just typed is sent: the interpreter is holding the rest of an open
    // block itself, and re-sending those lines would run them twice.
    const outcome = await runPython(source, transcribe);
    store.setPending(outcome.status === 'incomplete' ? [...pending, source] : []);
  }, [draft, pending]);

  /** Walks the recall list, keeping the caret free to move inside a multi-line draft. */
  const recall = useCallback(
    (delta: number): boolean => {
      if (history.length === 0) return false;
      const next = Math.max(0, Math.min(history.length, recallAt + delta));
      if (next === recallAt) return false;
      setRecallAt(next);
      setDraft(next === history.length ? '' : history[next]);
      return true;
    },
    [history, recallAt]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const input = event.currentTarget;
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        void submit();
        return;
      }
      if (event.key === 'Escape' && pending.length > 0) {
        event.preventDefault();
        resetPythonBlock();
        setDraft('');
        return;
      }
      // The arrows walk the recall list only from the edges of the draft, so they still
      // move the caret through a block that was pasted in or written with Shift+Enter.
      if (event.key === 'ArrowUp' && input.selectionStart === 0 && recall(-1)) {
        event.preventDefault();
      }
      if (event.key === 'ArrowDown' && input.selectionStart === input.value.length && recall(1)) {
        event.preventDefault();
      }
    },
    [pending, recall, submit]
  );

  const busy = status === 'busy' || status === 'starting';
  const prompt = pending.length > 0 ? PYTHON_CONTINUATION_PROMPT : PYTHON_PROMPT;

  return (
    <div className="console-python-tab">
      <div className="console-python-toolbar">
        <span className={`python-status ${status}`}>
          {STATUS_LABEL[status]}
          {detail && <span className="python-status-detail">{detail}</span>}
        </span>
        <div className="console-python-actions">
          <RuntimePicker />
          <button
            type="button"
            className="console-logs-clear"
            onClick={() => void restartPython()}
            aria-label="Restart the interpreter"
            title="Stop whatever is running and start a fresh interpreter"
          >
            <IoRefreshOutline aria-hidden />
            <span>Restart</span>
          </button>
          <button
            type="button"
            className="console-logs-clear"
            onClick={clear}
            disabled={entries.length === 0}
            aria-label="Clear the transcript"
          >
            <IoTrashOutline aria-hidden />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="console-python-transcript" ref={transcriptRef} role="log" aria-live="polite">
        {entries.map((entry) => (
          <TranscriptLine key={entry.id} entry={entry} />
        ))}
      </div>

      <div className="console-python-prompt">
        <span className="python-line-prompt">{prompt}</span>
        <textarea
          ref={inputRef}
          className="console-python-input"
          value={draft}
          rows={1}
          spellCheck={false}
          autoComplete="off"
          placeholder={busy ? '' : 'nemo.case()'}
          aria-label="Python prompt"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="console-python-run"
          onClick={() => void submit()}
          disabled={busy}
          aria-label="Run"
          title="Run (Enter). Shift+Enter adds a line."
        >
          <IoPlayOutline aria-hidden />
        </button>
      </div>
    </div>
  );
});

ConsolePythonTab.displayName = 'ConsolePythonTab';

export default ConsolePythonTab;
