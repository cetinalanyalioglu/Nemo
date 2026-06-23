import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDataStore } from './dataStore';
import { useConsoleStore } from './consoleStore';
import type { ConsoleLogEntry } from '../types/console';

/** Resolves once the console pane contains an entry matching the predicate. */
const waitForEntry = (
  predicate: (entry: ConsoleLogEntry) => boolean,
  timeoutMs = 2000
): Promise<ConsoleLogEntry> =>
  new Promise((resolve, reject) => {
    const find = () => useConsoleStore.getState().entries.find(predicate);
    const existing = find();
    if (existing) {
      resolve(existing);
      return;
    }
    const timer = setTimeout(() => {
      unsubscribe();
      reject(new Error('Timed out waiting for a matching console entry'));
    }, timeoutMs);
    const unsubscribe = useConsoleStore.subscribe(() => {
      const match = find();
      if (match) {
        clearTimeout(timer);
        unsubscribe();
        resolve(match);
      }
    });
  });

const dataFile = (contents: string, name = 'data.json'): File =>
  new File([contents], name, { type: 'application/json' });

describe('dataStore logging', () => {
  beforeEach(() => {
    useDataStore.setState({ datasets: [], loadCount: 0, pendingDatasets: null });
    useConsoleStore.getState().clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  it('logs an info entry when importing datasets from a saved case', () => {
    useDataStore.getState().loadDatasetsFromObject([
      {
        id: 'ds-1',
        name: 'Case data',
        includeInSave: true,
        items: [{ id: 'i-1', name: 'p', target: 'node', values: [1, 2, 3] }],
      },
    ]);
    const entry = useConsoleStore.getState().entries.at(-1);
    expect(entry).toMatchObject({ level: 'info' });
    expect(entry?.message).toContain('Imported 1 dataset');
  });

  it('retains dataset description and self-describing info on import', () => {
    useDataStore.getState().loadDatasetsFromObject([
      {
        id: 'ds-1',
        name: '100 Hz',
        includeInSave: true,
        description: 'Forced acoustic response snapshot',
        info: [
          { key: 'kind', label: 'Analysis', value: 'Forced response' },
          { key: 'frequency', label: 'Frequency', value: 100, unit: 'Hz' },
        ],
        items: [{ id: 'i-1', name: 'p', target: 'edge', values: [1, 2] }],
      },
    ]);
    const ds = useDataStore.getState().datasets.at(-1);
    expect(ds?.description).toBe('Forced acoustic response snapshot');
    expect(ds?.info).toEqual([
      { key: 'kind', label: 'Analysis', value: 'Forced response' },
      { key: 'frequency', label: 'Frequency', value: 100, unit: 'Hz' },
    ]);
  });

  it('logs a success entry when a data file loads', async () => {
    const payload = JSON.stringify({
      name: 'Loaded',
      items: [
        { name: 'flux', target: 'edge', values: [4, 5] },
        { name: 'temp', target: 'node', values: [1, 2, 3] },
      ],
    });
    useDataStore.getState().loadDatasetsFromFile(dataFile(payload));
    const entry = await waitForEntry((e) => e.level === 'success');
    expect(entry.message).toContain('Loaded dataset "Loaded"');
    expect(entry.message).toContain('2 items');
  });

  it('logs an error entry when a data file is invalid JSON', async () => {
    useDataStore.getState().loadDatasetsFromFile(dataFile('{ not json'));
    const entry = await waitForEntry((e) => e.level === 'error');
    expect(entry.message).toContain('Failed to load data file "data.json"');
  });
});

describe('dataStore per-target display ranges', () => {
  const defaultDisplay = {
    itemId: null,
    colormap: 'viridis' as const,
    min: 0,
    max: 1,
    auto: true,
    showContour: true,
    showValues: false,
    precision: 2,
    notation: 'fixed' as const,
  };

  /** Looks up the generated id of an item by dataset + item name. */
  const itemId = (datasetName: string, name: string): string => {
    const ds = useDataStore.getState().datasets.find((d) => d.name === datasetName);
    const item = ds?.items.find((i) => i.name === name);
    if (!item) throw new Error(`item ${datasetName}/${name} not found`);
    return item.id;
  };

  beforeEach(() => {
    useDataStore.setState({
      datasets: [],
      loadCount: 0,
      pendingDatasets: null,
      nodeDisplay: { ...defaultDisplay },
      edgeDisplay: { ...defaultDisplay },
    });
    // Node values span 10..30, edge values span 100..200: deliberately disjoint
    // so a leak from one target's range into the other is unmistakable.
    useDataStore.getState().loadDatasetsFromObject([
      {
        id: 'ds-1',
        name: 'Results',
        includeInSave: true,
        items: [
          { id: 'n-1', name: 'nodeVar', target: 'node', values: [10, 20, 30] },
          { id: 'e-1', name: 'edgeVar', target: 'edge', values: [100, 200] },
        ],
      },
    ]);
  });

  it('auto-computes a node range from the node item without touching the edge display', () => {
    useDataStore.getState().setDisplayItem('node', itemId('Results', 'nodeVar'));
    const { nodeDisplay, edgeDisplay } = useDataStore.getState();
    expect(nodeDisplay).toMatchObject({ min: 10, max: 30 });
    // Edge display stays at its defaults — node selection must not affect it.
    expect(edgeDisplay).toMatchObject({ min: 0, max: 1, itemId: null });
  });

  it('keeps node and edge ranges independent when both targets have a selection', () => {
    useDataStore.getState().setDisplayItem('node', itemId('Results', 'nodeVar'));
    useDataStore.getState().setDisplayItem('edge', itemId('Results', 'edgeVar'));
    const { nodeDisplay, edgeDisplay } = useDataStore.getState();
    expect(nodeDisplay).toMatchObject({ min: 10, max: 30 });
    expect(edgeDisplay).toMatchObject({ min: 100, max: 200 });
  });

  it('setRange on one target leaves the other target untouched', () => {
    useDataStore.getState().setDisplayItem('node', itemId('Results', 'nodeVar'));
    useDataStore.getState().setDisplayItem('edge', itemId('Results', 'edgeVar'));
    useDataStore.getState().setRange('node', 5, 50);
    const { nodeDisplay, edgeDisplay } = useDataStore.getState();
    expect(nodeDisplay).toMatchObject({ min: 5, max: 50, auto: false });
    expect(edgeDisplay).toMatchObject({ min: 100, max: 200, auto: true });
  });

  it('re-enabling auto range recomputes from that target only', () => {
    useDataStore.getState().setDisplayItem('edge', itemId('Results', 'edgeVar'));
    useDataStore.getState().setRange('edge', 0, 1); // manual override
    expect(useDataStore.getState().edgeDisplay).toMatchObject({ min: 0, max: 1, auto: false });
    useDataStore.getState().setAutoRange('edge', true);
    expect(useDataStore.getState().edgeDisplay).toMatchObject({ min: 100, max: 200, auto: true });
    // Node display, never selected, remains at defaults throughout.
    expect(useDataStore.getState().nodeDisplay).toMatchObject({ min: 0, max: 1, itemId: null });
  });
});
