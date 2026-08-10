import type { NodeTypes, EdgeTypes } from 'reactflow';
import GenericNode, { baseElementInfo } from '../components/nodes/GenericNode';
import GenericEdge, { baseEdgeInfo } from '../components/edges/GenericEdge';
import { resolveIcon } from './icon-registry';
import { MODEL_THEME_IDS, isModelThemeId, type ModelThemeId } from '../types/model-theme';
import type {
  EdgeConfigEntry,
  EdgeInfoEntry,
  ElementInfoEntry,
  ModelDefinition,
  ModelSolverDefinition,
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
  /** Bundled model theme to apply while this model is active, if any. */
  theme: ModelThemeId | null;
  /** When true, node labels are enforced unique across the canvas. */
  forceUniqueNodeLabels: boolean;
  /** Model-wide parameter metadata from the model YAML file. */
  modelParameters: Record<string, Record<string, unknown>>;
  /** Per-category display precedence for parameter sections (see ModelDefinition). */
  categoryPrecedence: Record<string, number>;
  /** How the Python console reaches this model's solver, or null where it declares none. */
  solver: ModelSolverDefinition | null;
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
 * A bare Python name. Anything else would become an attribute of the `nemo` module that
 * no line of Python could reach, which is a silent way to lose a model's convenience.
 */
const PYTHON_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * What the `nemo` module already answers to.
 *
 * Kept beside the validation rather than imported from the Python, which the app never
 * parses. `nemo-module.test.ts` checks the two against each other, so a name added there
 * and forgotten here is a failing test rather than a model that quietly breaks the
 * console it was loaded into.
 */
export const NEMO_NAMES = new Set([
  'case',
  'title',
  'nodes',
  'edges',
  'counts',
  'show',
  'replace',
  'log',
  'build',
  'draw',
  'publish',
  'nemo',
]);

/**
 * Checks a model's `solver` section, if it declares one.
 *
 * What it declares is checked; what it means is not. The packages are strings the
 * console fetches and the adapter is Python the console runs, and neither is anything
 * this app can make sense of — which is the point of them living in the model file.
 */
export const validateSolverDefinition = (
  modelId: string,
  solver: unknown
): ModelSolverDefinition | undefined => {
  if (solver === undefined || solver === null) return undefined;
  if (typeof solver !== 'object' || Array.isArray(solver)) {
    throw new Error(`Model "${modelId}": "solver" must be a mapping.`);
  }
  const candidate = solver as Partial<ModelSolverDefinition>;
  const packages = candidate.packages ?? [];
  if (!Array.isArray(packages) || packages.some((p) => typeof p !== 'string' || p.length === 0)) {
    throw new Error(`Model "${modelId}": "solver.packages" must be a list of non-empty strings.`);
  }
  if (candidate.adapter !== undefined && typeof candidate.adapter !== 'string') {
    throw new Error(`Model "${modelId}": "solver.adapter" must be a string of Python.`);
  }
  if (candidate.example !== undefined && typeof candidate.example !== 'string') {
    throw new Error(`Model "${modelId}": "solver.example" must be a string of Python.`);
  }
  if (candidate.handle !== undefined) {
    if (typeof candidate.handle !== 'string' || !PYTHON_NAME.test(candidate.handle)) {
      throw new Error(`Model "${modelId}": "solver.handle" must be a Python name.`);
    }
    if (NEMO_NAMES.has(candidate.handle)) {
      throw new Error(
        `Model "${modelId}": "solver.handle" cannot be "${candidate.handle}" — the nemo ` +
          'module already answers to that, and taking it would hide what it names.'
      );
    }
  }
  return {
    packages: [...packages],
    adapter: candidate.adapter,
    example: candidate.example,
    handle: candidate.handle,
  };
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
  if (candidate.theme !== undefined && !isModelThemeId(candidate.theme)) {
    throw new Error(
      `Model "${candidate.id}": unknown theme "${String(candidate.theme)}". ` +
        `Known themes: ${MODEL_THEME_IDS.join(', ')}.`
    );
  }
  return {
    id: candidate.id,
    name: candidate.name,
    description: candidate.description,
    theme: candidate.theme,
    forceUniqueNodeLabels: candidate.forceUniqueNodeLabels ?? false,
    parameters: candidate.parameters ?? {},
    categoryPrecedence: candidate.categoryPrecedence ?? {},
    solver: validateSolverDefinition(candidate.id, candidate.solver),
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
      shape: node.shape ?? 'rect',
      shapeOptions: node.shapeOptions,
      glyph: node.glyph,
      glyphScale: node.glyphScale,
      glyphInsetX: node.glyphInsetX,
      glyphInsetY: node.glyphInsetY,
      lockPorts: node.lockPorts,
      resizable: node.resizable,
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
    theme: isModelThemeId(def.theme) ? def.theme : null,
    forceUniqueNodeLabels: def.forceUniqueNodeLabels ?? false,
    modelParameters: def.parameters ?? {},
    categoryPrecedence: def.categoryPrecedence ?? {},
    solver: def.solver ?? null,
    nodeConfig,
    edgeConfig,
    elementInfo,
    edgeInfo,
    nodeTypes,
    edgeTypes,
  };
};
