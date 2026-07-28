import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConsoleStore } from './consoleStore';
import { useDataStore } from './dataStore';
import { useGraphStore } from './graphStore';
import { useNotebookStore } from './notebookStore';
import { usePythonStore } from './pythonStore';
import { hasWorkInProgress, startFresh } from './start-fresh';

vi.mock('../python/python-runtime', () => ({
  // The interpreter itself needs a worker, which a test has no use for; what matters
  // here is that starting again puts the console back to nothing said yet.
  discardPython: () => {
    usePythonStore.getState().reset();
    usePythonStore.getState().setStatus('off', '');
  },
}));

/** A session with something in every surface a fresh start is supposed to clear. */
const fillEverything = (): void => {
  useDataStore.setState({
    datasets: [
      {
        id: 'd1',
        name: 'Run',
        includeInSave: true,
        items: [{ id: 'i1', name: 'Pressure', target: 'edge', values: [1, 2] }],
      },
    ] as never,
  });
  useNotebookStore.getState().setSource(useNotebookStore.getState().cells[0].id, 'net.solve()');
  usePythonStore.getState().append('input', 'net = nemo.network()');
  usePythonStore.getState().remember('net = nemo.network()');
  usePythonStore.getState().setVariables([{ name: 'net', type: 'Network', summary: '…' }] as never);
  usePythonStore.getState().setStatus('ready', 'nefes 0.1.0');
  useGraphStore.setState({ title: 'Some case' });
};

describe('startFresh', () => {
  beforeEach(() => {
    useGraphStore.getState().reset();
    useDataStore.getState().clearDatasets();
    useNotebookStore.getState().reset();
    usePythonStore.getState().reset();
    useConsoleStore.getState().setVerbosity('debug');
    useConsoleStore.getState().clear();
  });

  it('clears the results, the notebook and the console together', () => {
    fillEverything();
    startFresh();

    expect(useDataStore.getState().datasets).toHaveLength(0);
    expect(useNotebookStore.getState().cells.map((c) => c.source)).toEqual(['']);
    expect(usePythonStore.getState().entries).toHaveLength(0);
    expect(usePythonStore.getState().variables).toHaveLength(0);
    expect(usePythonStore.getState().status).toBe('off');
  });

  it('forgets the previous session lines, so the recall is not the old model’s', () => {
    fillEverything();
    startFresh();
    expect(usePythonStore.getState().history).toHaveLength(0);
  });

  it('leaves nothing running behind, having reset the cells from under it', () => {
    // The switch can land mid-run. A `running` that survived it would refuse every
    // Run afterwards, over cells that are no longer there.
    fillEverything();
    useNotebookStore.setState({ running: true, dragId: 'c-gone', dropSlot: 2 });
    startFresh();

    expect(useNotebookStore.getState().running).toBe(false);
    expect(useNotebookStore.getState().dragId).toBeNull();
    expect(useNotebookStore.getState().dropSlot).toBeNull();
  });

  it('takes the case title with the elements it named', () => {
    fillEverything();
    startFresh();
    expect(useGraphStore.getState().title).toBe('Untitled');
  });

  it('keeps the message log, which is the record of how the session got here', () => {
    useConsoleStore.getState().append('error', 'something went wrong before the switch');
    fillEverything();
    startFresh();
    expect(useConsoleStore.getState().entries.map((e) => e.message)).toEqual([
      'something went wrong before the switch',
    ]);
  });
});

describe('hasWorkInProgress', () => {
  beforeEach(() => {
    useGraphStore.getState().reset();
    useDataStore.getState().clearDatasets();
    useNotebookStore.getState().reset();
  });

  it('is false for a session nothing has been done in', () => {
    expect(hasWorkInProgress()).toBe(false);
  });

  it('counts a notebook cell with something written in it', () => {
    useNotebookStore.getState().setSource(useNotebookStore.getState().cells[0].id, 'x = 1');
    expect(hasWorkInProgress()).toBe(true);
  });

  it('does not count an untouched cell, which every notebook opens with', () => {
    useNotebookStore.getState().setSource(useNotebookStore.getState().cells[0].id, '   \n  ');
    expect(hasWorkInProgress()).toBe(false);
  });

  it('counts loaded results on their own, with nothing drawn', () => {
    useDataStore.setState({
      datasets: [{ id: 'd1', name: 'Run', includeInSave: true, items: [] }] as never,
    });
    expect(hasWorkInProgress()).toBe(true);
  });
});
