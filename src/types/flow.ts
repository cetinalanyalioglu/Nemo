import type { ComponentType } from 'react';
import type { IconType } from 'react-icons';
import type { Edge, XYPosition } from 'reactflow';

/** Runtime parameter bag for nodes and edges */
export type ParameterValues = Record<string, unknown>;

export interface NodeRuntimeState {
  parameters: ParameterValues;
}

export interface EdgeRuntimeState {
  parameters: ParameterValues;
}

export interface EditingState {
  isEditing: boolean;
  tempLabel: string;
}

export type ParameterChangeHandlerResult = { isValid: boolean; reason?: string };

export type ParameterChangeHandler = (
  nodeId: string,
  paramName: string,
  value: unknown,
  oldValue: unknown,
  tempNodeStates: Record<string, NodeRuntimeState>,
  edges: Edge[],
  edgeStates: Record<string, EdgeRuntimeState>
) => ParameterChangeHandlerResult;

/** Parameter metadata used by the properties panel and node definitions */
export type ParameterInfo = Record<string, unknown> & {
  label?: string;
  type?: string;
  category?: string;
  editable?: boolean;
  visible?: boolean;
  visibleIf?: VisibilityCondition;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  description?: string;
  key?: string;
};

export type VisibilityCondition =
  | {
      parameter?: string;
      equals?: unknown;
      greaterThan?: number;
      lessThan?: number;
      oneOf?: unknown[];
    }
  | { and?: VisibilityCondition[] }
  | { or?: VisibilityCondition[] };

export interface ElementInfoEntry {
  type?: string;
  displayName?: string;
  category?: string;
  parameters: Record<string, ParameterInfo>;
  ports: { target: string[]; source: string[] };
  dynamicPorts?: boolean;
  icon?: ComponentType<{ className?: string }>;
  onParameterChange?: Record<string | '*', ParameterChangeHandler>;
}

export interface EdgeInfoEntry {
  type?: string;
  displayName?: string;
  category?: string;
  parameters: Record<string, ParameterInfo>;
}

/** Ports a node exposes, keyed by direction. */
export type NodePorts = { target: string[]; source: string[] };

/**
 * Describes how the number of ports on one side of a node is derived from a
 * parameter, enabling data-driven dynamic-port elements.
 */
export interface DynamicPortSide {
  /** Parameter whose value determines the port count for this side. */
  countParameter?: string;
  /** Fallback count used when the parameter is unset. */
  default?: number;
  /** Minimum allowed count. */
  min?: number;
}

export interface DynamicPortConfig {
  target?: DynamicPortSide;
  source?: DynamicPortSide;
}

/** Runtime configuration for a single node type within a model. */
export interface NodeConfigEntry {
  customParameters: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
  ports: NodePorts;
  icon: IconType;
  displayName: string;
  category: string;
  dynamicPorts: boolean;
  dynamicPortConfig?: DynamicPortConfig;
}

/** Runtime configuration for a single edge type within a model. */
export interface EdgeConfigEntry {
  customParameters: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
  displayName: string;
  category: string;
}

/** Raw node definition as authored in a model YAML file. */
export interface ModelNodeDefinition {
  displayName: string;
  category: string;
  icon?: string;
  dynamicPorts?: boolean;
  dynamicPortConfig?: DynamicPortConfig;
  ports?: NodePorts;
  parameters?: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
}

/** Raw edge definition as authored in a model YAML file. */
export interface ModelEdgeDefinition {
  displayName: string;
  category: string;
  parameters?: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
}

/** A complete model definition parsed from a YAML file. */
export interface ModelDefinition {
  id: string;
  name: string;
  description?: string;
  nodes: Record<string, ModelNodeDefinition>;
  edges: Record<string, ModelEdgeDefinition>;
}

/** Entry in the model manifest used to populate the model selector. */
export interface ModelSummary {
  id: string;
  name: string;
  file: string;
  description?: string;
}

/** Edge as stored in canvas.json (includes optional runtime `state`). */
export type SerializedEdge = Edge & { state?: EdgeRuntimeState };

export interface SaveFilePayload {
  version: string;
  timestamp?: string;
  nodes: Array<{
    id: string;
    type: string;
    position: XYPosition;
    data: Record<string, unknown>;
    state?: NodeRuntimeState;
    ports?: { target: { id: string | null }[]; source: { id: string | null }[] };
  }>;
  edges: SerializedEdge[];
  nodeCounters: Record<string, number>;
  totalNodeCounters: Record<string, number>;
}
