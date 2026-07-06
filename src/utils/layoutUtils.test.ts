import { describe, expect, it } from 'vitest';
import type { Edge, Node } from 'reactflow';
import { getElkLayoutedElements, getLayoutedElements } from './layoutUtils';

const node = (id: string, width = 100, height = 40): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  width,
  height,
});

const edge = (
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
  targetHandle?: string
): Edge => ({ id, source, target, sourceHandle, targetHandle });

const positionOf = (nodes: Node[], id: string) => nodes.find((n) => n.id === id)!.position;

describe('getElkLayoutedElements', () => {
  it('lays a serial chain out along the flow direction', async () => {
    const nodes = [node('a'), node('b'), node('c')];
    const edges = [edge('e1', 'a', 'b'), edge('e2', 'b', 'c')];

    const { nodes: layouted } = await getElkLayoutedElements(nodes, edges, {
      direction: 'RIGHT',
      nodeSep: 80,
      rankSep: 100,
    });

    expect(positionOf(layouted, 'a').x).toBeLessThan(positionOf(layouted, 'b').x);
    expect(positionOf(layouted, 'b').x).toBeLessThan(positionOf(layouted, 'c').x);
  });

  it('honors the DOWN direction', async () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('e1', 'a', 'b')];

    const { nodes: layouted } = await getElkLayoutedElements(nodes, edges, {
      direction: 'DOWN',
      nodeSep: 80,
      rankSep: 100,
    });

    expect(positionOf(layouted, 'a').y).toBeLessThan(positionOf(layouted, 'b').y);
    expect(positionOf(layouted, 'a').x).toBeCloseTo(positionOf(layouted, 'b').x, 0);
  });

  it('stacks branches to match the source ports they leave from', async () => {
    // A splitter with two outlets on its right edge: port 1 near the top,
    // port 2 near the bottom. The branch fed by port 1 must land above the
    // branch fed by port 2 — this is exactly what dagre cannot express.
    const nodes = [node('splitter', 40, 80), node('upper'), node('lower')];
    const edges = [
      edge('e1', 'splitter', 'upper', 'splitter-port-1'),
      edge('e2', 'splitter', 'lower', 'splitter-port-2'),
    ];

    const { nodes: layouted } = await getElkLayoutedElements(nodes, edges, {
      direction: 'RIGHT',
      nodeSep: 80,
      rankSep: 100,
      ports: {
        splitter: [
          { id: 'splitter-port-1', x: 40, y: 15 },
          { id: 'splitter-port-2', x: 40, y: 65 },
        ],
      },
    });

    expect(positionOf(layouted, 'upper').y).toBeLessThan(positionOf(layouted, 'lower').y);
  });

  it('falls back to the node when an edge names an unmeasured handle', async () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('e1', 'a', 'b', 'a-port-99', 'b-port-99')];

    const { nodes: layouted } = await getElkLayoutedElements(nodes, edges, {
      direction: 'RIGHT',
      nodeSep: 80,
      rankSep: 100,
    });

    expect(positionOf(layouted, 'a').x).toBeLessThan(positionOf(layouted, 'b').x);
  });
});

describe('getLayoutedElements (dagre)', () => {
  it('maps ELK direction names onto dagre rankdir', () => {
    const nodes = [node('a'), node('b')];
    const edges = [edge('e1', 'a', 'b')];

    const { nodes: right } = getLayoutedElements(nodes, edges, 'RIGHT', 80, 100);
    expect(positionOf(right, 'a').x).toBeLessThan(positionOf(right, 'b').x);

    const { nodes: down } = getLayoutedElements(nodes, edges, 'DOWN', 80, 100);
    expect(positionOf(down, 'a').y).toBeLessThan(positionOf(down, 'b').y);
  });
});
