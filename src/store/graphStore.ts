import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import type { Connection, Edge, EdgeChange, Node, NodeChange, XYPosition } from 'reactflow';
import type { ChangeEvent as ReactChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import yaml from 'js-yaml';
import { debugLog } from '../utils/debug';
import { isSourceConnectionToTargetAllowed, type RuntimeModel } from '../models/model-builder';
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
}

export interface GraphStore extends GraphData {
  // Model runtime, synced from ModelContext via the store bridge.
  model: RuntimeModel | null;
  models: ModelSummary[];
  requestModelSwitch: (id: string) => void;
  pendingLoad: SaveFilePayload | null;

  // Undo/redo history stacks.
  past: CanvasSnapshot[];
  future: CanvasSnapshot[];

  // ReactFlow change handlers.
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;

  // Selection.
  setSelectedNodeId: (id: string | null) => void;
  setSelectedEdgeId: (id: string | null) => void;

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
  finishEditing: (nodeId: string) => void;

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

    // History
    past: [],
    future: [],

    onNodesChange: (changes) => {
      set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }));
    },

    onEdgesChange: (changes) => {
      set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
    },

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),
    setSelectedEdgeId: (id) => set({ selectedEdgeId: id }),

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
        console.error(`Cannot update parameter: Node ${nodeId} not found`);
        return false;
      }

      const nodeType = node.type!;
      const nodeElementInfo = elementInfo[nodeType];
      if (!nodeElementInfo) {
        console.error(`Cannot update parameter: Element info not found for type "${nodeType}"`);
        return false;
      }

      const oldValue = state.nodeStates[nodeId]?.parameters[paramName];
      if (oldValue === value) {
        return true;
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
        console.error('Cannot add node: Node type is required');
        return undefined;
      }

      const state = get();
      const elementInfo = state.model?.elementInfo ?? EMPTY_ELEMENT_INFO;
      const nodeTemplate = elementInfo[type];
      if (!nodeTemplate) {
        console.error(`Cannot add node: Element info not found for type "${type}"`);
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
      const newLabel = `${String(defaultLabel)}${counter + 1}`;

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
        console.error('Cannot delete node: No node ID provided');
        return;
      }

      const state = get();
      const node = state.nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.error(`Cannot delete node: Node not found for ID ${nodeId}`);
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
      }));
      get().clearHistory();
      debugLog('All nodes and states have been cleared');
    },

    addCustomEdge: (params, type) => {
      const model = get().model;
      const edgeInfo = model?.edgeInfo ?? EMPTY_EDGE_INFO;
      const resolvedType = type ?? getDefaultEdgeType(model);
      const edgeTemplate = edgeInfo[resolvedType];
      if (!edgeTemplate) {
        console.error(`Cannot add edge: Edge info not found for type "${resolvedType}"`);
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

    finishEditing: (nodeId) => {
      const newLabel = get().editingStates[nodeId]?.tempLabel?.trim();
      if (newLabel) {
        get().updateNodeParameter(nodeId, 'label', newLabel);
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

      return {
        version: SAVE_FILE_VERSION,
        timestamp: new Date().toISOString(),
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

        debugLog('Successfully saved canvas state to file');
      } catch (error) {
        console.error('Error saving canvas state:', error);
      }
    },

    applySaveData: (saveData) => {
      get().reset();

      const edgeInfo = get().model?.edgeInfo ?? EMPTY_EDGE_INFO;

      const uiNodeById = new Map(
        (saveData.uiAttributes?.nodes ?? []).map((uiNode) => [uiNode.id, uiNode])
      );

      const newNodeStates: Record<string, NodeRuntimeState> = {};
      saveData.model.nodes.forEach((node) => {
        newNodeStates[node.id] = { parameters: node.attributes ?? {} };
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
            console.warn(`Edge template not found for type ${edge.type}`);
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
      });

      debugLog('Successfully loaded canvas state from file');
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
          console.error('Error loading canvas state:', error);
          const message = error instanceof Error ? error.message : String(error);
          alert('Error loading file: ' + message);
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
        alert('Error reading file');
      };

      reader.readAsText(file);
    },

    recordHistory: () => {
      const snapshot = captureFrom(get());
      set((s) => {
        const last = s.past[s.past.length - 1];
        if (last && serializeSnapshot(last) === serializeSnapshot(snapshot)) {
          return s.future.length === 0 ? {} : { future: [] };
        }
        const past = [...s.past, snapshot];
        const trimmed =
          past.length > MAX_HISTORY_DEPTH ? past.slice(past.length - MAX_HISTORY_DEPTH) : past;
        return { past: trimmed, future: [] };
      });
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
