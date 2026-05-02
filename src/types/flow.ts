import type { ComponentType } from 'react';
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
