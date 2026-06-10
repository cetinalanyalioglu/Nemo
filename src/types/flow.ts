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
  /**
   * Whitelist of node types the source may connect to. When omitted or empty,
   * see `disallowedConnections` or fall back to no restriction.
   */
  allowedConnections?: string[];
  /**
   * Blacklist of node types the source may not connect to. Applies only when
   * `allowedConnections` is omitted or empty.
   */
  disallowedConnections?: string[];
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
  /**
   * Whitelist of node type ids this element may connect to as the source.
   * Omit or leave empty to skip whitelist mode. Unknown entries fail model load.
   */
  allowedConnections?: string[];
  /**
   * Blacklist of node type ids this element may not connect to as the source.
   * Used when `allowedConnections` is omitted or empty. Unknown entries fail
   * model load.
   */
  disallowedConnections?: string[];
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
  /**
   * When true, node labels must be unique across the canvas: label edits that
   * collide are rejected and generated labels are disambiguated on add.
   * Defaults to false when omitted.
   */
  forceUniqueNodeLabels?: boolean;
  /** Model-wide parameters defined in the model YAML file. */
  parameters?: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
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

/**
 * A node as stored in the `model` section of the save file. Holds only data
 * required to reconstruct the simulation model (identity, type and the runtime
 * parameter bag), deliberately excluding presentation concerns.
 */
export interface SaveFileModelNode {
  id: string;
  type: string;
  attributes: ParameterValues;
}

/**
 * An edge as stored in the `model` section of the save file. Connection
 * topology plus the runtime parameter bag; no presentation concerns.
 */
export interface SaveFileModelEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  attributes: ParameterValues;
}

/** A node's presentation data, stored separately from its model data. */
export interface SaveFileUiNode {
  id: string;
  position: XYPosition;
  data?: Record<string, unknown>;
}

/**
 * Full save file payload. Model data (the simulation graph) and UI data
 * (presentation) are kept in separate sections, while together they contain
 * everything required for a complete restore.
 */
export interface SaveFilePayload {
  version: string;
  timestamp?: string;
  model: {
    /** Id of the model definition (node/edge library) this document targets. */
    id?: string;
    /** Model-wide attributes. Reserved for future use. */
    globalAttributes: Record<string, unknown>;
    nodes: SaveFileModelNode[];
    edges: SaveFileModelEdge[];
  };
  uiAttributes: {
    nodes: SaveFileUiNode[];
  };
  uiState: {
    counters: {
      nodeCounters: Record<string, number>;
      totalNodeCounters: Record<string, number>;
    };
  };
}
