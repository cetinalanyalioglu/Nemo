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
  /** When true, node labels are enforced unique across the canvas. */
  forceUniqueNodeLabels: boolean;
  /** Model-wide parameter metadata from the model YAML file. */
  modelParameters: Record<string, Record<string, unknown>>;
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
 * Normalizes and validates a connection rule list on a node definition. Returns
 * `undefined` when the list is omitted or empty.
 */
export const parseConnectionTypeList = (
  modelId: string,
  nodeType: string,
  fieldName: 'allowedConnections' | 'disallowedConnections',
  entries: unknown,
  knownNodeTypes: Set<string>
): string[] | undefined => {
  if (entries === undefined || entries === null) {
    return undefined;
  }
  if (!Array.isArray(entries)) {
    throw new Error(`Model "${modelId}": node "${nodeType}" ${fieldName} must be a list.`);
  }
  if (entries.length === 0) {
    return undefined;
  }

  const normalized: string[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'string' || entry.length === 0) {
      throw new Error(
        `Model "${modelId}": node "${nodeType}" ${fieldName} entries must be non-empty strings.`
      );
    }
    if (!knownNodeTypes.has(entry)) {
      const available = Array.from(knownNodeTypes).sort().join(', ');
      throw new Error(
        `Model "${modelId}": node "${nodeType}" ${fieldName} references unknown node type "${entry}". ` +
          `Available types: ${available}.`
      );
    }
    normalized.push(entry);
  }

  return normalized;
};

/**
 * Returns whether a source node type may connect to a target node type based on
 * the source's whitelist/blacklist rules. Only the source node's rules apply.
 */
export const isSourceConnectionToTargetAllowed = (
  sourceConfig: NodeConfigEntry | undefined,
  targetType: string
): boolean => {
  if (!sourceConfig) {
    return true;
  }

  const allowed = sourceConfig.allowedConnections;
  if (allowed && allowed.length > 0) {
    return allowed.includes(targetType);
  }

  const disallowed = sourceConfig.disallowedConnections;
  if (disallowed && disallowed.length > 0) {
    return !disallowed.includes(targetType);
  }

  return true;
};

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
    forceUniqueNodeLabels: candidate.forceUniqueNodeLabels ?? false,
    parameters: candidate.parameters ?? {},
    nodes: candidate.nodes,
    edges: candidate.edges ?? {},
  };
};

/**
 * Builds the runtime model (configs, element/edge info and component maps) from
 * a parsed and validated model definition.
 */
export const buildRuntimeModel = (def: ModelDefinition): RuntimeModel => {
  const knownNodeTypes = new Set(Object.keys(def.nodes));
  const nodeConfig: Record<string, NodeConfigEntry> = {};
  const nodeTypes: NodeTypes = {};

  Object.entries(def.nodes).forEach(([type, node]) => {
    const allowedConnections = parseConnectionTypeList(
      def.id,
      type,
      'allowedConnections',
      node.allowedConnections,
      knownNodeTypes
    );
    const disallowedConnections = parseConnectionTypeList(
      def.id,
      type,
      'disallowedConnections',
      node.disallowedConnections,
      knownNodeTypes
    );

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
      allowedConnections,
      disallowedConnections,
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
    forceUniqueNodeLabels: def.forceUniqueNodeLabels ?? false,
    modelParameters: def.parameters ?? {},
    nodeConfig,
    edgeConfig,
    elementInfo,
    edgeInfo,
    nodeTypes,
    edgeTypes,
  };
};
