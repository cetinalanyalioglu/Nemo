import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import type { Connection, Edge, EdgeChange, Node, NodeChange, XYPosition } from 'reactflow';
import type { ChangeEvent as ReactChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import yaml from 'js-yaml';
import { debugLog } from '../utils/debug';
import { logger } from '../utils/logger';
import { isSourceConnectionToTargetAllowed, type RuntimeModel } from '../models/model-builder';
import { isPortCountParameter } from '../utils/ports';
import { useDataStore } from './dataStore';
import type {
  EditingState,
  EdgeRuntimeState,
  ElementInfoEntry,
  EdgeInfoEntry,
  ModelSummary,
  NodeRuntimeState,
  ParameterChangeHandler,
  ParameterValues,
  SaveFilePayload,
} from '../types/flow';

/** Maximum number of undo steps retained in history. */
export const MAX_HISTORY_DEPTH = 100;

/** When true, indices are recomputed and applied to state before writing a save file. */
export const RENUMBER_ON_SAVE = true;

const SAVE_FILE_VERSION = '2.0.0';

const EMPTY_ELEMENT_INFO: Record<string, ElementInfoEntry> = {};
const EMPTY_EDGE_INFO: Record<string, EdgeInfoEntry> = {};

/** Resolves the edge type used when connecting or loading edges without an explicit type. */
const getDefaultEdgeType = (model: RuntimeModel | null): string => {
  if (!model) return 'custom';
  const types = Object.keys(model.edgeConfig);
  return types[0] ?? 'custom';
};

/**
 * A serializable snapshot of the canvas graph used for undo/redo. Captures
 * everything required for a full restore while excluding transient concerns
 * (viewport, zoom, selection).
 */
export interface CanvasSnapshot {
  nodes: Node[];
  edges: Edge[];
  nodeStates: Record<string, NodeRuntimeState>;
  edgeStates: Record<string, EdgeRuntimeState>;
  nodeCounters: Record<string, number>;
  totalNodeCounters: Record<string, number>;
}

interface GraphData {
  nodes: Node[];
  edges: Edge[];
  nodeStates: Record<string, NodeRuntimeState>;
  editingStates: Record<string, EditingState>;
  edgeStates: Record<string, EdgeRuntimeState>;
  modelParameters: ParameterValues;
  nodeCounters: Record<string, number>;
  totalNodeCounters: Record<string, number>;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  /** Case title shown at the top of the canvas. */
  title: string;
}

/** Default case title before any name is set or loaded. */
export const DEFAULT_CASE_TITLE = 'Untitled';

export interface GraphStore extends GraphData {
  // Model runtime, synced from ModelContext via the store bridge.
  model: RuntimeModel | null;
  models: ModelSummary[];
  requestModelSwitch: (id: string) => void;
  pendingLoad: SaveFilePayload | null;

  /**
   * Bumped whenever a saved case is applied to the canvas. The canvas watches
   * this to fit the freshly-loaded graph into view (a load can otherwise leave
   * the viewport positioned far from the loaded nodes).
   */
  viewFitNonce: number;

  /**
   * When true, the canvas is locked: topological edits that would renumber the
   * generated indices (adding/deleting nodes or edges, changing dynamic-port
   * counts) are rejected. Loading a dataset locks the canvas so the indices the
   * data maps to stay valid; the user can unlock explicitly. Not part of the
   * undo history or save files — purely a transient UI guard.
   */
  locked: boolean;
  setLocked: (locked: boolean) => void;

  // Undo/redo history stacks.
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];

  // ReactFlow change handlers.
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  // Selection.
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;

  // Transient validity highlighting (not part of undo history). Cleared as soon
  // as the user selects anything.
  highlightedNodeIds: string[];
  setHighlightedNodes: (ids: string[]) => void;

  // Case title.
  setTitle: (title: string) => void;

  // Graph mutations.
  addNode: (payload: {
    type: string;
    position?: XYPosition;
    data?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  }) => Node | undefined;
  deleteNode: (nodeId: string) => void;
  reset: () => void;
  updateNodeParameter: (
    nodeId: string,
    paramName: string,
    value: unknown,
    options?: { recordHistory?: boolean }
  ) => boolean;
  setNodeDimensions: (nodeId: string, width: number, height: number) => void;
  updateEdgeParameter: (edgeId: string, paramName: string, value: unknown) => void;
  updateModelParameter: (paramName: string, value: unknown) => void;
  isValidConnection: (connection: Connection) => boolean;
  addCustomEdge: (params: Connection, type?: string) => void;
  deleteEdge: (edgeId: string) => void;
  updateEdges: (newEdges: Edge[], removedEdgeIds?: string[]) => void;
  regenerateIndices: () => void;

  // Label editing.
  startEditing: (nodeId: string) => void;
  onChange: (nodeId: string, evt: ReactChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (nodeId: string, event: ReactKeyboardEvent<HTMLInputElement>) => void;
  finishEditing: (nodeId: string, opts?: { fromBlur?: boolean }) => void;

  // Save / load.
  generateSaveData: () => SaveFilePayload;
  saveToFile: () => void;
  loadFromFile: (file: File) => void;
  applySaveData: (saveData: SaveFilePayload) => void;

  // History.
  recordHistory: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  // Model bridge hooks (called from GraphStoreBridge).
  syncModel: (model: RuntimeModel | null) => void;
  setModels: (models: ModelSummary[]) => void;
  setModelSwitcher: (fn: (id: string) => void) => void;
  resetForModel: () => void;
  applyPendingLoad: () => void;
}

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Returns whether a node label is already used by another node. Used to enforce
 * the model-level `forceUniqueNodeLabels` setting.
 */
const isNodeLabelTaken = (
  nodeStates: Record<string, NodeRuntimeState>,
  label: string,
  exceptNodeId?: string
): boolean => {
  for (const id in nodeStates) {
    if (id === exceptNodeId) continue;
    if (nodeStates[id]?.parameters?.label === label) return true;
  }
  return false;
};

const generateRandomSuffix = (length = 3): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/** Builds a snapshot from the current graph slice. */
const captureFrom = (s: GraphData): CanvasSnapshot => ({
  nodes: s.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: { ...node.position },
    data: { ...(node.data ?? {}) },
  })),
  edges: s.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? undefined,
    targetHandle: edge.targetHandle ?? undefined,
    type: edge.type,
  })),
  nodeStates: deepClone(s.nodeStates),
  edgeStates: deepClone(s.edgeStates),
  nodeCounters: { ...s.nodeCounters },
  totalNodeCounters: { ...s.totalNodeCounters },
});

/** Produces the graph-slice patch that restores a snapshot. */
const restorePatch = (snapshot: CanvasSnapshot): Partial<GraphData> => ({
  nodes: snapshot.nodes.map((node) => ({
    ...node,
    position: { ...node.position },
    data: { ...(node.data ?? {}) },
  })),
  edges: snapshot.edges.map((edge) => ({ ...edge })),
  nodeStates: deepClone(snapshot.nodeStates),
  edgeStates: deepClone(snapshot.edgeStates),
  nodeCounters: { ...snapshot.nodeCounters },
  totalNodeCounters: { ...snapshot.totalNodeCounters },
  editingStates: {},
  selectedNodeId: null,
  selectedEdgeId: null,
});

const serializeSnapshot = (snapshot: CanvasSnapshot): string => JSON.stringify(snapshot);

const buildDefaultModelParameters = (model: RuntimeModel | null): ParameterValues => {
  const params = model?.modelParameters ?? {};
  const defaults: ParameterValues = {};
  for (const key in params) {
    defaults[key] = params[key].defaultValue;
  }
  return defaults;
};

const mergeModelParameters = (
  model: RuntimeModel | null,
  saved: Record<string, unknown> | undefined
): ParameterValues => {
  const defaults = buildDefaultModelParameters(model);
  if (!saved) return defaults;
  return { ...defaults, ...saved };
};

/**
 * Computes indices for nodes and edges using a BFS traversal so that
 * connected elements receive nearby indices (minimizing bandwidth).
 */
const computeIndices = (
  s: Pick<GraphData, 'nodes' | 'edges' | 'nodeStates' | 'edgeStates'>
): {
  updatedNodeStates: Record<string, NodeRuntimeState>;
  updatedEdgeStates: Record<string, EdgeRuntimeState>;
} => {
  const nodeIndexMap: Record<string, number> = {};
  const edgeIndexMap: Record<string, number> = {};
  let currentNodeIndex = 0;
  let currentEdgeIndex = 0;

  const updatedNodeStates = deepClone(s.nodeStates);
  const updatedEdgeStates = deepClone(s.edgeStates);

  const adjacencyList: Record<string, { connectedNodes: Set<string>; edges: Edge[] }> = {};
  s.nodes.forEach((node) => {
    adjacencyList[node.id] = { connectedNodes: new Set(), edges: [] };
  });

  s.edges.forEach((edge) => {
    if (!adjacencyList[edge.source] || !adjacencyList[edge.target]) return;
    adjacencyList[edge.source].connectedNodes.add(edge.target);
    adjacencyList[edge.target].connectedNodes.add(edge.source);
    adjacencyList[edge.source].edges.push(edge);
    adjacencyList[edge.target].edges.push(edge);
  });

  const bfs = (startNodeId: string) => {
    const queue: string[] = [startNodeId];
    const visited = new Set([startNodeId]);

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      if (!(currentId in nodeIndexMap)) {
        nodeIndexMap[currentId] = currentNodeIndex++;
        if (updatedNodeStates[currentId]) {
          updatedNodeStates[currentId].parameters.index = nodeIndexMap[currentId];
        }
      }

      for (const edge of adjacencyList[currentId].edges) {
        if (!(edge.id in edgeIndexMap)) {
          edgeIndexMap[edge.id] = currentEdgeIndex++;
          if (updatedEdgeStates[edge.id]) {
            updatedEdgeStates[edge.id].parameters.index = edgeIndexMap[edge.id];
          }
        }
      }

      adjacencyList[currentId].connectedNodes.forEach((neighborId) => {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push(neighborId);
        }
      });
    }
  };

  const unvisitedNodes = new Set(s.nodes.map((node) => node.id));
  while (unvisitedNodes.size > 0) {
    const startNode = unvisitedNodes.values().next().value!;
    bfs(startNode);
    Object.keys(nodeIndexMap).forEach((id) => unvisitedNodes.delete(id));
  }

  return { updatedNodeStates, updatedEdgeStates };
};

export const useGraphStore = create<GraphStore>((set, get) => {
  // Caches the serialized form of the most recently pushed history snapshot so
  // recordHistory doesn't re-stringify the entire graph for the dedup check on
  // every interaction. Validated by object identity against the current tail of
  // `past`, so undo/redo (which swap the tail) safely fall back to recomputing.
  let lastPushed: { snapshot: CanvasSnapshot; serialized: string } | null = null;

  const applyIndices = (recordHistory = false) => {
    if (recordHistory) {
      get().recordHistory();
    }
    const { updatedNodeStates, updatedEdgeStates } = computeIndices(get());
    set({ nodeStates: updatedNodeStates, edgeStates: updatedEdgeStates });
  };

  return {
    // Model runtime
    model: null,
    models: [],
    requestModelSwitch: () => {},
    pendingLoad: null,
    viewFitNonce: 0,

    // Graph state
    nodes: [],
    edges: [],
    nodeStates: {},
    editingStates: {},
    edgeStates: {},
    modelParameters: {},
    nodeCounters: {},
    totalNodeCounters: {},
    selectedNodeId: null,
    selectedEdgeId: null,
    title: DEFAULT_CASE_TITLE,
    highlightedNodeIds: [],
    locked: false,

    // History
    past: [],
    future: [],

    setLocked: (locked) => set({ locked }),

    setTitle: (title) => set({ title }),

    setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),

    onNodesChange: (changes) => {
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }));
    },

    onEdgesChange: (changes) => {
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
    },

    // Selecting anything dismisses validity highlights (only clears the array
    // when it's non-empty, so ordinary clicks don't churn node subscriptions).
    setSelectedNodeId: (id) =>
      set((s) => ({
        selectedNodeId: id,
        ...(s.highlightedNodeIds.length ? { highlightedNodeIds: [] } : {}),
      })),
    setSelectedEdgeId: (id) =>
      set((s) => ({
        selectedEdgeId: id,
        ...(s.highlightedNodeIds.length ? { highlightedNodeIds: [] } : {}),
      })),

    isValidConnection: (connection) => {
      if (!connection.sourceHandle || !connection.targetHandle) {
        debugLog('Invalid connection: No source or target handle');
        return false;
      }
      if (connection.source === connection.target) {
        debugLog('Invalid connection: Source and target are the same');
        return false;
      }
      const existingEdges = get().edges.filter(
        (edge) =>
          edge.sourceHandle === connection.sourceHandle ||
          edge.targetHandle === connection.targetHandle
      );
      if (existingEdges.length > 0) {
        debugLog('Invalid connection: Port is already connected');
        return false;
      }

      const { nodes, model } = get();
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (!sourceNode?.type || !targetNode?.type) {
        debugLog('Invalid connection: Source or target node type is missing');
        return false;
      }

      const sourceConfig = model?.nodeConfig[sourceNode.type];
      if (!isSourceConnectionToTargetAllowed(sourceConfig, targetNode.type)) {
        debugLog(
          `Invalid connection: "${sourceNode.type}" is not allowed to connect to "${targetNode.type}"`
        );
        return false;
      }

      return true;
    },

    updateNodeParameter: (nodeId, paramName, value, options = {}) => {
      const { recordHistory: shouldRecord = true } = options;
      const state = get();
      const elementInfo = state.model?.elementInfo ?? EMPTY_ELEMENT_INFO;

      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) {
        logger.error(`Cannot update parameter "${paramName}": node ${nodeId} not found.`);
        return false;
      }

      const nodeType = node.type!;
      const nodeElementInfo = elementInfo[nodeType];
      if (!nodeElementInfo) {
        logger.error(
          `Cannot update parameter "${paramName}": element info not found for type "${nodeType}".`
        );
        return false;
      }

      const oldValue = state.nodeStates[nodeId]?.parameters[paramName];
      if (oldValue === value) {
        return true;
      }

      // While locked, reject edits that change a dynamic-port count: adding or
      // removing ports renumbers handles and invalidates the indices loaded data
      // maps to. Non-topological parameter edits (values, labels) stay allowed.
      if (state.locked) {
        const nodeConfig = state.model?.nodeConfig[nodeType];
        if (
          isPortCountParameter(nodeConfig?.dynamicPorts, nodeConfig?.dynamicPortConfig, paramName)
        ) {
          logger.warn('Canvas is locked: unlock it before changing the port count.');
          return false;
        }
      }

      // Enforce label uniqueness for every write path (properties pane, inline
      // editor, etc.). Callers treat a false return as a rejected edit.
      if (
        paramName === 'label' &&
        state.model?.forceUniqueNodeLabels &&
        typeof value === 'string' &&
        isNodeLabelTaken(state.nodeStates, value, nodeId)
      ) {
        debugLog(`Rejected duplicate node label "${value}"`);
        return false;
      }

      const handlers: Record<string, ParameterChangeHandler> = (nodeElementInfo.onParameterChange ||
        {}) as Record<string, ParameterChangeHandler>;
      const specificHandler = handlers[paramName];
      const defaultHandler = handlers['*'];

      if (specificHandler || defaultHandler) {
        const tempNodeStates = {
          ...state.nodeStates,
          [nodeId]: {
            ...state.nodeStates[nodeId],
            parameters: {
              ...state.nodeStates[nodeId]?.parameters,
              [paramName]: value,
            },
          },
        };

        if (specificHandler) {
          const result = specificHandler(
            nodeId,
            paramName,
            value,
            oldValue,
            tempNodeStates,
            state.edges,
            state.edgeStates
          );
          if (!result.isValid) {
            debugLog(`Parameter change rejected by specific handler: ${result.reason}`);
            return false;
          }
        }

        if (defaultHandler) {
          const result = defaultHandler(
            nodeId,
            paramName,
            value,
            oldValue,
            tempNodeStates,
            state.edges,
            state.edgeStates
          );
          if (!result.isValid) {
            debugLog(`Parameter change rejected by default handler: ${result.reason}`);
            return false;
          }
        }
      }

      if (shouldRecord) {
        get().recordHistory();
      }

      set((s) => ({
        nodeStates: {
          ...s.nodeStates,
          [nodeId]: {
            ...s.nodeStates[nodeId],
            parameters: {
              ...s.nodeStates[nodeId]?.parameters,
              [paramName]: value,
            },
          },
        },
      }));

      return true;
    },

    // Writes width and height in a single store update. Used by node
    // auto-measurement (on mount) and resize commits, where issuing two separate
    // updateNodeParameter calls would double the render passes — costly when a
    // whole graph mounts at once. Never records history (size is derived/transient
    // here; resize gestures snapshot once at gesture start).
    setNodeDimensions: (nodeId, width, height) => {
      set((s) => {
        const current = s.nodeStates[nodeId];
        if (!current) return {};
        const params = current.parameters;
        if (params?.width === width && params?.height === height) {
          return {};
        }
        return {
          nodeStates: {
            ...s.nodeStates,
            [nodeId]: {
              ...current,
              parameters: { ...params, width, height },
            },
          },
        };
      });
    },

    updateEdgeParameter: (edgeId, paramName, value) => {
      if (get().edgeStates[edgeId]?.parameters?.[paramName] === value) {
        return;
      }
      get().recordHistory();
      set((s) => ({
        edgeStates: {
          ...s.edgeStates,
          [edgeId]: {
            ...s.edgeStates[edgeId],
            parameters: {
              ...s.edgeStates[edgeId]?.parameters,
              [paramName]: value,
            },
          },
        },
      }));
    },

    updateModelParameter: (paramName, value) => {
      set((s) => ({
        modelParameters: {
          ...s.modelParameters,
          [paramName]: value,
        },
      }));
    },

    addNode: ({ type, position = { x: 0, y: 0 }, data = {}, parameters = {} }) => {
      debugLog('Adding node with type: ', type);

      if (!type) {
        logger.error('Cannot add node: node type is required.');
        return undefined;
      }

      if (get().locked) {
        logger.warn('Canvas is locked: unlock it before adding nodes.');
        return undefined;
      }

      const state = get();
      const elementInfo = state.model?.elementInfo ?? EMPTY_ELEMENT_INFO;
      const nodeTemplate = elementInfo[type];
      if (!nodeTemplate) {
        logger.error(`Cannot add node: element info not found for type "${type}".`);
        return undefined;
      }

      state.recordHistory();

      const counter = state.totalNodeCounters[type] || 0;

      // Generate a unique id.
      let id = `${type}${counter + 1}-${generateRandomSuffix()}`;
      while (Object.prototype.hasOwnProperty.call(state.nodeStates, id)) {
        id = `${type}-${counter + 1}-${generateRandomSuffix()}`;
      }

      // Generate a unique label.
      const defaultLabel = nodeTemplate.parameters?.label?.defaultValue;
      if (defaultLabel === undefined || defaultLabel === null) {
        throw new Error(`Default label not found for node type: ${type}`);
      }
      let newLabel = `${String(defaultLabel)}${counter + 1}`;
      // When the model enforces unique labels, bump the suffix past any
      // collisions (e.g. a user manually renamed a node to the next label).
      if (state.model?.forceUniqueNodeLabels) {
        let suffix = counter + 1;
        while (isNodeLabelTaken(state.nodeStates, newLabel)) {
          suffix += 1;
          newLabel = `${String(defaultLabel)}${suffix}`;
        }
      }

      const defaultParameters: Record<string, unknown> = {};
      for (const key in nodeTemplate.parameters) {
        defaultParameters[key] = nodeTemplate.parameters[key].defaultValue;
      }

      const mergedParameters = {
        ...defaultParameters,
        ...parameters,
        label: newLabel,
      };

      const newNode: Node = {
        id,
        type,
        position,
        data: { ...data },
      };

      set((s) => ({
        totalNodeCounters: { ...s.totalNodeCounters, [type]: (s.totalNodeCounters[type] || 0) + 1 },
        nodeCounters: { ...s.nodeCounters, [type]: (s.nodeCounters[type] || 0) + 1 },
        nodeStates: { ...s.nodeStates, [id]: { parameters: mergedParameters } },
        nodes: [...s.nodes, newNode],
        selectedNodeId: id,
      }));

      debugLog('Successfully added node: ', newNode);
      return newNode;
    },

    deleteNode: (nodeId) => {
      debugLog('Deleting node with id: ', nodeId);

      if (!nodeId) {
        logger.error('Cannot delete node: no node id provided.');
        return;
      }

      if (get().locked) {
        logger.warn('Canvas is locked: unlock it before deleting nodes.');
        return;
      }

      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) {
        logger.error(`Cannot delete node: node not found for id ${nodeId}.`);
        return;
      }

      const type = node.type!;
      state.recordHistory();

      set((s) => {
        const connectedEdges = s.edges.filter(
          (edge) => edge.source === nodeId || edge.target === nodeId
        );

        const newEdgeStates = { ...s.edgeStates };
        connectedEdges.forEach((edge) => {
          delete newEdgeStates[edge.id];
        });

        const newNodeStates = { ...s.nodeStates };
        delete newNodeStates[nodeId];

        const newEditingStates = { ...s.editingStates };
        delete newEditingStates[nodeId];

        return {
          edges: s.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
          edgeStates: newEdgeStates,
          nodeStates: newNodeStates,
          editingStates: newEditingStates,
          nodeCounters: { ...s.nodeCounters, [type]: Math.max(0, (s.nodeCounters[type] || 0) - 1) },
          nodes: s.nodes.filter((n) => n.id !== nodeId),
          selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
        };
      });

      debugLog('Successfully deleted node: ', nodeId);
    },

    reset: () => {
      debugLog('Resetting all nodes and states ...');
      set((s) => ({
        nodes: [],
        edges: [],
        nodeStates: {},
        edgeStates: {},
        modelParameters: buildDefaultModelParameters(get().model),
        editingStates: {},
        nodeCounters: Object.keys(s.nodeCounters).reduce(
          (acc, key) => {
            acc[key] = 0;
            return acc;
          },
          {} as Record<string, number>
        ),
        selectedNodeId: null,
        selectedEdgeId: null,
        title: DEFAULT_CASE_TITLE,
      }));
      get().clearHistory();
      debugLog('All nodes and states have been cleared');
    },

    addCustomEdge: (params, type) => {
      if (get().locked) {
        logger.warn('Canvas is locked: unlock it before adding edges.');
        return;
      }
      const model = get().model;
      const edgeInfo = model?.edgeInfo ?? EMPTY_EDGE_INFO;
      const resolvedType = type ?? getDefaultEdgeType(model);
      const edgeTemplate = edgeInfo[resolvedType];
      if (!edgeTemplate) {
        logger.error(`Cannot add edge: edge info not found for type "${resolvedType}".`);
        return;
      }

      const defaultParameters: Record<string, unknown> = {};
      for (const key in edgeTemplate.parameters) {
        defaultParameters[key] = edgeTemplate.parameters[key].defaultValue;
      }
      const edgeState: EdgeRuntimeState = { parameters: { ...defaultParameters } };

      get().recordHistory();

      set((s) => {
        const newEdges = addEdge(
          { ...params, type: resolvedType } as Connection & { type: string },
          s.edges
        );
        const newEdge = newEdges[newEdges.length - 1]!;
        debugLog('Adding edge: ', newEdge);
        return {
          edges: newEdges,
          edgeStates: { ...s.edgeStates, [newEdge.id]: edgeState },
        };
      });
    },

    deleteEdge: (edgeId) => {
      if (get().locked) {
        logger.warn('Canvas is locked: unlock it before deleting edges.');
        return;
      }
      get().recordHistory();
      set((s) => {
        const newEdgeStates = { ...s.edgeStates };
        delete newEdgeStates[edgeId];
        return {
          edges: s.edges.filter((edge) => edge.id !== edgeId),
          edgeStates: newEdgeStates,
        };
      });
    },

    updateEdges: (newEdges, removedEdgeIds = []) => {
      get().recordHistory();
      set((s) => {
        const newEdgeStates = { ...s.edgeStates };
        removedEdgeIds.forEach((edgeId) => {
          delete newEdgeStates[edgeId];
        });
        return { edges: newEdges, edgeStates: newEdgeStates };
      });
    },

    regenerateIndices: () => applyIndices(true),

    startEditing: (nodeId) => {
      set((s) => ({
        editingStates: {
          ...s.editingStates,
          [nodeId]: {
            isEditing: true,
            tempLabel: String(s.nodeStates[nodeId]?.parameters?.label || ''),
          },
        },
      }));
    },

    onChange: (nodeId, evt) => {
      const value = evt.target.value;
      set((s) => ({
        editingStates: {
          ...s.editingStates,
          [nodeId]: { ...s.editingStates[nodeId], tempLabel: value },
        },
      }));
    },

    finishEditing: (nodeId, opts) => {
      const state = get();
      const newLabel = state.editingStates[nodeId]?.tempLabel?.trim();
      if (newLabel) {
        if (
          state.model?.forceUniqueNodeLabels &&
          isNodeLabelTaken(state.nodeStates, newLabel, nodeId)
        ) {
          // Duplicate label. On an explicit commit (Enter) warn once and keep the
          // editor open so the user can fix it. On blur (clicking away) cancel the
          // edit silently — otherwise the blur-triggered re-validation loops the alert.
          if (!opts?.fromBlur) {
            alert(`A node labeled "${newLabel}" already exists. Node labels must be unique.`);
            return;
          }
          set((s) => ({
            editingStates: { ...s.editingStates, [nodeId]: { isEditing: false, tempLabel: '' } },
          }));
          return;
        }
        state.updateNodeParameter(nodeId, 'label', newLabel);
      }
      set((s) => ({
        editingStates: { ...s.editingStates, [nodeId]: { isEditing: false, tempLabel: '' } },
      }));
    },

    onKeyDown: (nodeId, event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        get().finishEditing(nodeId);
      }
      if (event.key === 'Escape') {
        set((s) => ({
          editingStates: { ...s.editingStates, [nodeId]: { isEditing: false, tempLabel: '' } },
        }));
      }
    },

    generateSaveData: () => {
      const state = get();

      // Embed only the datasets the user ticked for saving (Data pane / Document
      // pane tick-list). Omit the section entirely when nothing is selected.
      const savedDatasets = useDataStore.getState().datasets.filter((d) => d.includeInSave);

      return {
        version: SAVE_FILE_VERSION,
        timestamp: new Date().toISOString(),
        meta: { title: state.title },
        ...(savedDatasets.length > 0 ? { data: { datasets: savedDatasets } } : {}),
        model: {
          id: state.model?.id,
          globalAttributes: { ...state.modelParameters },
          nodes: state.nodes.map((node) => ({
            id: node.id,
            type: node.type!,
            attributes: state.nodeStates[node.id]?.parameters ?? {},
          })),
          edges: state.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle ?? null,
            targetHandle: edge.targetHandle ?? null,
            type: edge.type,
            attributes: state.edgeStates[edge.id]?.parameters ?? {},
          })),
        },
        uiAttributes: {
          nodes: state.nodes.map((node) => ({
            id: node.id,
            position: node.position,
            data: node.data,
          })),
        },
        uiState: {
          counters: {
            nodeCounters: state.nodeCounters,
            totalNodeCounters: state.totalNodeCounters,
          },
        },
      };
    },

    saveToFile: () => {
      try {
        if (RENUMBER_ON_SAVE) {
          applyIndices();
        }
        const saveData = get().generateSaveData();
        const yamlString = yaml.dump(saveData, { noRefs: true, sortKeys: false, lineWidth: -1 });

        const blob = new Blob([yamlString], { type: 'application/x-yaml' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = 'canvas.yaml';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        logger.success(`Saved canvas to "${link.download}".`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to save canvas: ${message}`);
      }
    },

    applySaveData: (saveData) => {
      get().reset();

      const edgeInfo = get().model?.edgeInfo ?? EMPTY_EDGE_INFO;

      const uiNodeById = new Map(
        (saveData.uiAttributes?.nodes ?? []).map((uiNode) => [uiNode.id, uiNode])
      );

      const forceUniqueLabels = get().model?.forceUniqueNodeLabels ?? false;
      const usedLabels = new Set<string>();
      const newNodeStates: Record<string, NodeRuntimeState> = {};
      saveData.model.nodes.forEach((node) => {
        const parameters = { ...(node.attributes ?? {}) };
        // When the model enforces unique labels, disambiguate any duplicates in
        // the loaded file so the canvas never opens in an invalid state.
        if (forceUniqueLabels && typeof parameters.label === 'string') {
          let label = parameters.label;
          for (let n = 2; usedLabels.has(label); n++) {
            label = `${parameters.label}-${n}`;
          }
          parameters.label = label;
          usedLabels.add(label);
        }
        newNodeStates[node.id] = { parameters };
      });

      const newNodes: Node[] = saveData.model.nodes.map((node) => {
        const ui = uiNodeById.get(node.id);
        return {
          id: node.id,
          type: node.type,
          position: ui?.position ?? { x: 0, y: 0 },
          data: ui?.data ?? {},
        };
      });

      const modelEdges = saveData.model.edges ?? [];

      const newEdgeStates: Record<string, EdgeRuntimeState> = {};
      modelEdges.forEach((edge) => {
        if (edge.attributes) {
          newEdgeStates[edge.id] = { parameters: edge.attributes };
        } else {
          const edgeTemplate = edgeInfo[edge.type || getDefaultEdgeType(get().model)];
          if (!edgeTemplate) {
            logger.warn(
              `Edge "${edge.id}": template not found for type "${edge.type}"; using empty parameters.`
            );
          }
          const defaultParameters: Record<string, unknown> = {};
          if (edgeTemplate) {
            for (const key in edgeTemplate.parameters) {
              defaultParameters[key] = edgeTemplate.parameters[key].defaultValue;
            }
          }
          newEdgeStates[edge.id] = { parameters: defaultParameters };
        }
      });

      const newEdges: Edge[] = modelEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        type: edge.type,
      }));

      set({
        modelParameters: mergeModelParameters(get().model, saveData.model.globalAttributes),
        nodeStates: newNodeStates,
        nodes: newNodes,
        edgeStates: newEdgeStates,
        edges: newEdges,
        nodeCounters: saveData.uiState?.counters?.nodeCounters ?? {},
        totalNodeCounters: saveData.uiState?.counters?.totalNodeCounters ?? {},
        title: saveData.meta?.title ?? DEFAULT_CASE_TITLE,
        // Signal the canvas to fit the loaded graph into view.
        viewFitNonce: get().viewFitNonce + 1,
      });

      // Let the user choose which embedded datasets to import. (The Document
      // pane clears existing datasets before loading, so this is the
      // authoritative set.) The dialog imports the chosen subset.
      if (saveData.data?.datasets && saveData.data.datasets.length > 0) {
        useDataStore.getState().presentDatasetChoice(saveData.data.datasets);
      }

      logger.success(
        `Loaded canvas "${saveData.meta?.title ?? DEFAULT_CASE_TITLE}" ` +
          `(${newNodes.length} node${newNodes.length === 1 ? '' : 's'}, ` +
          `${newEdges.length} edge${newEdges.length === 1 ? '' : 's'}).`
      );
      if (saveData.timestamp) {
        debugLog('File was saved on: ' + new Date(saveData.timestamp).toLocaleString());
      }
    },

    loadFromFile: (file) => {
      const reader = new FileReader();

      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          const raw = event.target?.result;
          if (typeof raw !== 'string') {
            throw new Error('Invalid file contents');
          }

          const saveData = yaml.load(raw) as SaveFilePayload | null;

          if (!saveData || !saveData.version) {
            throw new Error('Invalid save file: Missing version information');
          }

          const [major] = saveData.version.split('.');
          if (parseInt(major) > 2) {
            throw new Error(
              'This save file was created with a newer version and is not compatible.'
            );
          }

          if (!saveData.model || !Array.isArray(saveData.model.nodes)) {
            throw new Error('Invalid save file: Missing model data');
          }

          // When the file carries no explicit title, default to the filename
          // (extension stripped). Set it on the payload so both the immediate
          // and deferred (model-switch) load paths pick it up in applySaveData.
          if (!saveData.meta?.title) {
            const fallbackTitle = file.name.replace(/\.[^./\\]+$/, '');
            saveData.meta = { ...(saveData.meta ?? {}), title: fallbackTitle };
          }

          const state = get();
          const targetModelId = saveData.model.id;
          if (targetModelId && !state.models.some((m) => m.id === targetModelId)) {
            set({ pendingLoad: null });
            throw new Error(
              `The model "${targetModelId}" required by this file is not available. Load cancelled.`
            );
          }

          if (!targetModelId || targetModelId === state.model?.id) {
            set({ pendingLoad: null });
            state.applySaveData(saveData);
          } else {
            set({ pendingLoad: saveData });
            state.requestModelSwitch(targetModelId);
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error(`Failed to load file "${file.name}": ${message}`);
          alert('Error loading file: ' + message);
        }
      };

      reader.onerror = () => {
        logger.error(`Failed to read file "${file.name}".`);
        alert('Error reading file');
      };

      reader.readAsText(file);
    },

    recordHistory: () => {
      const snapshot = captureFrom(get());
      const serialized = serializeSnapshot(snapshot);
      const { past, future } = get();

      const last = past[past.length - 1];
      if (last) {
        const lastSerialized =
          lastPushed && lastPushed.snapshot === last
            ? lastPushed.serialized
            : serializeSnapshot(last);
        if (lastSerialized === serialized) {
          if (future.length > 0) set({ future: [] });
          return;
        }
      }

      const nextPast = [...past, snapshot];
      const trimmed =
        nextPast.length > MAX_HISTORY_DEPTH
          ? nextPast.slice(nextPast.length - MAX_HISTORY_DEPTH)
          : nextPast;
      lastPushed = { snapshot, serialized };
      set({ past: trimmed, future: [] });
    },

    undo: () => {
      const s = get();
      if (s.past.length === 0) return;
      const target = s.past[s.past.length - 1];
      const current = captureFrom(s);
      set({
        ...restorePatch(target),
        past: s.past.slice(0, -1),
        future: [...s.future, current],
      });
    },

    redo: () => {
      const s = get();
      if (s.future.length === 0) return;
      const target = s.future[s.future.length - 1];
      const current = captureFrom(s);
      set({
        ...restorePatch(target),
        past: [...s.past, current],
        future: s.future.slice(0, -1),
      });
    },

    clearHistory: () => set({ past: [], future: [] }),

    syncModel: (model) => set({ model }),
    setModels: (models) => set({ models }),
    setModelSwitcher: (fn) => set({ requestModelSwitch: fn }),

    resetForModel: () => {
      const elementInfo = get().model?.elementInfo ?? EMPTY_ELEMENT_INFO;
      const initialCounters = Object.keys(elementInfo).reduce(
        (acc, type) => {
          acc[type] = 0;
          return acc;
        },
        {} as Record<string, number>
      );
      set({
        nodes: [],
        edges: [],
        nodeStates: {},
        editingStates: {},
        edgeStates: {},
        modelParameters: buildDefaultModelParameters(get().model),
        selectedNodeId: null,
        selectedEdgeId: null,
        nodeCounters: initialCounters,
        totalNodeCounters: { ...initialCounters },
      });
      get().clearHistory();
    },

    applyPendingLoad: () => {
      const state = get();
      const pending = state.pendingLoad;
      if (!pending) return;
      if (state.model?.id !== pending.model.id) return;
      set({ pendingLoad: null });
      state.applySaveData(pending);
    },
  };
});
