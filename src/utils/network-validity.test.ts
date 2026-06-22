import { describe, expect, it } from '@jest/globals';
import type { Edge, Node } from 'reactflow';
import { checkNetworkValidity, collectHighlightTargets } from './network-validity';
import { buildRuntimeModel, validateModelDefinition } from '../models/model-builder';
import type { EdgeRuntimeState, NodeRuntimeState } from '../types/flow';

/**
 * Minimal model: a Source whose `rate` is mandatory, a plain Sink, and a `flow`
 * edge whose `area` is mandatory. A second Source param (`trim`) is required but
 * only visible when `mode === advanced`, exercising visibility-aware enforcement.
 */
const model = buildRuntimeModel(
  validateModelDefinition({
    id: 'test',
    name: 'Test',
    nodes: {
      Source: {
        displayName: 'Source',
        category: 'Elements',
        ports: { target: [], source: ['0'] },
        parameters: {
          label: { defaultValue: 'Source' },
          mode: { label: 'Mode', type: 'string', category: 'P', defaultValue: 'simple' },
          rate: { label: 'Rate', type: 'float', category: 'P', required: true },
          trim: {
            label: 'Trim',
            type: 'float',
            category: 'P',
            required: true,
            visibleIf: { parameter: 'mode', equals: 'advanced' },
          },
        },
      },
      Sink: {
        displayName: 'Sink',
        category: 'Elements',
        ports: { target: ['0'], source: [] },
        parameters: { label: { defaultValue: 'Sink' } },
      },
    },
    edges: {
      flow: {
        displayName: 'Flow',
        category: 'Connections',
        parameters: { area: { label: 'Area', type: 'float', category: 'P', required: true } },
      },
    },
  })
);

const nodes: Node[] = [
  { id: 's', type: 'Source', position: { x: 0, y: 0 }, data: {} },
  { id: 'k', type: 'Sink', position: { x: 0, y: 0 }, data: {} },
];

const connectedEdge: Edge = {
  id: 'e1',
  source: 's',
  target: 'k',
  sourceHandle: 's-port-0',
  targetHandle: 'k-port-0',
  type: 'flow',
};

/** Builds a fully wired input, overriding the two parameter bags as needed. */
const input = (
  nodeParams: { s?: Record<string, unknown>; k?: Record<string, unknown> },
  edgeParams: Record<string, unknown>
) => ({
  nodes,
  edges: [connectedEdge],
  nodeStates: {
    s: { parameters: { label: 'Source', mode: 'simple', ...nodeParams.s } },
    k: { parameters: { label: 'Sink', ...nodeParams.k } },
  } as Record<string, NodeRuntimeState>,
  edgeStates: { e1: { parameters: edgeParams } } as Record<string, EdgeRuntimeState>,
  model,
});

const missing = (issues: ReturnType<typeof checkNetworkValidity>) =>
  issues.filter((issue) => issue.kind === 'missing-parameter');

describe('checkNetworkValidity required parameters', () => {
  it('reports an error when a required edge parameter is unset', () => {
    const issues = missing(checkNetworkValidity(input({ s: { rate: 1 } }, {})));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', kind: 'missing-parameter' });
    expect(issues[0].message).toContain('Area');
    // Edge issues carry the edge id (for highlighting) and no node id.
    expect(issues[0].nodeId).toBeUndefined();
    expect(issues[0].edgeId).toBe('e1');
  });

  it('passes once every required value is supplied', () => {
    const issues = missing(checkNetworkValidity(input({ s: { rate: 1 } }, { area: 0.5 })));
    expect(issues).toHaveLength(0);
  });

  it('reports an error for a missing required node parameter and tags the node', () => {
    const issues = missing(checkNetworkValidity(input({}, { area: 0.5 })));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', nodeId: 's' });
    expect(issues[0].message).toContain('Rate');
  });

  it('treats blank strings and NaN as missing', () => {
    const blank = missing(checkNetworkValidity(input({ s: { rate: 1 } }, { area: '   ' })));
    expect(blank).toHaveLength(1);
    const nan = missing(checkNetworkValidity(input({ s: { rate: 1 } }, { area: Number.NaN })));
    expect(nan).toHaveLength(1);
  });

  it('does not enforce a required parameter hidden by its visibility condition', () => {
    // `trim` is required but hidden while mode === simple, so it is not flagged.
    const hidden = missing(checkNetworkValidity(input({ s: { rate: 1 } }, { area: 0.5 })));
    expect(hidden).toHaveLength(0);
    // Switching to advanced reveals `trim`, which is now enforced.
    const shown = missing(
      checkNetworkValidity(input({ s: { rate: 1, mode: 'advanced' } }, { area: 0.5 }))
    );
    expect(shown).toHaveLength(1);
    expect(shown[0].message).toContain('Trim');
  });
});

describe('collectHighlightTargets', () => {
  it('separates and dedupes node and edge ids from issues', () => {
    const { nodeIds, edgeIds } = collectHighlightTargets([
      { kind: 'disconnected-node', severity: 'warning', message: '', nodeId: 'n1' },
      { kind: 'missing-parameter', severity: 'error', message: '', nodeId: 'n1' },
      { kind: 'missing-parameter', severity: 'error', message: '', edgeId: 'e1' },
      { kind: 'missing-parameter', severity: 'error', message: '', edgeId: 'e1' },
    ]);
    expect(nodeIds).toEqual(['n1']);
    expect(edgeIds).toEqual(['e1']);
  });
});

describe('checkNetworkValidity connectivity severity', () => {
  it('flags disconnected nodes as warnings, not errors', () => {
    const issues = checkNetworkValidity({
      nodes,
      edges: [],
      nodeStates: {
        s: { parameters: { label: 'Source', mode: 'simple', rate: 1 } },
        k: { parameters: { label: 'Sink' } },
      },
      edgeStates: {},
      model,
    });
    const disconnected = issues.filter((issue) => issue.kind === 'disconnected-node');
    expect(disconnected.length).toBeGreaterThan(0);
    expect(disconnected.every((issue) => issue.severity === 'warning')).toBe(true);
  });
});
