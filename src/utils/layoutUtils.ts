import dagre from 'dagre';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Edge, Node } from 'reactflow';

/** Auto-layout engine: ELK's layered algorithm (port-aware) or classic dagre. */
export type LayoutEngine = 'elk' | 'dagre';

/** Flow direction of the layout, in ELK nomenclature. */
export type LayoutDirection = 'RIGHT' | 'LEFT' | 'DOWN' | 'UP';

const DAGRE_DIRECTION: Record<LayoutDirection, 'LR' | 'RL' | 'TB' | 'BT'> = {
  RIGHT: 'LR',
  LEFT: 'RL',
  DOWN: 'TB',
  UP: 'BT',
};

/** A node's connection handle resolved to a point in node-local coordinates. */
export interface LayoutPort {
  /** React Flow handle id (`{nodeId}-port-{n}`). */
  id: string;
  x: number;
  y: number;
}

export interface LayoutRequest {
  direction: LayoutDirection;
  /** Spacing between nodes within a layer (dagre `nodesep`). */
  nodeSep: number;
  /** Spacing between layers (dagre `ranksep`). */
  rankSep: number;
  /** Measured handle centers per node id; lets ELK respect real port positions. */
  ports?: Record<string, LayoutPort[]>;
}

const nodeSize = (node: Node): { width: number; height: number } => ({
  // Prefer ReactFlow's measured dimensions (numeric) so the engine spaces nodes
  // by their real rendered size; fall back to any explicit style size, then a default.
  width: (typeof node.width === 'number' ? node.width : Number(node.style?.width)) || 150,
  height: (typeof node.height === 'number' ? node.height : Number(node.style?.height)) || 50,
});

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = 'RIGHT',
  nodeSep: number = 80,
  rankSep: number = 100
): { nodes: Node[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: DAGRE_DIRECTION[direction],
    ranker: 'network-simplex',
    nodesep: nodeSep,
    ranksep: rankSep,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, nodeSize(node));
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// One engine instance for the app; elk.layout() calls are independent.
const elk = new ELK();

/**
 * Lays out the graph with ELK's layered algorithm.
 *
 * Unlike dagre, ELK is told where each node's handles actually sit
 * (`FIXED_POS` port constraints from the measured handle bounds), so a branch
 * hanging off a top or bottom port is placed on that side, stacked splitter
 * outlets keep their vertical order, and edge crossings are minimized against
 * the real port geometry. Model order is respected as a tie-breaker, keeping
 * the layout stable under re-runs.
 */
export const getElkLayoutedElements = async (
  nodes: Node[],
  edges: Edge[],
  { direction, nodeSep, rankSep, ports }: LayoutRequest
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  const children = nodes.map((node) => {
    const nodePorts = ports?.[node.id] ?? [];
    const child: ElkNode = { id: node.id, ...nodeSize(node) };
    if (nodePorts.length > 0) {
      child.layoutOptions = { 'elk.portConstraints': 'FIXED_POS' };
      child.ports = nodePorts.map((p) => ({ id: p.id, x: p.x, y: p.y, width: 1, height: 1 }));
    }
    return child;
  });

  // An edge endpoint may name a handle that was never measured (e.g. layout
  // before first render); fall back to the node itself so ELK never sees a
  // dangling port reference.
  const knownPorts = new Set(children.flatMap((c) => (c.ports ?? []).map((p) => p.id)));
  const elkEdges = edges.map((edge) => ({
    id: edge.id,
    sources: [
      edge.sourceHandle && knownPorts.has(edge.sourceHandle) ? edge.sourceHandle : edge.source,
    ],
    targets: [
      edge.targetHandle && knownPorts.has(edge.targetHandle) ? edge.targetHandle : edge.target,
    ],
  }));

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.spacing.nodeNode': String(nodeSep),
      'elk.layered.spacing.nodeNodeBetweenLayers': String(rankSep),
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    },
    children,
    edges: elkEdges,
  };

  const layouted = await elk.layout(graph);
  const positions = new Map(
    (layouted.children ?? []).map((c) => [c.id, { x: c.x ?? 0, y: c.y ?? 0 }])
  );

  const layoutedNodes = nodes.map((node) => {
    const position = positions.get(node.id);
    return position ? { ...node, position } : node;
  });

  return { nodes: layoutedNodes, edges };
};
