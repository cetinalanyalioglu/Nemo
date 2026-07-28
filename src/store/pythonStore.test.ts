import { beforeEach, describe, expect, it } from 'vitest';
import { usePythonStore } from './pythonStore';
import { PYTHON_MAX_ENTRIES, PYTHON_MAX_HISTORY } from '../types/python';

const reset = () =>
  usePythonStore.setState({ status: 'off', detail: '', entries: [], history: [], pending: [] });

describe('pythonStore transcript', () => {
  beforeEach(reset);

  it('merges stream output into the line it is continuing', () => {
    const store = usePythonStore.getState();
    store.appendStream('output', 'partial');
    store.appendStream('output', ' line\n');
    expect(usePythonStore.getState().entries.map((e) => e.text)).toEqual(['partial line\n']);
  });

  it('starts a new line once the last one ended', () => {
    const store = usePythonStore.getState();
    store.appendStream('output', 'first\n');
    store.appendStream('output', 'second');
    expect(usePythonStore.getState().entries.map((e) => e.text)).toEqual(['first\n', 'second']);
  });

  it('does not continue a line of a different kind', () => {
    const store = usePythonStore.getState();
    store.appendStream('output', 'printed');
    store.appendStream('error', 'raised');
    expect(usePythonStore.getState().entries.map((e) => e.kind)).toEqual(['output', 'error']);
  });

  it('drops the oldest lines once the transcript is full', () => {
    const store = usePythonStore.getState();
    for (let i = 0; i < PYTHON_MAX_ENTRIES + 10; i++) store.append('output', `line ${i}`);
    const entries = usePythonStore.getState().entries;
    expect(entries).toHaveLength(PYTHON_MAX_ENTRIES);
    expect(entries[0].text).toBe('line 10');
  });
});

describe('pythonStore recall', () => {
  beforeEach(reset);

  it('keeps what was submitted, oldest first', () => {
    const store = usePythonStore.getState();
    store.remember('first');
    store.remember('second');
    expect(usePythonStore.getState().history).toEqual(['first', 'second']);
  });

  it('does not record a line repeated straight after itself', () => {
    const store = usePythonStore.getState();
    store.remember('same');
    store.remember('same');
    expect(usePythonStore.getState().history).toEqual(['same']);
  });

  it('records the same line again when something came between', () => {
    const store = usePythonStore.getState();
    store.remember('same');
    store.remember('other');
    store.remember('same');
    expect(usePythonStore.getState().history).toEqual(['same', 'other', 'same']);
  });

  it('ignores blank submissions', () => {
    const store = usePythonStore.getState();
    store.remember('   ');
    expect(usePythonStore.getState().history).toEqual([]);
  });

  it('drops the oldest entries once the recall list is full', () => {
    const store = usePythonStore.getState();
    for (let i = 0; i < PYTHON_MAX_HISTORY + 5; i++) store.remember(`line ${i}`);
    const history = usePythonStore.getState().history;
    expect(history).toHaveLength(PYTHON_MAX_HISTORY);
    expect(history[0]).toBe('line 5');
  });
});

describe('pythonStore clearing', () => {
  beforeEach(reset);

  it('drops the transcript and any half-typed block, but keeps the recall list', () => {
    const store = usePythonStore.getState();
    store.append('output', 'something');
    store.remember('def f():');
    store.setPending(['def f():']);

    store.clear();

    const state = usePythonStore.getState();
    expect(state.entries).toEqual([]);
    expect(state.pending).toEqual([]);
    expect(state.history).toEqual(['def f():']);
  });
});
