import { create } from 'zustand';
import { addEdge, applyEdgeChanges, applyNodeChanges } from 'reactflow';
import type { Connection, Edge, EdgeChange, Node, NodeChange, XYPosition } from 'reactflow';
import type { ChangeEvent as ReactChangeEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import yaml from 'js-yaml';
import { debugLog } from '../utils/debug';
import { logger } from '../utils/logger';
import { isSourceConnectionToTargetAllowed, type RuntimeModel } from '../models/model-builder';
import { isPortCountParameter } from '../utils/ports';
import { checkNetworkValidity, collectHighlightTargets } from '../utils/network-validity';
import { useDataStore } from './dataStore';
import { ANNOTATION_LAYER_Z, ANNOTATION_NODE_TYPE } from '../types/annotations';
import type {
  AnnotationData,
  AnnotationKind,
  AnnotationLayer,
  AnnotationStyle,
  SaveFileAnnotation,
} from '../types/annotations';
import type {
  EditingState,
  EdgeRuntimeState,
  ElementInfoEntry,
  EdgeInfoEntry,
  ModelSummary,
  NodeRuntimeState,
  ParameterChangeHandler,
  ParameterInfo,
  ParameterValues,
  PortAngles,
  PortPlacements,
  PortSide,
  SaveFilePayload,
} from '../types/flow';

/** Maximum number of undo steps retained in history. */
export const MAX_HISTORY_DEPTH = 100;

/** When true, indices are recomputed and applied to state before writing a save file. */
export const RENUMBER_ON_SAVE = true;

const SAVE_FILE_VERSION = '2.1.0';

/** Whether a canvas node is an annotation (presentation layer, not the model). */
const isAnnotationNode = (node: Node): boolean => node.type === ANNOTATION_NODE_TYPE;

/**
 * React Flow node flags derived from an annotation's payload: the layer sets
 * the stacking, the lock makes the node inert on the canvas (the class
 * disables pointer events so clicks fall through to whatever is underneath),
 * and the hide flag takes the node out of rendering entirely.
 * `draggable` is explicit so unlocked notes stay movable on a locked canvas.
 */
const annotationNodeFlags = (annotation: AnnotationData): Partial<Node> => ({
  zIndex: ANNOTATION_LAYER_Z[annotation.layer ?? 'front'],
  hidden: annotation.hidden === true,
  draggable: !annotation.locked,
  selectable: !annotation.locked,
  className: annotation.locked ? 'annotation-flow-node--locked' : undefined,
});

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
  highlightedEdgeIds: string[];
  setHighlightedNodes: (ids: string[]) => void;
  setHighlightedEdges: (ids: string[]) => void;

  // The port currently in select-then-place "move" mode, or null. Transient UI
  // state — not part of undo history or save files. Cleared on pane click,
  // Escape, commit, or when its node is deleted.
  activePort: { nodeId: string; port: string } | null;
  setActivePort: (value: { nodeId: string; port: string } | null) => void;

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
  setPortPlacement: (nodeId: string, portNumber: string, side: PortSide) => void;
  /**
   * Sets a node's on-canvas rotation (degrees, normalized to [0, 360)). Purely
   * presentational: stored in `node.data` (the UI section), never the solver
   * model. History is recorded by default; pass `{ recordHistory: false }` for
   * the intermediate ticks of a drag gesture that records once up front.
   */
  setNodeRotation: (nodeId: string, degrees: number, options?: { recordHistory?: boolean }) => void;
  /**
   * Sets a per-instance manual angle (degrees) for a circular element's perimeter
   * port, or clears the override when `angle` is undefined. Presentation-only:
   * stored in `node.data`. History is recorded by default; pass
   * `{ recordHistory: false }` for the intermediate ticks of a drag that records
   * once up front.
   */
  setPortAngle: (
    nodeId: string,
    portNumber: string,
    angle: number | undefined,
    options?: { recordHistory?: boolean }
  ) => void;
  /**
   * Adds a text annotation to the canvas at the given position. Annotations live
   * on the presentation layer only (no model state, no index) and are allowed on
   * a locked canvas. The new note is selected so its style toolbar shows.
   */
  addAnnotation: (payload?: {
    position?: XYPosition;
    kind?: AnnotationKind;
    text?: string;
    src?: string;
    style?: AnnotationStyle;
    layer?: AnnotationLayer;
  }) => Node | undefined;
  /**
   * Merges a patch into an annotation's text, style, layer, name, lock state,
   * hide state, and/or rotation. Style fields set to `undefined` are removed
   * (reset to the default); a layer change also restacks the node relative to
   * the model; a lock change toggles the node's on-canvas selectability; a hide
   * change toggles whether the node is drawn at all. History is recorded by
   * default; pass `{ recordHistory: false }` for continuous gestures (e.g. a
   * color-picker drag or a resize) that record once up front.
   */
  updateAnnotation: (
    annotationId: string,
    patch: {
      text?: string;
      style?: AnnotationStyle;
      layer?: AnnotationLayer;
      name?: string;
      locked?: boolean;
      hidden?: boolean;
      rotation?: number;
    },
    options?: { recordHistory?: boolean }
  ) => void;
  /** Deletes an annotation. Allowed on a locked canvas. */
  deleteAnnotation: (annotationId: string) => void;
  updateEdgeParameter: (edgeId: string, paramName: string, value: unknown) => boolean;
  updateModelParameter: (paramName: string, value: unknown) => void;
  isValidConnection: (connection: Connection) => boolean;
  addCustomEdge: (params: Connection, type?: string) => void;
  deleteEdge: (edgeId: string) => void;
  updateEdges: (newEdges: Edge[], removedEdgeIds?: string[]) => void;
  regenerateIndices: () => void;

  // Clipboard.
  /**
   * Captures the given nodes/annotations — plus the edges connecting two
   * copied nodes — into the in-memory clipboard. Edges cannot exist on their
   * own, so an edge with an endpoint outside the set is dropped. Returns the
   * number of items captured; an empty selection keeps the previous clipboard
   * content.
   */
  copySelection: (nodeIds: string[]) => number;
  /**
   * Pastes the clipboard as fresh items: new ids, de-duplicated labels/names,
   * generated indices cleared (they are recomputed on save), every other
   * parameter copied verbatim. Each successive paste of the same clipboard
   * lands at a growing offset. The paste is one undo step and the new items
   * become the selection. On a locked canvas only annotations paste. Returns
   * the number of items pasted.
   */
  pasteClipboard: () => number;

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

// structuredClone, not JSON round-tripping: parameter maps carry keys whose
// value is deliberately `undefined` (required-but-unset fields like a flow
// edge's area), and JSON serialization silently drops those keys.
const deepClone = <T>(value: T): T => structuredClone(value);

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

/**
 * Bumps a name's trailing number until `isTaken` clears (e.g. "Pump3" →
 * "Pump4", "Header" → "Header2"); returns the name unchanged when it is free.
 * Used to de-duplicate the labels/names of pasted items.
 */
const bumpName = (name: string, isTaken: (candidate: string) => boolean): string => {
  const match = /^(.*?)(\d+)$/.exec(name);
  const base = match ? match[1] : name;
  let counter = match ? Number(match[2]) : 1;
  let candidate = name;
  while (isTaken(candidate)) {
    counter += 1;
    candidate = `${base}${counter}`;
  }
  return candidate;
};

/**
 * Clones a node down to the fields that persist across a restore or a paste
 * (drops transient selection state; keeps the explicit annotation flags —
 * draggable/selectable, layer zIndex, lock className).
 */
const snapshotNode = (node: Node): Node => ({
  id: node.id,
  type: node.type,
  position: { ...node.position },
  data: { ...(node.data ?? {}) },
  ...(node.draggable !== undefined ? { draggable: node.draggable } : {}),
  ...(node.selectable !== undefined ? { selectable: node.selectable } : {}),
  ...(node.zIndex !== undefined ? { zIndex: node.zIndex } : {}),
  ...(node.className !== undefined ? { className: node.className } : {}),
  ...(node.hidden !== undefined ? { hidden: node.hidden } : {}),
});

/** Clones an edge down to the fields that persist (drops selection state). */
const snapshotEdge = (edge: Edge): Edge => ({
  id: edge.id,
  source: edge.source,
  target: edge.target,
  sourceHandle: edge.sourceHandle ?? undefined,
  targetHandle: edge.targetHandle ?? undefined,
  type: edge.type,
});

/** Builds a snapshot from the current graph slice. */
const captureFrom = (s: GraphData): CanvasSnapshot => ({
  nodes: s.nodes.map(snapshotNode),
  edges: s.edges.map(snapshotEdge),
  nodeStates: deepClone(s.nodeStates),
  edgeStates: deepClone(s.edgeStates),
  nodeCounters: { ...s.nodeCounters },
  totalNodeCounters: { ...s.totalNodeCounters },
});

/** Offset applied to pasted items, cascading with each paste of the same copy. */
const PASTE_OFFSET = 40;

/**
 * The in-memory canvas clipboard: cloned nodes (model elements and
 * annotations), the edges internal to the copied set, and the parameter bags
 * keyed by the original ids. Module state rather than store state — the
 * clipboard is transient UI plumbing, never part of undo history or save
 * files.
 */
interface CanvasClipboard {
  nodes: Node[];
  edges: Edge[];
  nodeStates: Record<string, NodeRuntimeState>;
  edgeStates: Record<string, EdgeRuntimeState>;
}

let clipboard: CanvasClipboard | null = null;
/** Pastes of the current clipboard so far; drives the cascading offset. */
let clipboardPasteCount = 0;

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

/**
 * Seeds a parameter bag from a parameter-info map. Required parameters are
 * intentionally left unset (their key is present with an `undefined` value) so
 * the model default never silently persists: the user must supply a value, and
 * `checkNetworkValidity` flags any that stay empty.
 */
const buildDefaultParameters = (
  parametersInfo: Record<string, ParameterInfo> | undefined
): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};
  for (const key in parametersInfo) {
    const info = parametersInfo[key];
    defaults[key] = info?.required ? undefined : info?.defaultValue;
  }
  return defaults;
};

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

  // Annotations live outside the model: they never consume an index.
  const modelNodes = s.nodes.filter((node) => !isAnnotationNode(node));

  const adjacencyList: Record<string, { connectedNodes: Set<string>; edges: Edge[] }> = {};
  modelNodes.forEach((node) => {
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

  const unvisitedNodes = new Set(modelNodes.map((node) => node.id));
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
    highlightedEdgeIds: [],
    activePort: null,
    locked: false,

    // History
    past: [],
    future: [],

    setLocked: (locked) => set({ locked }),

    setTitle: (title) => set({ title }),

    setHighlightedNodes: (ids) => set({ highlightedNodeIds: ids }),

    setHighlightedEdges: (ids) => set({ highlightedEdgeIds: ids }),

    setActivePort: (value) => set({ activePort: value }),

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
        ...(s.highlightedEdgeIds.length ? { highlightedEdgeIds: [] } : {}),
      })),
    setSelectedEdgeId: (id) =>
      set((s) => ({
        selectedEdgeId: id,
        ...(s.highlightedNodeIds.length ? { highlightedNodeIds: [] } : {}),
        ...(s.highlightedEdgeIds.length ? { highlightedEdgeIds: [] } : {}),
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

    // Moves a port to a different edge of the node. This is presentation-only:
    // the port keeps its number, direction and handle id, so edges, data-index
    // mapping and validity are untouched. Stored in the node's UI data (persisted
    // in the save file's uiAttributes, never the model section). Unlike a
    // port-count change this is non-topological, so it is allowed while locked.
    setPortPlacement: (nodeId, portNumber, side) => {
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) {
        logger.error(`Cannot place port: node ${nodeId} not found.`);
        return;
      }
      const current = (node.data?.portPlacements ?? {}) as PortPlacements;
      if (current[portNumber] === side) {
        return;
      }
      get().recordHistory();
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const placements = { ...((n.data?.portPlacements ?? {}) as PortPlacements) };
          placements[portNumber] = side;
          return { ...n, data: { ...(n.data ?? {}), portPlacements: placements } };
        }),
      }));
    },

    setNodeRotation: (nodeId, degrees, options = {}) => {
      const { recordHistory: shouldRecord = true } = options;
      // Normalize into [0, 360) so persisted values stay bounded and 0/360 are
      // treated as identical (no-op detection below).
      const normalized = ((degrees % 360) + 360) % 360;
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) {
        logger.error(`Cannot set rotation: node "${nodeId}" not found.`);
        return;
      }
      const current = typeof node.data?.rotation === 'number' ? node.data.rotation : 0;
      if (current === normalized) return;
      if (shouldRecord) get().recordHistory();
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...(n.data ?? {}), rotation: normalized } } : n
        ),
      }));
    },

    setPortAngle: (nodeId, portNumber, angle, options = {}) => {
      const { recordHistory: shouldRecord = true } = options;
      const node = get().nodes.find((n) => n.id === nodeId);
      if (!node) {
        logger.error(`Cannot set port angle: node "${nodeId}" not found.`);
        return;
      }
      const current = (node.data?.portAngles ?? {}) as PortAngles;
      const normalized = angle == null ? undefined : ((angle % 360) + 360) % 360;
      // No-op when nothing changes (same angle, or clearing an unset override).
      if (
        normalized === undefined ? !(portNumber in current) : current[portNumber] === normalized
      ) {
        return;
      }
      if (shouldRecord) get().recordHistory();
      set((s) => ({
        nodes: s.nodes.map((n) => {
          if (n.id !== nodeId) return n;
          const angles = { ...((n.data?.portAngles ?? {}) as PortAngles) };
          if (normalized === undefined) {
            delete angles[portNumber];
          } else {
            angles[portNumber] = normalized;
          }
          return { ...n, data: { ...(n.data ?? {}), portAngles: angles } };
        }),
      }));
    },

    // Returns true once the value is applied (or already current). Callers — the
    // properties panel in particular — treat a falsy return as a rejected edit,
    // so a void return here made every edge-parameter commit look like a failure.
    updateEdgeParameter: (edgeId, paramName, value) => {
      if (get().edgeStates[edgeId]?.parameters?.[paramName] === value) {
        return true;
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
      return true;
    },

    // Annotation mutations bypass the canvas lock deliberately: annotations are
    // presentation-only, so adding/editing/deleting them can never renumber the
    // indices loaded data maps to.
    addAnnotation: ({
      position = { x: 0, y: 0 },
      kind = 'text',
      text = '',
      src,
      style = {},
      layer = 'front',
    } = {}) => {
      get().recordHistory();

      const takenIds = new Set(get().nodes.map((n) => n.id));
      let id = `annotation-${generateRandomSuffix(6)}`;
      while (takenIds.has(id)) {
        id = `annotation-${generateRandomSuffix(6)}`;
      }

      const annotation: AnnotationData = { kind, text, style, ...(src ? { src } : {}), layer };
      const newNode: Node = {
        id,
        type: ANNOTATION_NODE_TYPE,
        position,
        data: { annotation },
        selected: true,
        ...annotationNodeFlags(annotation),
      };

      set((s) => ({
        nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), newNode],
        selectedNodeId: null,
        selectedEdgeId: null,
      }));
      return newNode;
    },

    updateAnnotation: (annotationId, patch, options = {}) => {
      const { recordHistory: shouldRecord = true } = options;
      const node = get().nodes.find((n) => n.id === annotationId && isAnnotationNode(n));
      if (!node) {
        logger.error(`Cannot update annotation: "${annotationId}" not found.`);
        return;
      }
      const current = (node.data?.annotation ?? { text: '', style: {} }) as AnnotationData;

      const style: AnnotationStyle = { ...current.style, ...(patch.style ?? {}) };
      // An explicit `undefined` in the patch clears the field back to its default
      // (and keeps it out of the save file).
      (Object.keys(style) as Array<keyof AnnotationStyle>).forEach((key) => {
        if (style[key] === undefined) delete style[key];
      });
      const layer = patch.layer ?? current.layer ?? 'front';
      const locked = patch.locked ?? current.locked ?? false;
      const hidden = patch.hidden ?? current.hidden ?? false;
      // Blank names clear back to the automatic list label; rotation normalizes
      // into [0, 360) with 0 dropped so untouched notes stay minimal on disk.
      const name = (patch.name ?? current.name ?? '').trim();
      const rotation =
        patch.rotation !== undefined
          ? ((patch.rotation % 360) + 360) % 360
          : (current.rotation ?? 0);
      const next: AnnotationData = {
        ...current,
        text: patch.text ?? current.text,
        style,
        layer,
        name,
        locked,
        hidden,
        rotation,
      };
      if (!name) delete next.name;
      if (!locked) delete next.locked;
      if (!hidden) delete next.hidden;
      if (!rotation) delete next.rotation;

      if (
        next.text === current.text &&
        layer === (current.layer ?? 'front') &&
        locked === (current.locked ?? false) &&
        hidden === (current.hidden ?? false) &&
        next.name === current.name &&
        rotation === (current.rotation ?? 0) &&
        JSON.stringify(next.style) === JSON.stringify(current.style)
      ) {
        return;
      }

      if (shouldRecord) get().recordHistory();
      set((s) => ({
        nodes: s.nodes.map((n) =>
          n.id === annotationId
            ? {
                ...n,
                data: { ...(n.data ?? {}), annotation: next },
                ...annotationNodeFlags(next),
                // Locking or hiding also drops any live selection so the
                // toolbar closes.
                ...(locked || hidden ? { selected: false } : {}),
              }
            : n
        ),
      }));
    },

    deleteAnnotation: (annotationId) => {
      const node = get().nodes.find((n) => n.id === annotationId && isAnnotationNode(n));
      if (!node) {
        logger.error(`Cannot delete annotation: "${annotationId}" not found.`);
        return;
      }
      get().recordHistory();
      set((s) => ({ nodes: s.nodes.filter((n) => n.id !== annotationId) }));
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

      const defaultParameters = buildDefaultParameters(nodeTemplate.parameters);

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
          activePort: s.activePort?.nodeId === nodeId ? null : s.activePort,
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
        activePort: null,
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

      const defaultParameters = buildDefaultParameters(edgeTemplate.parameters);
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

    copySelection: (nodeIds) => {
      const state = get();
      const wanted = new Set(nodeIds);
      const nodes = state.nodes.filter((node) => wanted.has(node.id));
      if (nodes.length === 0) return 0;

      const copiedIds = new Set(nodes.map((node) => node.id));
      // Edges cannot exist on their own: only edges whose two endpoints are
      // both part of the selection travel with it.
      const edges = state.edges.filter(
        (edge) => copiedIds.has(edge.source) && copiedIds.has(edge.target)
      );

      const nodeStates: Record<string, NodeRuntimeState> = {};
      nodes.forEach((node) => {
        const nodeState = state.nodeStates[node.id];
        if (nodeState) nodeStates[node.id] = deepClone(nodeState);
      });
      const edgeStates: Record<string, EdgeRuntimeState> = {};
      edges.forEach((edge) => {
        const edgeState = state.edgeStates[edge.id];
        if (edgeState) edgeStates[edge.id] = deepClone(edgeState);
      });

      clipboard = {
        nodes: nodes.map(snapshotNode),
        edges: edges.map(snapshotEdge),
        nodeStates,
        edgeStates,
      };
      clipboardPasteCount = 0;
      return nodes.length + edges.length;
    },

    pasteClipboard: () => {
      const clip = clipboard;
      if (!clip) return 0;

      const state = get();
      const elementInfo = state.model?.elementInfo ?? EMPTY_ELEMENT_INFO;
      const edgeInfo = state.model?.edgeInfo ?? EMPTY_EDGE_INFO;

      const annotations = clip.nodes.filter(isAnnotationNode);
      let modelNodes = clip.nodes.filter((node) => !isAnnotationNode(node));
      let edges = clip.edges;

      // Pasting model elements is a topological change; a locked canvas only
      // accepts the presentation-layer part of the clipboard.
      if (state.locked && modelNodes.length > 0) {
        if (annotations.length === 0) {
          logger.warn('Canvas is locked: unlock it before pasting nodes or edges.');
          return 0;
        }
        logger.warn('Canvas is locked: pasted the annotations only.');
        modelNodes = [];
        edges = [];
      }

      // The clipboard can outlive a model switch: skip anything the active
      // model no longer knows, along with the edges attached to it.
      const knownNodes = modelNodes.filter((node) => node.type && elementInfo[node.type]);
      const knownIds = new Set(knownNodes.map((node) => node.id));
      const knownEdges = edges.filter(
        (edge) =>
          edge.type && edgeInfo[edge.type] && knownIds.has(edge.source) && knownIds.has(edge.target)
      );
      if (knownNodes.length < modelNodes.length || knownEdges.length < edges.length) {
        logger.warn('Some copied items are unknown to the active model and were skipped.');
      }
      modelNodes = knownNodes;
      edges = knownEdges;

      if (modelNodes.length === 0 && annotations.length === 0) return 0;

      get().recordHistory();
      clipboardPasteCount += 1;
      const offset = PASTE_OFFSET * clipboardPasteCount;

      const takenNodeIds = new Set(state.nodes.map((node) => node.id));
      const workingNodeStates = { ...state.nodeStates };
      const totalNodeCounters = { ...state.totalNodeCounters };
      const nodeCounters = { ...state.nodeCounters };
      const idMap: Record<string, string> = {};
      const newNodes: Node[] = [];
      const newNodeStates: Record<string, NodeRuntimeState> = {};

      for (const node of modelNodes) {
        const type = node.type!;
        const counter = (totalNodeCounters[type] || 0) + 1;
        let id = `${type}${counter}-${generateRandomSuffix()}`;
        while (takenNodeIds.has(id) || workingNodeStates[id]) {
          id = `${type}${counter}-${generateRandomSuffix()}`;
        }
        takenNodeIds.add(id);
        totalNodeCounters[type] = counter;
        nodeCounters[type] = (nodeCounters[type] || 0) + 1;
        idMap[node.id] = id;

        const defaults = buildDefaultParameters(elementInfo[type].parameters);
        const parameters = {
          ...defaults,
          ...deepClone(clip.nodeStates[node.id]?.parameters ?? {}),
        };
        // A generated index must never be duplicated: reset it to the
        // fresh-node default; save (or regenerateIndices) assigns a real one.
        if ('index' in parameters) parameters.index = defaults.index;
        // De-duplicate the label by bumping its trailing number. The source
        // label may be free again (e.g. after a cut), then it is kept as is.
        const sourceLabel = parameters.label;
        if (typeof sourceLabel === 'string' && sourceLabel) {
          parameters.label = bumpName(sourceLabel, (candidate) =>
            isNodeLabelTaken(workingNodeStates, candidate)
          );
        }

        workingNodeStates[id] = { parameters };
        newNodeStates[id] = { parameters };
        newNodes.push({
          ...node,
          id,
          position: { x: node.position.x + offset, y: node.position.y + offset },
          data: deepClone(node.data ?? {}),
          selected: true,
        });
      }

      const annotationNames = new Set<string>();
      state.nodes.filter(isAnnotationNode).forEach((node) => {
        const name = (node.data?.annotation as AnnotationData | undefined)?.name;
        if (name) annotationNames.add(name);
      });

      for (const node of annotations) {
        let id = `annotation-${generateRandomSuffix(6)}`;
        while (takenNodeIds.has(id)) {
          id = `annotation-${generateRandomSuffix(6)}`;
        }
        takenNodeIds.add(id);

        const data = deepClone(node.data ?? {});
        const annotation = (data.annotation ?? { text: '', style: {} }) as AnnotationData;
        if (annotation.name) {
          annotation.name = bumpName(annotation.name, (candidate) =>
            annotationNames.has(candidate)
          );
          annotationNames.add(annotation.name);
        }
        data.annotation = annotation;

        newNodes.push({
          ...node,
          id,
          position: { x: node.position.x + offset, y: node.position.y + offset },
          data,
          // A pasted copy keeps its lock and hide flags; locked notes are
          // unselectable and hidden ones invisible, so only unlocked, visible
          // copies join the fresh selection.
          selected: !annotation.locked && !annotation.hidden,
          ...annotationNodeFlags(annotation),
        });
      }

      // Handle ids embed the node id (`{nodeId}-port-{n}`): swap the prefix,
      // keep the port number.
      const remapHandle = (
        handle: string | null | undefined,
        oldNodeId: string,
        newNodeId: string
      ): string | undefined => {
        if (!handle) return undefined;
        return handle.startsWith(oldNodeId)
          ? `${newNodeId}${handle.slice(oldNodeId.length)}`
          : handle;
      };

      const takenEdgeIds = new Set(state.edges.map((edge) => edge.id));
      const newEdges: Edge[] = [];
      const newEdgeStates: Record<string, EdgeRuntimeState> = {};

      for (const edge of edges) {
        const source = idMap[edge.source];
        const target = idMap[edge.target];
        if (!source || !target) continue;
        const sourceHandle = remapHandle(edge.sourceHandle, edge.source, source);
        const targetHandle = remapHandle(edge.targetHandle, edge.target, target);
        // Mirror reactflow's addEdge id format; fresh endpoints make it unique.
        let id = `reactflow__edge-${source}${sourceHandle ?? ''}-${target}${targetHandle ?? ''}`;
        while (takenEdgeIds.has(id)) {
          id = `${id}-${generateRandomSuffix()}`;
        }
        takenEdgeIds.add(id);

        const defaults = buildDefaultParameters(edgeInfo[edge.type!]?.parameters);
        const parameters = {
          ...defaults,
          ...deepClone(clip.edgeStates[edge.id]?.parameters ?? {}),
        };
        if ('index' in parameters) parameters.index = defaults.index;

        newEdgeStates[id] = { parameters };
        newEdges.push({ ...edge, id, source, target, sourceHandle, targetHandle, selected: true });
      }

      const newModelNodeIds = modelNodes.map((node) => idMap[node.id]);
      set((s) => ({
        nodes: [...s.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)), ...newNodes],
        edges: [...s.edges.map((e) => (e.selected ? { ...e, selected: false } : e)), ...newEdges],
        nodeStates: { ...s.nodeStates, ...newNodeStates },
        edgeStates: { ...s.edgeStates, ...newEdgeStates },
        totalNodeCounters,
        nodeCounters,
        // Mirror addNode: focus the properties panel only when the paste is a
        // single model element.
        selectedNodeId:
          newNodes.length === 1 && newModelNodeIds.length === 1 ? newModelNodeIds[0] : null,
        selectedEdgeId: null,
      }));

      return newNodes.length + newEdges.length;
    },

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

      // Annotations are serialized into their own top-level section; the model
      // and uiAttributes sections carry model elements only.
      const modelNodes = state.nodes.filter((node) => !isAnnotationNode(node));
      const annotations: SaveFileAnnotation[] = state.nodes.filter(isAnnotationNode).map((node) => {
        const annotation = (node.data?.annotation ?? { text: '', style: {} }) as AnnotationData;
        const kind = annotation.kind ?? 'text';
        return {
          id: node.id,
          kind,
          position: node.position,
          ...(kind === 'text' ? { text: annotation.text } : {}),
          ...(kind === 'image' && annotation.src ? { src: annotation.src } : {}),
          ...(annotation.layer === 'back' ? { layer: 'back' as const } : {}),
          ...(annotation.name ? { name: annotation.name } : {}),
          ...(annotation.locked ? { locked: true } : {}),
          ...(annotation.hidden ? { hidden: true } : {}),
          ...(annotation.rotation ? { rotation: annotation.rotation } : {}),
          ...(Object.keys(annotation.style).length > 0 ? { style: annotation.style } : {}),
        };
      });

      return {
        version: SAVE_FILE_VERSION,
        timestamp: new Date().toISOString(),
        meta: { title: state.title },
        ...(savedDatasets.length > 0 ? { data: { datasets: savedDatasets } } : {}),
        model: {
          id: state.model?.id,
          globalAttributes: { ...state.modelParameters },
          nodes: modelNodes.map((node) => ({
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
        ...(annotations.length > 0 ? { annotations } : {}),
        uiAttributes: {
          nodes: modelNodes.map((node) => ({
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
        // Verify on save: surface any validity problems before writing the file
        // and block on hard errors (e.g. a missing required parameter the solver
        // cannot read) unless the user explicitly opts to save anyway.
        const { nodes, edges, nodeStates, edgeStates, model, modelParameters } = get();
        const issues = checkNetworkValidity({
          nodes,
          edges,
          nodeStates,
          edgeStates,
          model,
          modelParameters,
        });
        if (issues.length > 0) {
          const { nodeIds, edgeIds } = collectHighlightTargets(issues);
          get().setHighlightedNodes(nodeIds);
          get().setHighlightedEdges(edgeIds);
          issues.forEach((issue) =>
            issue.severity === 'error'
              ? logger.error(`• ${issue.message}`)
              : logger.warn(`• ${issue.message}`)
          );

          const errorCount = issues.filter((issue) => issue.severity === 'error').length;
          if (errorCount > 0) {
            const proceed = window.confirm(
              `The network has ${errorCount} validation error${errorCount === 1 ? '' : 's'} ` +
                `(see the console — e.g. missing required parameters). Save anyway?`
            );
            if (!proceed) {
              logger.warn('Save cancelled: resolve the validation errors first.');
              return;
            }
          }
        }

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
      const elementInfo = get().model?.elementInfo ?? EMPTY_ELEMENT_INFO;

      const uiNodeById = new Map(
        (saveData.uiAttributes?.nodes ?? []).map((uiNode) => [uiNode.id, uiNode])
      );

      const forceUniqueLabels = get().model?.forceUniqueNodeLabels ?? false;
      const usedLabels = new Set<string>();
      const newNodeStates: Record<string, NodeRuntimeState> = {};
      saveData.model.nodes.forEach((node) => {
        // Saved attributes overlay the template defaults: YAML never carries
        // required-but-unset fields (undefined keys are dropped on dump), so
        // starting from the defaults restores those keys and the properties
        // pane keeps showing their input boxes.
        const parameters = {
          ...buildDefaultParameters(elementInfo[node.type]?.parameters),
          ...(node.attributes ?? {}),
        };
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
        const edgeTemplate = edgeInfo[edge.type || getDefaultEdgeType(get().model)];
        if (!edgeTemplate) {
          logger.warn(
            `Edge "${edge.id}": template not found for type "${edge.type}"; ` +
              `using the saved attributes as-is.`
          );
        }
        // Saved attributes overlay the template defaults (see the node states
        // above): required-but-unset fields never reach the YAML, so the
        // defaults restore their keys and the properties pane keeps showing
        // their input boxes.
        newEdgeStates[edge.id] = {
          parameters: {
            ...(edgeTemplate ? buildDefaultParameters(edgeTemplate.parameters) : {}),
            ...(edge.attributes ?? {}),
          },
        };
      });

      const newEdges: Edge[] = modelEdges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        type: edge.type,
      }));

      // Annotations restore onto the presentation layer; they have no
      // model/nodeStates entries.
      const annotationNodes: Node[] = (saveData.annotations ?? []).map((a) => {
        const layer: AnnotationLayer = a.layer === 'back' ? 'back' : 'front';
        const annotation: AnnotationData = {
          kind: a.kind ?? 'text',
          text: a.text ?? '',
          style: a.style ?? {},
          ...(a.src ? { src: a.src } : {}),
          layer,
          ...(a.name ? { name: a.name } : {}),
          ...(a.locked ? { locked: true } : {}),
          ...(a.hidden ? { hidden: true } : {}),
          ...(a.rotation ? { rotation: a.rotation } : {}),
        };
        return {
          id: a.id,
          type: ANNOTATION_NODE_TYPE,
          position: a.position ?? { x: 0, y: 0 },
          data: { annotation },
          ...annotationNodeFlags(annotation),
        };
      });

      set({
        modelParameters: mergeModelParameters(get().model, saveData.model.globalAttributes),
        nodeStates: newNodeStates,
        nodes: [...newNodes, ...annotationNodes],
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
