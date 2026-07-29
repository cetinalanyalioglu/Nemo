/**
 * The report a user sends back when something has gone wrong.
 *
 * A canvas is held as several parallel maps — the nodes and edges themselves, the values
 * entered against each, and which of them is being edited — and nothing in the type
 * system keeps them in step. When they drift, the symptom is downstream and strange: a
 * node whose parameters will not open, an edge that solves as though it were somewhere
 * else. The report is what turns that into a sentence, so what it must not do is come
 * back clean from a canvas that is already inconsistent.
 *
 * Each case below drifts one thing and expects it named.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectDiagnostics, installDiagnosticsBridge } from './diagnostics';
import { useGraphStore } from '../store/graphStore';
import { useConsoleStore } from '../store/consoleStore';
import type { RuntimeModel } from '../models/model-builder';
import type { Edge, Node } from 'reactflow';

/** A model that knows one element type and one edge type. */
const model = {
  id: 'test-model',
  name: 'Test Model',
  elementInfo: { duct: {} },
  edgeInfo: { pipe: {} },
} as unknown as RuntimeModel;

const node = (id: string, type: string | undefined = 'duct'): Node =>
  ({ id, type, position: { x: 0, y: 0 }, data: {} }) as Node;

/** A node that reached the canvas without a type, as a malformed save would leave one. */
const untypedNode = (id: string): Node => ({ id, position: { x: 0, y: 0 }, data: {} }) as Node;

const edge = (id: string, source: string, target: string, type = 'pipe'): Edge =>
  ({ id, source, target, type }) as Edge;

/** Puts the canvas in exactly the state described, leaving everything else empty. */
const canvasOf = (state: Partial<ReturnType<typeof useGraphStore.getState>>): void => {
  useGraphStore.setState({
    nodes: [],
    edges: [],
    nodeStates: {},
    edgeStates: {},
    editingStates: {},
    model: null,
    pendingLoad: null,
    past: [],
    future: [],
    selectedNodeId: null,
    selectedEdgeId: null,
    ...state,
  });
};

/** The integrity complaints the report carries. */
const issues = (): string[] => collectDiagnostics().integrity.issues;

beforeEach(() => {
  canvasOf({});
  useConsoleStore.getState().clear();
});

describe('a canvas with nothing wrong with it', () => {
  it('is reported without complaint when empty', () => {
    expect(issues()).toEqual([]);
  });

  it('is reported without complaint when every map lines up', () => {
    canvasOf({
      model,
      nodes: [node('n1')],
      edges: [edge('e1', 'n1', 'n1')],
      nodeStates: { n1: { parameters: {} } },
      edgeStates: { e1: { parameters: {} } },
    });
    expect(issues()).toEqual([]);
  });
});

describe('a canvas whose maps have drifted apart', () => {
  it('names a node with no values recorded against it', () => {
    // The parameter panel reads from `nodeStates`. A node without one is on the canvas
    // and cannot be edited.
    canvasOf({ model, nodes: [node('n1')] });
    expect(issues()).toContain('Node "n1" (duct) is missing nodeStates entry');
  });

  it('names values recorded against a node that is no longer there', () => {
    // The other direction, which a delete that missed one map leaves behind. It survives
    // a save and a load, so it outlives the session that caused it.
    canvasOf({ model, nodeStates: { ghost: { parameters: {} } } });
    expect(issues()).toContain('Orphan nodeStates entry for missing node "ghost"');
  });

  it('names an edge with no values recorded against it', () => {
    canvasOf({
      model,
      nodes: [node('n1')],
      edges: [edge('e1', 'n1', 'n1')],
      nodeStates: { n1: { parameters: {} } },
    });
    expect(issues()).toContain('Edge "e1" is missing edgeStates entry');
  });

  it('names values recorded against an edge that is no longer there', () => {
    canvasOf({ model, edgeStates: { ghost: { parameters: {} } } });
    expect(issues()).toContain('Orphan edgeStates entry for missing edge "ghost"');
  });

  it('names an edit left open on a node that is no longer there', () => {
    canvasOf({ model, editingStates: { ghost: true } as never });
    expect(issues()).toContain('Orphan editingStates entry for missing node "ghost"');
  });
});

describe('a canvas whose connections do not lead anywhere', () => {
  it('names each end of an edge that hangs off nothing', () => {
    // An edge with no element at its end is what the solver trips over first, and its
    // complaint names neither the edge nor the missing node.
    canvasOf({
      model,
      edges: [edge('e1', 'gone', 'also-gone')],
      edgeStates: { e1: { parameters: {} } },
    });
    expect(issues()).toContain('Edge "e1" references missing source node "gone"');
    expect(issues()).toContain('Edge "e1" references missing target node "also-gone"');
  });

  it('names two nodes sharing one id', () => {
    // Every lookup here is by id, so the second node is unreachable — including by the
    // delete that would have got rid of it.
    canvasOf({ model, nodes: [node('n1'), node('n1')], nodeStates: { n1: { parameters: {} } } });
    expect(issues()).toContain('Duplicate node ids: n1');
  });
});

describe('a canvas the active model does not recognise', () => {
  it('names a node of a type this model has never heard of', () => {
    // What a canvas saved under one model and opened under another looks like.
    canvasOf({ model, nodes: [node('n1', 'flange')], nodeStates: { n1: { parameters: {} } } });
    expect(issues()).toContain('Node "n1" has unknown type "flange" for active model');
  });

  it('names an edge of a type this model has never heard of', () => {
    canvasOf({
      model,
      nodes: [node('n1')],
      nodeStates: { n1: { parameters: {} } },
      edges: [edge('e1', 'n1', 'n1', 'hose')],
      edgeStates: { e1: { parameters: {} } },
    });
    expect(issues()).toContain('Edge "e1" has unknown type "hose" for active model');
  });

  it('names a node carrying no type at all', () => {
    canvasOf({ model, nodes: [untypedNode('n1')], nodeStates: { n1: { parameters: {} } } });
    expect(issues()).toContain('Node "n1" has no type');
  });

  it('says so when there are elements but no model to read them with', () => {
    canvasOf({ nodes: [node('n1')], nodeStates: { n1: { parameters: {} } } });
    expect(issues()).toContain('Canvas has nodes but no active runtime model');
  });

  it('says so when a load was begun and never finished', () => {
    // A load left pending means the canvas showing is not the one the model describes.
    canvasOf({ pendingLoad: { model: { id: 'other' } } as never });
    expect(issues()).toContain('pendingLoad is set (target model: other, active: none)');
  });
});

describe('what the report says about the session', () => {
  it('counts the issues it lists', () => {
    canvasOf({ model, nodes: [node('n1'), node('n1')] });
    const report = collectDiagnostics();
    expect(report.integrity.issueCount).toBe(report.integrity.issues.length);
    expect(report.integrity.issueCount).toBeGreaterThan(0);
  });

  it('records the size and shape of the canvas', () => {
    canvasOf({
      model,
      nodes: [node('n1')],
      nodeStates: { n1: { parameters: {} } },
      edges: [edge('e1', 'n1', 'n1')],
      edgeStates: { e1: { parameters: {} } },
      selectedNodeId: 'n1',
      past: [{}, {}] as never,
    });
    const report = collectDiagnostics();
    expect(report.graph).toMatchObject({
      modelId: 'test-model',
      modelName: 'Test Model',
      nodeCount: 1,
      edgeCount: 1,
      selectedNodeId: 'n1',
      pendingLoad: false,
      undoDepth: 2,
      redoDepth: 0,
    });
  });

  it('carries the console transcript along with it', () => {
    // The log is the record of what the user did before it broke, so it travels with the
    // state it produced rather than being asked for separately.
    // Logged at `error`, which no verbosity setting filters out — the transcript a
    // report is worth having is one taken from a session that was going wrong.
    useConsoleStore.getState().append('error', 'something happened');
    const report = collectDiagnostics();
    expect(report.console.entryCount).toBe(1);
    expect(report.console.entries[0].message).toBe('something happened');
  });
});

describe('the errors the page collects while it runs', () => {
  // Installing the bridge patches `console.error` and adds window listeners for the rest
  // of this file. Vitest gives each test file its own environment, so it stops here.
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    installDiagnosticsBridge();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers itself on the window for someone to call from the console', () => {
    expect(typeof window.__NEMO__?.collectDiagnostics).toBe('function');
    expect(typeof window.__NEMO__?.printDiagnostics).toBe('function');
  });

  it('is installed once, however many times it is asked for', () => {
    // A second install would stack another `console.error` wrapper, recording every
    // error twice for as long as the page is open.
    const first = window.__NEMO__;
    installDiagnosticsBridge();
    expect(window.__NEMO__).toBe(first);
  });

  it('catches an error that reached nobody else', () => {
    window.dispatchEvent(new ErrorEvent('error', { message: 'it broke' }));
    const report = collectDiagnostics();
    expect(report.runtime.capturedErrors.map((e) => e.message)).toContain('it broke');
  });

  it('keeps the most recent errors and lets the older ones go', () => {
    // A page that has been failing in a loop for an hour would otherwise carry an hour
    // of identical errors into a report nobody can read.
    for (let i = 0; i < 60; i += 1) {
      window.dispatchEvent(new ErrorEvent('error', { message: `boom ${i}` }));
    }
    const messages = collectDiagnostics().runtime.capturedErrors.map((e) => e.message);
    expect(messages).toHaveLength(50);
    expect(messages).toContain('boom 59');
    expect(messages).not.toContain('boom 0');
  });
});
