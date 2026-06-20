import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useGraphStore } from './graphStore';
import { useConsoleStore } from './consoleStore';
import type { ConsoleLogEntry } from '../types/console';
import type { RuntimeModel } from '../models/model-builder';

/** Returns the most recent console-pane entry, or undefined when empty. */
const lastEntry = (): ConsoleLogEntry | undefined => {
  const { entries } = useConsoleStore.getState();
  return entries[entries.length - 1];
};

describe('graphStore logging', () => {
  beforeEach(() => {
    // Start each case from a clean canvas, history, and console.
    useGraphStore.setState({
      nodes: [],
      edges: [],
      nodeStates: {},
      edgeStates: {},
      editingStates: {},
      model: null,
      locked: false,
      past: [],
      future: [],
    });
    useConsoleStore.getState().clear();
    // logger.error/.warn mirror to the browser console; silence the noise.
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('addNode', () => {
    it('logs an error and bails when no type is given', () => {
      const result = useGraphStore.getState().addNode({ type: '' });
      expect(result).toBeUndefined();
      expect(lastEntry()).toMatchObject({
        level: 'error',
        message: 'Cannot add node: node type is required.',
      });
    });

    it('logs an error when the type is unknown to the active model', () => {
      const result = useGraphStore.getState().addNode({ type: 'ghost' });
      expect(result).toBeUndefined();
      expect(lastEntry()?.level).toBe('error');
      expect(lastEntry()?.message).toContain('element info not found for type "ghost"');
    });
  });

  describe('deleteNode', () => {
    it('logs an error when no id is provided', () => {
      useGraphStore.getState().deleteNode('');
      expect(lastEntry()).toMatchObject({
        level: 'error',
        message: 'Cannot delete node: no node id provided.',
      });
    });

    it('logs an error when the node does not exist', () => {
      useGraphStore.getState().deleteNode('does-not-exist');
      expect(lastEntry()?.level).toBe('error');
      expect(lastEntry()?.message).toContain('node not found for id does-not-exist');
    });
  });

  describe('updateNodeParameter', () => {
    it('logs an error and returns false for a missing node', () => {
      const ok = useGraphStore.getState().updateNodeParameter('nope', 'label', 'x');
      expect(ok).toBe(false);
      expect(lastEntry()?.level).toBe('error');
      expect(lastEntry()?.message).toContain('node nope not found');
    });
  });

  describe('addCustomEdge', () => {
    it('logs an error when no edge template is available', () => {
      useGraphStore.getState().addCustomEdge({
        source: 'a',
        target: 'b',
        sourceHandle: 'a-port-0',
        targetHandle: 'b-port-0',
      });
      expect(lastEntry()?.level).toBe('error');
      expect(lastEntry()?.message).toContain('edge info not found');
    });
  });

  describe('applySaveData', () => {
    it('logs a success entry with element counts when a case loads', () => {
      useGraphStore.getState().applySaveData({
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        meta: { title: 'My Case' },
        model: {
          id: undefined,
          globalAttributes: {},
          nodes: [
            { id: 'n1', type: 'x', attributes: { label: 'A' } },
            { id: 'n2', type: 'x', attributes: { label: 'B' } },
          ],
          edges: [
            {
              id: 'e1',
              source: 'n1',
              target: 'n2',
              sourceHandle: null,
              targetHandle: null,
              type: 'custom',
              attributes: {},
            },
          ],
        },
        uiAttributes: {
          nodes: [
            { id: 'n1', position: { x: 0, y: 0 }, data: {} },
            { id: 'n2', position: { x: 1, y: 1 }, data: {} },
          ],
        },
        uiState: { counters: { nodeCounters: {}, totalNodeCounters: {} } },
      });

      const success = useConsoleStore.getState().entries.find((e) => e.level === 'success');
      expect(success).toBeDefined();
      expect(success?.message).toContain('Loaded canvas "My Case"');
      expect(success?.message).toContain('2 nodes');
      expect(success?.message).toContain('1 edge');
    });
  });

  describe('locked canvas', () => {
    /** Installs a single dynamic-port node ('pump1') whose source ports are
     *  driven by the 'outlets' parameter, plus the model entries it needs. */
    const installDynamicPortNode = () => {
      const model = {
        elementInfo: {
          pump: {
            parameters: {
              label: { type: 'string', defaultValue: 'Pump' },
              outlets: { type: 'number', defaultValue: 1 },
            },
            ports: { target: [], source: [] },
          },
        },
        nodeConfig: {
          pump: {
            ports: { target: [], source: [] },
            dynamicPorts: true,
            dynamicPortConfig: { source: { countParameter: 'outlets', min: 1 } },
          },
        },
      } as unknown as RuntimeModel;

      useGraphStore.setState({
        model,
        nodes: [{ id: 'pump1', type: 'pump', position: { x: 0, y: 0 }, data: {} }],
        nodeStates: { pump1: { parameters: { label: 'Pump', outlets: 1 } } },
      });
    };

    it('rejects adding a node while locked', () => {
      useGraphStore.setState({ locked: true });
      const result = useGraphStore.getState().addNode({ type: 'pump' });
      expect(result).toBeUndefined();
      expect(lastEntry()).toMatchObject({ level: 'warn' });
      expect(lastEntry()?.message).toContain('locked');
    });

    it('rejects deleting a node while locked', () => {
      installDynamicPortNode();
      useGraphStore.setState({ locked: true });
      useGraphStore.getState().deleteNode('pump1');
      expect(useGraphStore.getState().nodes).toHaveLength(1);
      expect(lastEntry()?.level).toBe('warn');
      expect(lastEntry()?.message).toContain('locked');
    });

    it('rejects deleting an edge while locked', () => {
      useGraphStore.setState({
        locked: true,
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
      });
      useGraphStore.getState().deleteEdge('e1');
      expect(useGraphStore.getState().edges).toHaveLength(1);
      expect(lastEntry()?.level).toBe('warn');
    });

    it('rejects a dynamic-port count change while locked', () => {
      installDynamicPortNode();
      useGraphStore.setState({ locked: true });
      const ok = useGraphStore.getState().updateNodeParameter('pump1', 'outlets', 3);
      expect(ok).toBe(false);
      expect(useGraphStore.getState().nodeStates.pump1.parameters.outlets).toBe(1);
      expect(lastEntry()?.level).toBe('warn');
      expect(lastEntry()?.message).toContain('port count');
    });

    it('still allows a non-topological parameter edit while locked', () => {
      installDynamicPortNode();
      useGraphStore.setState({ locked: true });
      const ok = useGraphStore.getState().updateNodeParameter('pump1', 'label', 'Renamed');
      expect(ok).toBe(true);
      expect(useGraphStore.getState().nodeStates.pump1.parameters.label).toBe('Renamed');
    });
  });
});
