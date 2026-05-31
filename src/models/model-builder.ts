import type { NodeTypes, EdgeTypes } from 'reactflow';
import GenericNode, { baseElementInfo } from '../components/nodes/GenericNode';
import GenericEdge, { baseEdgeInfo } from '../components/edges/GenericEdge';
import { resolveIcon } from './icon-registry';
import type {
  EdgeConfigEntry,
  EdgeInfoEntry,
  ElementInfoEntry,
  ModelDefinition,
  NodeConfigEntry,
} from '../types/flow';

/**
 * A fully derived model ready for consumption by the UI and runtime contexts.
 * It mirrors the data that used to be produced by the static config modules,
 * but is rebuilt whenever the active model changes.
 */
export interface RuntimeModel {
  id: string;
  name: string;
  description?: string;
  nodeConfig: Record<string, NodeConfigEntry>;
  edgeConfig: Record<string, EdgeConfigEntry>;
  elementInfo: Record<string, ElementInfoEntry>;
  edgeInfo: Record<string, EdgeInfoEntry>;
  nodeTypes: NodeTypes;
  edgeTypes: EdgeTypes;
}

type ParamMap = Record<string, Record<string, unknown>>;

const mergeParameters = (baseParams: ParamMap, customParams: ParamMap | undefined): ParamMap => {
  const merged = { ...baseParams };
  const custom = customParams ?? {};
  Object.keys(custom).forEach((key) => {
    merged[key] = merged[key] ? { ...merged[key], ...custom[key] } : custom[key];
  });
  return merged;
};

const createElementInfo = (type: string, config: NodeConfigEntry): ElementInfoEntry => ({
  ...baseElementInfo,
  type,
  displayName: config.displayName,
  category: config.category,
  parameters: mergeParameters(
    baseElementInfo.parameters as unknown as ParamMap,
    config.customParameters as ParamMap
  ) as ElementInfoEntry['parameters'],
  ports: config.ports,
  dynamicPorts: config.dynamicPorts || false,
  icon: config.icon,
});

const createEdgeInfo = (type: string, config: EdgeConfigEntry): EdgeInfoEntry => ({
  ...(baseEdgeInfo as unknown as EdgeInfoEntry),
  type,
  displayName: config.displayName,
  category: config.category,
  parameters: mergeParameters(
    baseEdgeInfo.parameters as unknown as ParamMap,
    config.customParameters as ParamMap
  ) as EdgeInfoEntry['parameters'],
});

/**
 * Validates the shape of a parsed model definition, throwing a descriptive
 * error if required fields are missing.
 */
export const validateModelDefinition = (def: unknown): ModelDefinition => {
  if (!def || typeof def !== 'object') {
    throw new Error('Model definition must be an object.');
  }
  const candidate = def as Partial<ModelDefinition>;
  if (!candidate.id || !candidate.name) {
    throw new Error('Model definition must include "id" and "name".');
  }
  if (!candidate.nodes || typeof candidate.nodes !== 'object') {
    throw new Error(`Model "${candidate.id}" must include a "nodes" map.`);
  }
  return {
    id: candidate.id,
    name: candidate.name,
    description: candidate.description,
    nodes: candidate.nodes,
    edges: candidate.edges ?? {},
  };
};

/**
 * Builds the runtime model (configs, element/edge info and component maps) from
 * a parsed and validated model definition.
 */
export const buildRuntimeModel = (def: ModelDefinition): RuntimeModel => {
  const nodeConfig: Record<string, NodeConfigEntry> = {};
  const nodeTypes: NodeTypes = {};

  Object.entries(def.nodes).forEach(([type, node]) => {
    nodeConfig[type] = {
      customParameters: node.parameters ?? {},
      ports: {
        target: node.ports?.target ?? [],
        source: node.ports?.source ?? [],
      },
      icon: resolveIcon(node.icon),
      displayName: node.displayName ?? type,
      category: node.category ?? 'Elements',
      dynamicPorts: node.dynamicPorts ?? false,
      dynamicPortConfig: node.dynamicPortConfig,
    };
    nodeTypes[type] = GenericNode;
  });

  const elementInfo: Record<string, ElementInfoEntry> = {};
  Object.keys(nodeConfig).forEach((type) => {
    elementInfo[type] = createElementInfo(type, nodeConfig[type]);
  });

  const edgeConfig: Record<string, EdgeConfigEntry> = {};
  const edgeInfo: Record<string, EdgeInfoEntry> = {};
  const edgeTypes: EdgeTypes = {
    // `custom` is kept as a runtime alias for backwards compatibility with
    // previously saved files and ReactFlow's defaultEdgeOptions.
    custom: GenericEdge,
  };

  Object.entries(def.edges).forEach(([type, edge]) => {
    edgeConfig[type] = {
      customParameters: edge.parameters ?? {},
      displayName: edge.displayName ?? type,
      category: edge.category ?? 'Connections',
    };
    edgeInfo[type] = createEdgeInfo(type, edgeConfig[type]);
    edgeTypes[type] = GenericEdge;
  });

  // Ensure the `custom` alias resolves to a usable edge info entry.
  if (!edgeInfo.custom) {
    edgeInfo.custom = baseEdgeInfo as unknown as EdgeInfoEntry;
  }

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    nodeConfig,
    edgeConfig,
    elementInfo,
    edgeInfo,
    nodeTypes,
    edgeTypes,
  };
};
