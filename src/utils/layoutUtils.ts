import dagre from 'dagre';
import type { Edge, Node } from 'reactflow';

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'LR',
  nodeSep: number = 80,
  rankSep: number = 100
): { nodes: Node[]; edges: Edge[] } => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({
    rankdir: direction,
    ranker: 'network-simplex',
    nodesep: nodeSep,
    ranksep: rankSep,
  });

  nodes.forEach((node) => {
    // Prefer ReactFlow's measured dimensions (numeric) so dagre spaces nodes by
    // their real rendered size; fall back to any explicit style size, then a default.
    const width = (typeof node.width === 'number' ? node.width : Number(node.style?.width)) || 150;
    const height =
      (typeof node.height === 'number' ? node.height : Number(node.style?.height)) || 50;
    dagreGraph.setNode(node.id, { width, height });
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
