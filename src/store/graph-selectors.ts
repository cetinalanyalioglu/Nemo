import type { GraphStore } from './graphStore';

/**
 * Stable signature of edges incident to a node. Used as a Zustand selector so
 * nodes do not re-render when unrelated edges change.
 */
/** True when every node and edge has an assigned solver index. */
export const selectSolverIndicesReady = (s: GraphStore): boolean => {
  if (s.nodes.length === 0) {
    return false;
  }

  for (const node of s.nodes) {
    const solverIndex = s.nodeStates[node.id]?.parameters?.solverIndex;
    if (solverIndex === undefined || solverIndex === null) {
      return false;
    }
  }

  for (const edge of s.edges) {
    const solverIndex = s.edgeStates[edge.id]?.parameters?.solverIndex;
    if (solverIndex === undefined || solverIndex === null) {
      return false;
    }
  }

  return true;
};

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
