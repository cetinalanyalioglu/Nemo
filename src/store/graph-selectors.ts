import type { GraphStore } from './graphStore';

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
