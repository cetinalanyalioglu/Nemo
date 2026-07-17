import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGraphStore } from './graphStore';
import { useConsoleStore } from './consoleStore';
import type { ConsoleLogEntry } from '../types/console';
import {
  buildRuntimeModel,
  validateModelDefinition,
  type RuntimeModel,
} from '../models/model-builder';

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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
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

  describe('setNodeRotation', () => {
    const seedNode = (data: Record<string, unknown> = {}) => {
      useGraphStore.setState({
        nodes: [{ id: 'n1', type: 'pump', position: { x: 0, y: 0 }, data }],
        past: [],
        future: [],
      });
    };

    it('stores the rotation in node.data (the UI section)', () => {
      seedNode();
      useGraphStore.getState().setNodeRotation('n1', 90);
      expect(useGraphStore.getState().nodes[0].data?.rotation).toBe(90);
    });

    it('normalizes the angle into [0, 360)', () => {
      seedNode();
      useGraphStore.getState().setNodeRotation('n1', -90);
      expect(useGraphStore.getState().nodes[0].data?.rotation).toBe(270);
      useGraphStore.getState().setNodeRotation('n1', 405);
      expect(useGraphStore.getState().nodes[0].data?.rotation).toBe(45);
    });

    it('is a single undoable step', () => {
      seedNode();
      useGraphStore.getState().setNodeRotation('n1', 45);
      expect(useGraphStore.getState().nodes[0].data?.rotation).toBe(45);
      useGraphStore.getState().undo();
      expect(useGraphStore.getState().nodes[0].data?.rotation ?? 0).toBe(0);
    });

    it('does not record history when recordHistory is false', () => {
      seedNode();
      useGraphStore.getState().setNodeRotation('n1', 30, { recordHistory: false });
      expect(useGraphStore.getState().nodes[0].data?.rotation).toBe(30);
      expect(useGraphStore.getState().past).toHaveLength(0);
    });

    it('is a no-op when the angle is unchanged', () => {
      seedNode({ rotation: 90 });
      useGraphStore.getState().setNodeRotation('n1', 90);
      expect(useGraphStore.getState().past).toHaveLength(0);
    });

    it('preserves other node.data fields (e.g. port placements)', () => {
      seedNode({ portPlacements: { '0': 'top' } });
      useGraphStore.getState().setNodeRotation('n1', 90);
      expect(useGraphStore.getState().nodes[0].data).toMatchObject({
        rotation: 90,
        portPlacements: { '0': 'top' },
      });
    });

    it('logs an error for a missing node', () => {
      seedNode();
      useGraphStore.getState().setNodeRotation('ghost', 90);
      expect(lastEntry()?.level).toBe('error');
      expect(lastEntry()?.message).toContain('node "ghost" not found');
    });
  });

  describe('updateEdgeParameter', () => {
    // The properties panel treats a falsy return as a rejected edit, so this must
    // report success — otherwise committed edge values (e.g. an edge's area) snap
    // back to the old value with a spurious "rejected" border.
    it('returns true after applying a new value', () => {
      useGraphStore.setState({
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
        edgeStates: { e1: { parameters: { area: undefined } } },
      });
      const ok = useGraphStore.getState().updateEdgeParameter('e1', 'area', 0.5);
      expect(ok).toBe(true);
      expect(useGraphStore.getState().edgeStates.e1.parameters.area).toBe(0.5);
    });

    it('returns true for a no-op when the value is unchanged', () => {
      useGraphStore.setState({
        edges: [{ id: 'e1', source: 'a', target: 'b' }],
        edgeStates: { e1: { parameters: { area: 0.5 } } },
      });
      expect(useGraphStore.getState().updateEdgeParameter('e1', 'area', 0.5)).toBe(true);
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

describe('graphStore saveToFile verify-on-save', () => {
  /** A two-element model whose `flow` edge carries a mandatory `area`. */
  const verifyModel = buildRuntimeModel(
    validateModelDefinition({
      id: 'verify',
      name: 'Verify',
      nodes: {
        Source: {
          displayName: 'Source',
          category: 'E',
          ports: { target: [], source: ['0'] },
          parameters: { label: { defaultValue: 'Source' } },
        },
        Sink: {
          displayName: 'Sink',
          category: 'E',
          ports: { target: ['0'], source: [] },
          parameters: { label: { defaultValue: 'Sink' } },
        },
      },
      edges: {
        flow: {
          displayName: 'Flow',
          category: 'C',
          parameters: { area: { label: 'Area', type: 'float', category: 'P', required: true } },
        },
      },
    })
  );

  /** Installs a connected Source→Sink graph; `area` is supplied only when given. */
  const installGraph = (area?: number) => {
    useGraphStore.setState({
      model: verifyModel,
      nodes: [
        { id: 's', type: 'Source', position: { x: 0, y: 0 }, data: {} },
        { id: 'k', type: 'Sink', position: { x: 0, y: 0 }, data: {} },
      ],
      nodeStates: {
        s: { parameters: { label: 'Source' } },
        k: { parameters: { label: 'Sink' } },
      },
      edges: [
        {
          id: 'e1',
          source: 's',
          target: 'k',
          sourceHandle: 's-port-0',
          targetHandle: 'k-port-0',
          type: 'flow',
        },
      ],
      edgeStates: { e1: { parameters: area === undefined ? {} : { area } } },
      highlightedNodeIds: [],
    });
  };

  beforeEach(() => {
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
      highlightedNodeIds: [],
      highlightedEdgeIds: [],
    });
    useConsoleStore.getState().clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    // Stub the browser download path so the happy path doesn't touch unimplemented jsdom APIs.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = vi.fn(() => 'blob:x');
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = vi.fn(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('blocks the save when a required parameter is missing and the user declines', () => {
    installGraph();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    useGraphStore.getState().saveToFile();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    const entries = useConsoleStore.getState().entries;
    expect(entries.some((e) => e.message.includes('missing required parameter "Area"'))).toBe(true);
    expect(entries.some((e) => e.message.includes('Save cancelled'))).toBe(true);
    // The offending edge is highlighted for the user (no node-level issues here).
    expect(useGraphStore.getState().highlightedEdgeIds).toEqual(['e1']);
    expect(useGraphStore.getState().highlightedNodeIds).toEqual([]);
  });

  it('saves anyway when the user confirms past the errors', () => {
    installGraph();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    useGraphStore.getState().saveToFile();

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(useConsoleStore.getState().entries.some((e) => e.message.includes('Saved canvas'))).toBe(
      true
    );
  });

  it('saves without prompting when there are no validation errors', () => {
    installGraph(0.5);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    useGraphStore.getState().saveToFile();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(useConsoleStore.getState().entries.some((e) => e.message.includes('Saved canvas'))).toBe(
      true
    );
  });
});

describe('graphStore port placement', () => {
  const seedNode = () =>
    useGraphStore.setState({
      nodes: [{ id: 'n1', type: 'JunctionStaticP', position: { x: 0, y: 0 }, data: {} }],
      nodeStates: { n1: { parameters: { label: 'Junction' } } },
      nodeCounters: { JunctionStaticP: 1 },
      activePort: null,
      past: [],
      future: [],
      locked: false,
    });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('stores a placement override in the node UI data', () => {
    seedNode();
    useGraphStore.getState().setPortPlacement('n1', '0', 'bottom');
    expect(useGraphStore.getState().nodes[0].data.portPlacements).toEqual({ '0': 'bottom' });
  });

  it('records one undo step so a move can be reverted', () => {
    seedNode();
    useGraphStore.getState().setPortPlacement('n1', '0', 'bottom');
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes[0].data.portPlacements ?? {}).toEqual({});
  });

  it('is a no-op (no history) when the side is unchanged', () => {
    seedNode();
    useGraphStore.getState().setPortPlacement('n1', '0', 'bottom');
    const pastLen = useGraphStore.getState().past.length;
    useGraphStore.getState().setPortPlacement('n1', '0', 'bottom');
    expect(useGraphStore.getState().past.length).toBe(pastLen);
  });

  it('is allowed while the canvas is locked (non-topological)', () => {
    seedNode();
    useGraphStore.setState({ locked: true });
    useGraphStore.getState().setPortPlacement('n1', '0', 'top');
    expect(useGraphStore.getState().nodes[0].data.portPlacements).toEqual({ '0': 'top' });
  });

  it('clears the active port when its node is deleted', () => {
    seedNode();
    useGraphStore.setState({ activePort: { nodeId: 'n1', port: '0' } });
    useGraphStore.getState().deleteNode('n1');
    expect(useGraphStore.getState().activePort).toBeNull();
  });
});

describe('graphStore setPortAngle', () => {
  const seedNode = () =>
    useGraphStore.setState({
      nodes: [{ id: 'n1', type: 'MassFlowInlet', position: { x: 0, y: 0 }, data: {} }],
      nodeStates: { n1: { parameters: { label: 'Inlet' } } },
      nodeCounters: { MassFlowInlet: 1 },
      past: [],
      future: [],
      locked: false,
    });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('stores a normalized manual angle in the node UI data', () => {
    seedNode();
    useGraphStore.getState().setPortAngle('n1', '0', 450);
    expect(useGraphStore.getState().nodes[0].data.portAngles).toEqual({ '0': 90 });
  });

  it('clears the override when the angle is undefined', () => {
    seedNode();
    useGraphStore.getState().setPortAngle('n1', '0', 90);
    useGraphStore.getState().setPortAngle('n1', '0', undefined);
    expect(useGraphStore.getState().nodes[0].data.portAngles).toEqual({});
  });

  it('is a no-op (no history) when the angle is unchanged', () => {
    seedNode();
    useGraphStore.getState().setPortAngle('n1', '0', 90);
    const pastLen = useGraphStore.getState().past.length;
    useGraphStore.getState().setPortAngle('n1', '0', 90);
    expect(useGraphStore.getState().past.length).toBe(pastLen);
  });

  it('records one undo step so a rotation can be reverted', () => {
    seedNode();
    useGraphStore.getState().setPortAngle('n1', '0', 90);
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes[0].data.portAngles ?? {}).toEqual({});
  });
});

describe('graphStore setRailPortAnchor', () => {
  const seedNode = () =>
    useGraphStore.setState({
      nodes: [{ id: 'n1', type: 'Mixer', position: { x: 0, y: 0 }, data: {} }],
      nodeStates: { n1: { parameters: { label: 'Mixer' } } },
      nodeCounters: { Mixer: 1 },
      past: [],
      future: [],
      locked: false,
    });

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('stores a clamped, rounded side + offset in the node UI data', () => {
    seedNode();
    useGraphStore.getState().setRailPortAnchor('n1', '0', { side: 'top', offset: 1.2345 });
    expect(useGraphStore.getState().nodes[0].data.railPortAnchors).toEqual({
      '0': { side: 'top', offset: 1 },
    });
  });

  it('clears the override when the anchor is undefined', () => {
    seedNode();
    useGraphStore.getState().setRailPortAnchor('n1', '0', { side: 'bottom', offset: 0.5 });
    useGraphStore.getState().setRailPortAnchor('n1', '0', undefined);
    expect(useGraphStore.getState().nodes[0].data.railPortAnchors).toEqual({});
  });

  it('is a no-op (no history) when the anchor is unchanged', () => {
    seedNode();
    useGraphStore.getState().setRailPortAnchor('n1', '0', { side: 'left', offset: 0.25 });
    const pastLen = useGraphStore.getState().past.length;
    useGraphStore.getState().setRailPortAnchor('n1', '0', { side: 'left', offset: 0.25 });
    expect(useGraphStore.getState().past.length).toBe(pastLen);
  });

  it('records one undo step so a move can be reverted', () => {
    seedNode();
    useGraphStore.getState().setRailPortAnchor('n1', '0', { side: 'top', offset: 0.5 });
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes[0].data.railPortAnchors ?? {}).toEqual({});
  });
});

describe('graphStore annotations', () => {
  beforeEach(() => {
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
  });

  const addNote = (text = 'hello', style = {}) =>
    useGraphStore.getState().addAnnotation({ position: { x: 10, y: 20 }, text, style })!;

  it('adds a selected, draggable annotation node with no model state', () => {
    const node = addNote();
    expect(node.type).toBe('annotation');
    expect(node.selected).toBe(true);
    expect(node.draggable).toBe(true);
    expect(useGraphStore.getState().nodeStates[node.id]).toBeUndefined();
    expect(useGraphStore.getState().nodes[0].data.annotation).toMatchObject({
      text: 'hello',
      style: {},
    });
  });

  it('adds, edits and deletes annotations while the canvas is locked', () => {
    useGraphStore.setState({ locked: true });
    const node = addNote();
    expect(node).toBeDefined();
    useGraphStore.getState().updateAnnotation(node.id, { text: 'changed' });
    const data = useGraphStore.getState().nodes[0].data.annotation;
    expect(data.text).toBe('changed');
    useGraphStore.getState().deleteAnnotation(node.id);
    expect(useGraphStore.getState().nodes).toHaveLength(0);
  });

  it('merges style patches and clears fields patched to undefined', () => {
    const node = addNote('x', { bold: true });
    useGraphStore.getState().updateAnnotation(node.id, { style: { color: '#ff0000' } });
    useGraphStore.getState().updateAnnotation(node.id, { style: { bold: undefined } });
    const data = useGraphStore.getState().nodes[0].data.annotation;
    expect(data.style).toEqual({ color: '#ff0000' });
  });

  it('is a no-op (no history) when nothing changes', () => {
    const node = addNote('x', { bold: true });
    const pastLen = useGraphStore.getState().past.length;
    useGraphStore.getState().updateAnnotation(node.id, { text: 'x', style: { bold: true } });
    expect(useGraphStore.getState().past.length).toBe(pastLen);
  });

  it('saves annotations to their own section, outside the model', () => {
    const node = addNote('note text', { fontSize: 20 });
    const save = useGraphStore.getState().generateSaveData();
    expect(save.model.nodes).toHaveLength(0);
    expect(save.uiAttributes.nodes).toHaveLength(0);
    expect(save.annotations).toEqual([
      {
        id: node.id,
        kind: 'text',
        position: { x: 10, y: 20 },
        text: 'note text',
        style: { fontSize: 20 },
      },
    ]);
  });

  it('omits the annotations section when there are none', () => {
    const save = useGraphStore.getState().generateSaveData();
    expect(save.annotations).toBeUndefined();
  });

  it('round-trips annotations through applySaveData', () => {
    addNote('roundtrip', { italic: true });
    const save = useGraphStore.getState().generateSaveData();
    useGraphStore.getState().reset();
    useGraphStore.getState().applySaveData(save);
    const nodes = useGraphStore.getState().nodes;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('annotation');
    expect(nodes[0].draggable).toBe(true);
    expect(nodes[0].data.annotation).toMatchObject({ text: 'roundtrip', style: { italic: true } });
  });

  it('never assigns a model index to an annotation', () => {
    useGraphStore.setState({
      nodes: [
        { id: 'n1', type: 'x', position: { x: 0, y: 0 }, data: {} },
        {
          id: 'a1',
          type: 'annotation',
          position: { x: 0, y: 0 },
          data: { annotation: { text: '', style: {} } },
        },
        { id: 'n2', type: 'x', position: { x: 0, y: 0 }, data: {} },
      ],
      nodeStates: {
        n1: { parameters: { label: 'A' } },
        n2: { parameters: { label: 'B' } },
      },
    });
    useGraphStore.getState().regenerateIndices();
    const states = useGraphStore.getState().nodeStates;
    const indices = [states.n1.parameters.index, states.n2.parameters.index].sort();
    expect(indices).toEqual([0, 1]);
  });

  it('undo restores a deleted annotation with its content', () => {
    const node = addNote('keep me');
    useGraphStore.getState().deleteAnnotation(node.id);
    expect(useGraphStore.getState().nodes).toHaveLength(0);
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes[0].data.annotation.text).toBe('keep me');
  });
});

describe('graphStore image and layered annotations', () => {
  beforeEach(() => {
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
  });

  const SRC = 'data:image/png;base64,AAAA';

  it('adds an image annotation with kind, src and a front zIndex', () => {
    const node = useGraphStore.getState().addAnnotation({
      position: { x: 1, y: 2 },
      kind: 'image',
      src: SRC,
      style: { width: 320 },
    })!;
    expect(node.zIndex).toBe(1);
    expect(useGraphStore.getState().nodes[0].data.annotation).toMatchObject({
      kind: 'image',
      src: SRC,
      style: { width: 320 },
    });
  });

  it('moves an annotation behind the model and back, restacking the node', () => {
    const node = useGraphStore.getState().addAnnotation({ text: 'x' })!;
    useGraphStore.getState().updateAnnotation(node.id, { layer: 'back' });
    // Deeper than React Flow's +1000 selection elevation, so the toggle takes
    // effect visually even while the node stays selected.
    expect(useGraphStore.getState().nodes[0].zIndex).toBe(-1500);
    useGraphStore.getState().updateAnnotation(node.id, { layer: 'front' });
    expect(useGraphStore.getState().nodes[0].zIndex).toBe(1);
  });

  it('saves image annotations with src (no text) and a back layer marker', () => {
    const node = useGraphStore.getState().addAnnotation({
      kind: 'image',
      src: SRC,
      style: { width: 100 },
    })!;
    useGraphStore.getState().updateAnnotation(node.id, { layer: 'back' });
    const save = useGraphStore.getState().generateSaveData();
    expect(save.annotations).toHaveLength(1);
    const saved = save.annotations![0];
    expect(saved).toMatchObject({ kind: 'image', src: SRC, layer: 'back' });
    expect(saved.text).toBeUndefined();
  });

  it('round-trips an image annotation through applySaveData with its layer', () => {
    const node = useGraphStore.getState().addAnnotation({ kind: 'image', src: SRC })!;
    useGraphStore.getState().updateAnnotation(node.id, { layer: 'back' });
    const save = useGraphStore.getState().generateSaveData();
    useGraphStore.getState().reset();
    useGraphStore.getState().applySaveData(save);
    const restored = useGraphStore.getState().nodes[0];
    expect(restored.zIndex).toBe(-1500);
    expect(restored.data.annotation).toMatchObject({ kind: 'image', src: SRC, layer: 'back' });
  });

  it('undo restores the previous layer and zIndex', () => {
    const node = useGraphStore.getState().addAnnotation({ text: 'x' })!;
    useGraphStore.getState().updateAnnotation(node.id, { layer: 'back' });
    useGraphStore.getState().undo();
    expect(useGraphStore.getState().nodes[0].zIndex).toBe(1);
  });

  it('locking makes the node unselectable and undraggable; unlocking reverts', () => {
    const node = useGraphStore.getState().addAnnotation({ text: 'x' })!;
    useGraphStore.getState().updateAnnotation(node.id, { locked: true });
    let stored = useGraphStore.getState().nodes[0];
    expect(stored.selectable).toBe(false);
    expect(stored.draggable).toBe(false);
    expect(stored.selected).toBe(false);
    expect(stored.className).toBe('annotation-flow-node--locked');
    useGraphStore.getState().updateAnnotation(node.id, { locked: false });
    stored = useGraphStore.getState().nodes[0];
    expect(stored.selectable).toBe(true);
    expect(stored.draggable).toBe(true);
    expect(stored.data.annotation.locked).toBeUndefined();
  });

  it('normalizes rotation into [0, 360) and drops zero', () => {
    const node = useGraphStore.getState().addAnnotation({ text: 'x' })!;
    useGraphStore.getState().updateAnnotation(node.id, { rotation: -30 });
    expect(useGraphStore.getState().nodes[0].data.annotation.rotation).toBe(330);
    useGraphStore.getState().updateAnnotation(node.id, { rotation: 360 });
    expect(useGraphStore.getState().nodes[0].data.annotation.rotation).toBeUndefined();
  });

  it('clears the name when renamed to blank', () => {
    const node = useGraphStore.getState().addAnnotation({ text: 'x' })!;
    useGraphStore.getState().updateAnnotation(node.id, { name: 'Guide' });
    expect(useGraphStore.getState().nodes[0].data.annotation.name).toBe('Guide');
    useGraphStore.getState().updateAnnotation(node.id, { name: '  ' });
    expect(useGraphStore.getState().nodes[0].data.annotation.name).toBeUndefined();
  });

  it('round-trips name, lock and rotation through save/load', () => {
    const node = useGraphStore.getState().addAnnotation({ kind: 'image', src: SRC })!;
    useGraphStore
      .getState()
      .updateAnnotation(node.id, { name: 'Combustor guide', locked: true, rotation: 15 });
    const save = useGraphStore.getState().generateSaveData();
    expect(save.annotations![0]).toMatchObject({
      name: 'Combustor guide',
      locked: true,
      rotation: 15,
    });
    useGraphStore.getState().reset();
    useGraphStore.getState().applySaveData(save);
    const restored = useGraphStore.getState().nodes[0];
    expect(restored.data.annotation).toMatchObject({
      name: 'Combustor guide',
      locked: true,
      rotation: 15,
    });
    expect(restored.selectable).toBe(false);
    expect(restored.className).toBe('annotation-flow-node--locked');
  });

  it('undo restores the pre-lock selectability', () => {
    const node = useGraphStore.getState().addAnnotation({ text: 'x' })!;
    useGraphStore.getState().updateAnnotation(node.id, { locked: true });
    useGraphStore.getState().undo();
    const stored = useGraphStore.getState().nodes[0];
    expect(stored.data.annotation.locked).toBeUndefined();
    expect(stored.selectable).toBe(true);
  });
});

describe('graphStore unset required parameters (edge area)', () => {
  /** A two-element model whose `flow` edge carries a mandatory `area`. */
  const areaModel = buildRuntimeModel(
    validateModelDefinition({
      id: 'area-model',
      name: 'AreaModel',
      nodes: {
        Source: {
          displayName: 'Source',
          category: 'E',
          ports: { target: [], source: ['0'] },
          parameters: { label: { defaultValue: 'Source' } },
        },
        Sink: {
          displayName: 'Sink',
          category: 'E',
          ports: { target: ['0'], source: [] },
          parameters: { label: { defaultValue: 'Sink' } },
        },
      },
      edges: {
        flow: {
          displayName: 'Flow',
          category: 'C',
          parameters: { area: { label: 'Area', type: 'float', category: 'P', required: true } },
        },
      },
    })
  );

  const installGraph = () => {
    useGraphStore.setState({
      model: areaModel,
      nodes: [
        { id: 's', type: 'Source', position: { x: 0, y: 0 }, data: {} },
        { id: 'k', type: 'Sink', position: { x: 0, y: 0 }, data: {} },
      ],
      nodeStates: {
        s: { parameters: { label: 'Source' } },
        k: { parameters: { label: 'Sink' } },
      },
      edges: [
        {
          id: 'e1',
          source: 's',
          target: 'k',
          sourceHandle: 's-port-0',
          targetHandle: 'k-port-0',
          type: 'flow',
        },
      ],
      // Required-but-unset: the key exists with an undefined value, which is
      // what buildDefaultParameters produces on edge creation.
      edgeStates: { e1: { parameters: { area: undefined } } },
    });
  };

  beforeEach(() => {
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
  });

  it('keeps the unset area key through the save-time index renumbering', () => {
    installGraph();
    useGraphStore.getState().regenerateIndices();
    const parameters = useGraphStore.getState().edgeStates.e1.parameters;
    // The key must survive (a JSON-based clone would silently drop it and the
    // properties pane would lose the Area input box).
    expect(Object.prototype.hasOwnProperty.call(parameters, 'area')).toBe(true);
    expect(parameters.area).toBeUndefined();
  });

  it('restores the unset area key after a YAML-like save/load round trip', () => {
    installGraph();
    useGraphStore.getState().regenerateIndices();
    const save = useGraphStore.getState().generateSaveData();
    // YAML serialization drops keys whose value is undefined; JSON stringify
    // does the same, so it faithfully models the on-disk file.
    const reloaded = JSON.parse(JSON.stringify(save));
    expect('area' in (reloaded.model.edges[0].attributes ?? {})).toBe(false);
    useGraphStore.getState().applySaveData(reloaded);
    const parameters = useGraphStore.getState().edgeStates.e1.parameters;
    expect(Object.prototype.hasOwnProperty.call(parameters, 'area')).toBe(true);
    expect(parameters.area).toBeUndefined();
  });

  it('keeps a set area value through the same round trip', () => {
    installGraph();
    useGraphStore.getState().updateEdgeParameter('e1', 'area', 0.02);
    const save = useGraphStore.getState().generateSaveData();
    const reloaded = JSON.parse(JSON.stringify(save));
    useGraphStore.getState().applySaveData(reloaded);
    expect(useGraphStore.getState().edgeStates.e1.parameters.area).toBe(0.02);
  });
});

describe('graphStore clipboard (copy/paste)', () => {
  const clipModel = buildRuntimeModel(
    validateModelDefinition({
      id: 'clip-model',
      name: 'ClipModel',
      nodes: {
        Source: {
          displayName: 'Source',
          category: 'E',
          ports: { target: [], source: ['0'] },
          parameters: {
            label: { defaultValue: 'Source' },
            pressure: { label: 'Pressure', type: 'float', category: 'P', defaultValue: 1 },
          },
        },
        Sink: {
          displayName: 'Sink',
          category: 'E',
          ports: { target: ['0'], source: [] },
          parameters: { label: { defaultValue: 'Sink' } },
        },
      },
      edges: {
        flow: {
          displayName: 'Flow',
          category: 'C',
          parameters: { area: { label: 'Area', type: 'float', category: 'P', required: true } },
        },
      },
    })
  );

  /** A connected Source→Sink pair with generated indices and custom values. */
  const seedNetwork = () => {
    useGraphStore.setState({
      model: clipModel,
      nodes: [
        { id: 's1', type: 'Source', position: { x: 100, y: 100 }, data: { rotation: 90 } },
        { id: 'k1', type: 'Sink', position: { x: 300, y: 100 }, data: {} },
      ],
      nodeStates: {
        s1: { parameters: { label: 'Source1', pressure: 42, index: 0 } },
        k1: { parameters: { label: 'Sink1', index: 1 } },
      },
      edges: [
        {
          id: 'e1',
          source: 's1',
          target: 'k1',
          sourceHandle: 's1-port-0',
          targetHandle: 'k1-port-0',
          type: 'flow',
        },
      ],
      edgeStates: { e1: { parameters: { area: 0.5, index: 0 } } },
      nodeCounters: { Source: 1, Sink: 1 },
      totalNodeCounters: { Source: 1, Sink: 1 },
    });
  };

  beforeEach(() => {
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
      nodeCounters: {},
      totalNodeCounters: {},
      selectedNodeId: null,
      selectedEdgeId: null,
    });
    useConsoleStore.getState().clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('pastes a copied node as a fresh element with a bumped label and copied parameters', () => {
    seedNetwork();
    // The edge is dropped: its other endpoint is not part of the selection.
    expect(useGraphStore.getState().copySelection(['s1'])).toBe(1);
    expect(useGraphStore.getState().pasteClipboard()).toBe(1);

    const s = useGraphStore.getState();
    expect(s.nodes).toHaveLength(3);
    expect(s.edges).toHaveLength(1);
    const pasted = s.nodes.find((n) => n.id !== 's1' && n.id !== 'k1')!;
    expect(pasted.type).toBe('Source');
    expect(pasted.position).toEqual({ x: 140, y: 140 });
    expect(pasted.data.rotation).toBe(90);
    const parameters = s.nodeStates[pasted.id].parameters;
    expect(parameters.label).toBe('Source2');
    expect(parameters.pressure).toBe(42);
    // Generated indices must never be duplicated.
    expect(parameters.index).toBeUndefined();
    expect(s.totalNodeCounters.Source).toBe(2);
    expect(s.nodeCounters.Source).toBe(2);
    expect(s.selectedNodeId).toBe(pasted.id);
  });

  it('pastes a network portion with remapped edge endpoints, handles, and parameters', () => {
    seedNetwork();
    expect(useGraphStore.getState().copySelection(['s1', 'k1'])).toBe(3);
    expect(useGraphStore.getState().pasteClipboard()).toBe(3);

    const s = useGraphStore.getState();
    expect(s.nodes).toHaveLength(4);
    expect(s.edges).toHaveLength(2);
    const newSource = s.nodes.find((n) => n.type === 'Source' && n.id !== 's1')!;
    const newSink = s.nodes.find((n) => n.type === 'Sink' && n.id !== 'k1')!;
    const newEdge = s.edges.find((e) => e.id !== 'e1')!;
    expect(newEdge.source).toBe(newSource.id);
    expect(newEdge.target).toBe(newSink.id);
    expect(newEdge.sourceHandle).toBe(`${newSource.id}-port-0`);
    expect(newEdge.targetHandle).toBe(`${newSink.id}-port-0`);
    const edgeParameters = s.edgeStates[newEdge.id].parameters;
    expect(edgeParameters.area).toBe(0.5);
    expect(edgeParameters.index).toBeUndefined();
    expect(s.nodeStates[newSink.id].parameters.label).toBe('Sink2');
  });

  it('keeps labels unique across repeated pastes and cascades the offset', () => {
    seedNetwork();
    useGraphStore.getState().copySelection(['s1']);
    useGraphStore.getState().pasteClipboard();
    useGraphStore.getState().pasteClipboard();

    const s = useGraphStore.getState();
    const labels = Object.values(s.nodeStates)
      .map((st) => st.parameters.label)
      .sort();
    expect(labels).toEqual(['Sink1', 'Source1', 'Source2', 'Source3']);
    const xs = s.nodes
      .filter((n) => n.type === 'Source')
      .map((n) => n.position.x)
      .sort((a, b) => a - b);
    expect(xs).toEqual([100, 140, 180]);
  });

  it('is a single undo step and selects the pasted items', () => {
    seedNetwork();
    useGraphStore.getState().copySelection(['s1', 'k1']);
    useGraphStore.getState().pasteClipboard();

    let s = useGraphStore.getState();
    expect(s.past).toHaveLength(1);
    expect(s.nodes.filter((n) => n.selected)).toHaveLength(2);
    expect(s.nodes.filter((n) => n.selected).every((n) => n.id !== 's1' && n.id !== 'k1')).toBe(
      true
    );
    expect(s.edges.filter((e) => e.selected)).toHaveLength(1);

    useGraphStore.getState().undo();
    s = useGraphStore.getState();
    expect(s.nodes).toHaveLength(2);
    expect(s.edges).toHaveLength(1);
  });

  it('keeps the source label when it is free again (cut and paste)', () => {
    seedNetwork();
    useGraphStore.getState().copySelection(['s1']);
    useGraphStore.getState().deleteNode('s1');
    useGraphStore.getState().pasteClipboard();

    const s = useGraphStore.getState();
    const pasted = s.nodes.find((n) => n.type === 'Source')!;
    expect(s.nodeStates[pasted.id].parameters.label).toBe('Source1');
  });

  it('pastes an annotation copy with its content and a de-duplicated name', () => {
    const note = useGraphStore
      .getState()
      .addAnnotation({ position: { x: 5, y: 5 }, text: 'hi', style: { bold: true } })!;
    useGraphStore.getState().updateAnnotation(note.id, { name: 'Note1' });
    useGraphStore.getState().copySelection([note.id]);
    expect(useGraphStore.getState().pasteClipboard()).toBe(1);

    const s = useGraphStore.getState();
    expect(s.nodes).toHaveLength(2);
    const pasted = s.nodes.find((n) => n.id !== note.id)!;
    expect(pasted.type).toBe('annotation');
    expect(pasted.position).toEqual({ x: 45, y: 45 });
    expect(pasted.data.annotation).toMatchObject({
      text: 'hi',
      style: { bold: true },
      name: 'Note2',
    });
    // Annotations never gain model state through a paste.
    expect(s.nodeStates[pasted.id]).toBeUndefined();
  });

  it('pastes only the annotations while the canvas is locked', () => {
    seedNetwork();
    const note = useGraphStore.getState().addAnnotation({ position: { x: 0, y: 0 }, text: 'n' })!;
    useGraphStore.getState().copySelection(['s1', note.id]);
    useGraphStore.setState({ locked: true });

    expect(useGraphStore.getState().pasteClipboard()).toBe(1);
    const s = useGraphStore.getState();
    expect(s.nodes.filter((n) => n.type === 'annotation')).toHaveLength(2);
    expect(s.nodes.filter((n) => n.type === 'Source')).toHaveLength(1);
    const { entries } = useConsoleStore.getState();
    expect(entries.some((e) => e.message.includes('pasted the annotations only'))).toBe(true);
  });

  it('refuses to paste model content on a locked canvas', () => {
    seedNetwork();
    useGraphStore.getState().copySelection(['s1']);
    useGraphStore.setState({ locked: true });

    expect(useGraphStore.getState().pasteClipboard()).toBe(0);
    expect(useGraphStore.getState().nodes).toHaveLength(2);
    const { entries } = useConsoleStore.getState();
    expect(entries.some((e) => e.message.includes('unlock it before pasting'))).toBe(true);
  });
});
