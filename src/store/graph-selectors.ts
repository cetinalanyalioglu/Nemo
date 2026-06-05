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
 * Stable signature of edges incident to a node. Used as a Zustand selector so
 * nodes do not re-render when unrelated edges change.
 */
export const selectIncidentEdgesSignature =
  (nodeId: string) =>
  (s: GraphStore): string => {
    const parts: string[] = [];
    for (const edge of s.edges) {
      if (edge.source === nodeId || edge.target === nodeId) {
        parts.push(
          `${edge.id}|${edge.source}|${edge.target}|${edge.sourceHandle ?? ''}|${edge.targetHandle ?? ''}`
        );
      }
    }
    return parts.join('\n');
  };
