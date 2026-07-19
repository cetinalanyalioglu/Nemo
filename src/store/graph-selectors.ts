import type { Edge } from 'reactflow';
import type { GraphStore } from './graphStore';
import { ANNOTATION_NODE_TYPE } from '../types/annotations';

/**
 * True when every model node and edge has an assigned index.
 *
 * Annotations are React Flow nodes but live outside the model, so `computeIndices`
 * never assigns them one. They must be excluded here too — otherwise a single
 * text note on the canvas leaves this permanently false, and everything gated on
 * it (the "Show indices" toggle, the data pane) stays disabled however often the
 * user runs Renumber.
 */
export const selectIndicesReady = (s: GraphStore): boolean => {
  const modelNodes = s.nodes.filter((node) => node.type !== ANNOTATION_NODE_TYPE);
  if (modelNodes.length === 0) {
    return false;
  }

  for (const node of modelNodes) {
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
