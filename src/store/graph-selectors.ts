import type { Edge } from 'reactflow';
import type { GraphStore } from './graphStore';

/** True when every node and edge has an assigned index. */
export const selectIndicesReady = (s: GraphStore): boolean => {
  if (s.nodes.length === 0) {
    return false;
  }

  for (const node of s.nodes) {
    const index = s.nodeStates[node.id]?.parameters?.index;
    if (index === undefined || index === null) {
      return false;
    }
  }

  for (const edge of s.edges) {
    const index = s.edgeStates[edge.id]?.parameters?.index;
    if (index === undefined || index === null) {
      return false;
    }
  }

  return true;
};

/**
 * Stable signature of edges incident to a node. Computed from the edges array
 * via `useMemo` (keyed on the array identity) rather than as a Zustand selector:
 * a selector re-runs on every store update — including each node-drag tick — and
 * iterating all edges per node would be O(nodes × edges) on the hottest path.
 * Deriving it from the `edges` reference instead means the scan only happens when
 * edges actually change.
 */
export const buildIncidentEdgesSignature = (edges: Edge[], nodeId: string): string => {
  const parts: string[] = [];
  for (const edge of edges) {
    if (edge.source === nodeId || edge.target === nodeId) {
      parts.push(
        `${edge.id}|${edge.source}|${edge.target}|${edge.sourceHandle ?? ''}|${edge.targetHandle ?? ''}`
      );
    }
  }
  return parts.join('\n');
};
