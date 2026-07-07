import type { Edge, Node } from 'reactflow';
import type { RuntimeModel } from '../models/model-builder';
import type {
  EdgeRuntimeState,
  NodeRuntimeState,
  ParameterInfo,
  ParameterValues,
} from '../types/flow';
import { computePortLayout, listPorts } from './ports';
import { isParameterVisible } from './parameter-conditions';
import { ANNOTATION_NODE_TYPE } from '../types/annotations';

/** Severity of a network-validity problem. Errors should block a clean save. */
export type ValiditySeverity = 'error' | 'warning';

/** A single network-validity problem found on the canvas. */
export interface ValidityIssue {
  kind: 'disconnected-node' | 'open-port' | 'missing-parameter';
  /** Whether the issue is a hard error (e.g. missing required input) or a warning. */
  severity: ValiditySeverity;
  /** Human-readable description for the console. */
  message: string;
  /** Id of the node to highlight, when the issue concerns a node. */
  nodeId?: string;
  /** Id of the edge to highlight, when the issue concerns an edge. */
  edgeId?: string;
}

export interface ValidityInput {
  nodes: Node[];
  edges: Edge[];
  nodeStates: Record<string, NodeRuntimeState>;
  edgeStates: Record<string, EdgeRuntimeState>;
  model: RuntimeModel | null;
  /**
   * Model-level parameter values, so a `scope: 'model'` visibility condition on a
   * required node/edge parameter is evaluated the same way the panel renders it: a
   * parameter hidden by a global parameter is not "missing".
   */
  modelParameters?: ParameterValues;
}

/**
 * Extracts the deduped node and edge ids referenced by a set of issues, ready to
 * feed the canvas highlight setters. Issues without an id (e.g. a node-less edge
 * problem) contribute nothing to the node list, and vice versa.
 */
export const collectHighlightTargets = (
  issues: ValidityIssue[]
): { nodeIds: string[]; edgeIds: string[] } => ({
  nodeIds: Array.from(
    new Set(
      issues.map((issue) => issue.nodeId).filter((id): id is string => typeof id === 'string')
    )
  ),
  edgeIds: Array.from(
    new Set(
      issues.map((issue) => issue.edgeId).filter((id): id is string => typeof id === 'string')
    )
  ),
});

/** Resolves a friendly label for a node, falling back to its id. */
const labelFor = (nodeId: string, nodeStates: Record<string, NodeRuntimeState>): string => {
  const label = nodeStates[nodeId]?.parameters?.label;
  return typeof label === 'string' && label.length > 0 ? label : nodeId;
};

/**
 * Whether a required parameter's runtime value counts as "not supplied". Covers
 * the unset case (the default is never seeded for required parameters) as well
 * as blank strings and NaN numbers.
 */
const isRequiredValueMissing = (value: unknown, info: ParameterInfo): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (
    (info.type === 'number' || info.type === 'float') &&
    typeof value === 'number' &&
    Number.isNaN(value)
  ) {
    return true;
  }
  return false;
};

/**
 * Collects "missing required parameter" issues for one element by checking every
 * required parameter that is currently visible against the element's values.
 */
const collectMissingRequired = (
  parametersInfo: Record<string, ParameterInfo> | undefined,
  values: Record<string, unknown>,
  describe: (info: ParameterInfo, key: string) => string,
  ids: { nodeId?: string; edgeId?: string } = {},
  modelParameters?: ParameterValues
): ValidityIssue[] => {
  if (!parametersInfo) return [];
  const issues: ValidityIssue[] = [];
  for (const [key, info] of Object.entries(parametersInfo)) {
    if (!info.required) continue;
    // A required parameter hidden by its own visibility condition — or by a
    // model-level (`scope: 'model'`) condition — is not in play, so it cannot
    // be "missing".
    if (!isParameterVisible(info, values, modelParameters)) continue;
    if (isRequiredValueMissing(values[key], info)) {
      issues.push({
        kind: 'missing-parameter',
        severity: 'error',
        ...ids,
        message: describe(info, key),
      });
    }
  }
  return issues;
};

/**
 * Checks basic network validity: no fully disconnected nodes, no unconnected
 * ports, and no missing mandatory (`required`) parameters on nodes or edges.
 * Returns one issue per problem found (empty array means the network is valid).
 * Port handle ids are positional (`{nodeId}-port-{n}`); a port is considered
 * connected when any edge references it as a source or target handle.
 */
export const checkNetworkValidity = ({
  nodes: allNodes,
  edges,
  nodeStates,
  edgeStates,
  model,
  modelParameters,
}: ValidityInput): ValidityIssue[] => {
  const issues: ValidityIssue[] = [];

  // Annotations are presentation-only: no ports, no parameters, no place in the
  // model — never a validity concern.
  const nodes = allNodes.filter((node) => node.type !== ANNOTATION_NODE_TYPE);

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
        severity: 'warning',
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
          severity: 'warning',
          nodeId: node.id,
          message: `Node "${label}" port ${port} (${side}) is unconnected.`,
        });
      }
    }
  }

  // Missing mandatory parameters on nodes.
  for (const node of nodes) {
    const parametersInfo =
      node.type && model ? model.elementInfo[node.type]?.parameters : undefined;
    const values = nodeStates[node.id]?.parameters ?? {};
    const label = labelFor(node.id, nodeStates);
    issues.push(
      ...collectMissingRequired(
        parametersInfo,
        values,
        (info, key) => `Node "${label}" is missing required parameter "${info.label || key}".`,
        { nodeId: node.id },
        modelParameters
      )
    );
  }

  // Missing mandatory parameters on edges.
  for (const edge of edges) {
    const parametersInfo = edge.type && model ? model.edgeInfo[edge.type]?.parameters : undefined;
    const values = edgeStates[edge.id]?.parameters ?? {};
    const endpoints = `${labelFor(edge.source, nodeStates)} → ${labelFor(edge.target, nodeStates)}`;
    issues.push(
      ...collectMissingRequired(
        parametersInfo,
        values,
        (info, key) => `Edge "${endpoints}" is missing required parameter "${info.label || key}".`,
        { edgeId: edge.id },
        modelParameters
      )
    );
  }

  return issues;
};
