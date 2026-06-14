import type { Edge, Node } from 'reactflow';
import type { RuntimeModel } from '../models/model-builder';
import type { NodeRuntimeState } from '../types/flow';
import { computePortLayout, listPorts } from './ports';

/** A single network-validity problem found on the canvas. */
export interface ValidityIssue {
  kind: 'disconnected-node' | 'open-port';
  /** Human-readable description for the console. */
  message: string;
  /** Id of the offending node. */
  nodeId: string;
}

export interface ValidityInput {
  nodes: Node[];
  edges: Edge[];
  nodeStates: Record<string, NodeRuntimeState>;
  model: RuntimeModel | null;
}

/** Resolves a friendly label for a node, falling back to its id. */
const labelFor = (nodeId: string, nodeStates: Record<string, NodeRuntimeState>): string => {
  const label = nodeStates[nodeId]?.parameters?.label;
  return typeof label === 'string' && label.length > 0 ? label : nodeId;
};

/**
 * Checks basic network validity: no fully disconnected nodes and no unconnected
 * ports. Returns one issue per problem found (empty array means the network is
 * valid). Port handle ids are positional (`{nodeId}-port-{n}`); a port is
 * considered connected when any edge references it as a source or target handle.
 */
export const checkNetworkValidity = ({
  nodes,
  edges,
  nodeStates,
  model,
}: ValidityInput): ValidityIssue[] => {
  const issues: ValidityIssue[] = [];

  // Nodes that participate in at least one edge.
  const connectedNodeIds = new Set<string>();
  // Handle ids that have an edge attached (either end).
  const connectedHandleIds = new Set<string>();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
    if (edge.sourceHandle) connectedHandleIds.add(edge.sourceHandle);
    if (edge.targetHandle) connectedHandleIds.add(edge.targetHandle);
  }

  for (const node of nodes) {
    const label = labelFor(node.id, nodeStates);

    // Disconnected node: no incident edges at all.
    if (!connectedNodeIds.has(node.id)) {
      issues.push({
        kind: 'disconnected-node',
        nodeId: node.id,
        message: `Node "${label}" is disconnected (no edges).`,
      });
      // A disconnected node has every port open; skip per-port noise.
      continue;
    }

    // Unconnected ports: every port the node exposes should have an edge.
    const config = node.type && model ? model.nodeConfig[node.type] : undefined;
    if (!config) continue;
    const layout = computePortLayout(
      config.ports,
      config.dynamicPorts,
      config.dynamicPortConfig,
      nodeStates[node.id]?.parameters
    );
    for (const { port, side } of listPorts(layout)) {
      const handleId = `${node.id}-port-${port}`;
      if (!connectedHandleIds.has(handleId)) {
        issues.push({
          kind: 'open-port',
          nodeId: node.id,
          message: `Node "${label}" port ${port} (${side}) is unconnected.`,
        });
      }
    }
  }

  return issues;
};
