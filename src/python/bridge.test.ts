import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBridgeCall } from './bridge';
import { useConsoleStore } from '../store/consoleStore';
import { useDataStore } from '../store/dataStore';
import { useGraphStore } from '../store/graphStore';
import type { Node } from 'reactflow';

/** A canvas of `nodes` elements and `edges` connections, as far as the bridge reads it. */
const canvasOf = (nodes: number, edges: number) => {
  useGraphStore.setState({
    nodes: Array.from({ length: nodes }, (_, i) => ({
      id: `n${i}`,
      type: 'Duct',
      position: { x: 0, y: 0 },
      data: {},
    })) as Node[],
    edges: Array.from({ length: edges }, (_, i) => ({
      id: `e${i}`,
      source: 'n0',
      target: 'n1',
    })),
  });
};

const series = (name: string, values: number[], target: 'node' | 'edge' = 'edge') => ({
  name,
  items: [{ name, target, values }],
});

const lastMessage = () => {
  const entries = useConsoleStore.getState().entries;
  return entries[entries.length - 1]?.message ?? '';
};

describe('what Python is allowed to draw', () => {
  beforeEach(() => {
    useDataStore.setState({ datasets: [], loadCount: 0, pendingDatasets: null });
    useConsoleStore.getState().clear();
    canvasOf(3, 2);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('takes a result set that carries one value per element', () => {
    applyBridgeCall({ op: 'datasets', datasets: [series('Mass flow', [1, 2])] });
    const datasets = useDataStore.getState().datasets;
    expect(datasets).toHaveLength(1);
    expect(datasets[0].items[0].values).toEqual([1, 2]);
  });

  it('refuses one that does not, and says how it did not fit', () => {
    applyBridgeCall({ op: 'datasets', datasets: [series('Mass flow', [1, 2, 3])] });
    expect(useDataStore.getState().datasets).toHaveLength(0);
    expect(lastMessage()).toContain('3 edge values');
    expect(lastMessage()).toContain('the canvas has 2 edges');
  });

  it('counts node series against the elements, not the connections', () => {
    applyBridgeCall({ op: 'datasets', datasets: [series('Pressure', [1, 2, 3], 'node')] });
    expect(useDataStore.getState().datasets).toHaveLength(1);
  });

  it('keeps the result sets that fit when one of several does not', () => {
    applyBridgeCall({
      op: 'datasets',
      datasets: [series('Good', [1, 2]), series('Bad', [1]), series('Also good', [3, 4])],
    });
    expect(useDataStore.getState().datasets.map((d) => d.name)).toEqual(['Good', 'Also good']);
  });

  it('refuses something that is not a result set at all', () => {
    applyBridgeCall({ op: 'datasets', datasets: [{ nope: true }] });
    expect(useDataStore.getState().datasets).toHaveLength(0);
    expect(lastMessage()).toContain('not a result set');
  });

  it('refuses result sets that did not arrive as a list', () => {
    applyBridgeCall({ op: 'datasets', datasets: 'everything' as unknown as unknown[] });
    expect(useDataStore.getState().datasets).toHaveLength(0);
    expect(lastMessage()).toContain('not a list');
  });

  it('writes a log line at the level it was given', () => {
    applyBridgeCall({ op: 'log', level: 'warn', message: 'careful' });
    const entry = useConsoleStore.getState().entries.slice(-1)[0];
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('careful');
  });

  it('reports a case it cannot open rather than half-applying it', () => {
    applyBridgeCall({ op: 'case', doc: { model: { nodes: [] } } });
    expect(lastMessage()).toContain('Missing version information');
  });
});
