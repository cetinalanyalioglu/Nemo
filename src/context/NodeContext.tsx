import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import type { ChangeEvent as ReactChangeEvent } from 'react';
import type { Connection, Edge, Node, XYPosition } from 'reactflow';
import { useNodesState, useEdgesState, addEdge } from 'reactflow';
import yaml from 'js-yaml';
import { debugLog } from '../utils/debug';
import { useModel } from './ModelContext';
import { useCanvasHistory } from '../hooks/useCanvasHistory';
import type { CanvasSnapshot } from '../hooks/useCanvasHistory';
import type {
  EditingState,
  EdgeRuntimeState,
  ElementInfoEntry,
  EdgeInfoEntry,
  NodeRuntimeState,
  ParameterChangeHandler,
  SaveFilePayload,
} from '../types/flow';

// Define save file version at module level
const SAVE_FILE_VERSION = '2.0.0';

// Stable fallbacks used while the active model is still loading.
const EMPTY_ELEMENT_INFO: Record<string, ElementInfoEntry> = {};
const EMPTY_EDGE_INFO: Record<string, EdgeInfoEntry> = {};

export interface NodeContextValue {
  nodeStates: Record<string, NodeRuntimeState>;
  editingStates: Record<string, EditingState>;
  nodeCounters: Record<string, number>;
  totalNodeCounters: Record<string, number>;
  nodes: Node[];
  edges: Edge[];
  onNodesChange: ReturnType<typeof useNodesState>[2];
  onEdgesChange: ReturnType<typeof useEdgesState>[2];
  setNodes: ReturnType<typeof useNodesState>[1];
  setEdges: ReturnType<typeof useEdgesState>[1];
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
  startEditing: (nodeId: string) => void;
  onChange: (nodeId: string, evt: ReactChangeEvent<HTMLInputElement>) => void;
  onKeyDown: (nodeId: string, event: React.KeyboardEvent<HTMLInputElement>) => void;
  finishEditing: (nodeId: string) => void;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedEdgeId: React.Dispatch<React.SetStateAction<string | null>>;
  isValidConnection: (connection: Connection) => boolean;
  saveToFile: () => void;
  generateSaveData: () => SaveFilePayload;
  loadFromFile: (file: File) => void;
  edgeStates: Record<string, EdgeRuntimeState>;
  addCustomEdge: (params: Connection, type?: string) => void;
  deleteEdge: (edgeId: string) => void;
  updateEdges: (newEdges: Edge[], removedEdgeIds?: string[]) => void;
  regenerateSolverIndices: () => void;
  /** Records a snapshot of the current canvas before an external mutation. */
  recordHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const NodeContext = createContext<NodeContextValue | undefined>(undefined);

export const NodeProvider = ({ children }: { children: React.ReactNode }) => {
  // Active model provides the available node/edge definitions. Falls back to
  // empty maps while the first model is loading.
  const { model, models, setActiveModelId } = useModel();
  const elementInfo = model?.elementInfo ?? EMPTY_ELEMENT_INFO;
  const edgeInfo = model?.edgeInfo ?? EMPTY_EDGE_INFO;
  const modelId = model?.id;

  // Add selected node state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // ReactFlow states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Node states for parameters and editing
  const [nodeStates, setNodeStates] = useState<Record<string, NodeRuntimeState>>({});
  const [editingStates, setEditingStates] = useState<Record<string, EditingState>>({});
  // nodeCounters: tracks current count of nodes per type (decremented on delete)
  // totalNodeCounters: tracks total nodes ever created per type (never decremented, used for unique ID/label generation)
  const [nodeCounters, setNodeCounters] = useState<Record<string, number>>({});
  const [totalNodeCounters, setTotalNodeCounters] = useState<Record<string, number>>({});

  // Add edgeStates for managing edge parameters
  const [edgeStates, setEdgeStates] = useState<Record<string, EdgeRuntimeState>>({});
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Undo/redo history of canvas snapshots.
  const {
    record: recordSnapshot,
    undo: undoHistory,
    redo: redoHistory,
    clear: clearHistory,
    canUndo,
    canRedo,
  } = useCanvasHistory();

  // Mirror of the live canvas state, kept in a ref so snapshot capture can read
  // the latest values without putting state in the capture callback's
  // dependencies. This keeps captureSnapshot/recordHistory (and the mutation
  // callbacks that depend on them) referentially stable, which is essential:
  // an unstable recordHistory would make GenericNode's dynamic-port effect
  // re-run on every node change and spin updateNodeInternals into a loop.
  const liveStateRef = useRef({
    nodes,
    edges,
    nodeStates,
    edgeStates,
    nodeCounters,
    totalNodeCounters,
  });
  useEffect(() => {
    liveStateRef.current = {
      nodes,
      edges,
      nodeStates,
      edgeStates,
      nodeCounters,
      totalNodeCounters,
    };
  }, [nodes, edges, nodeStates, edgeStates, nodeCounters, totalNodeCounters]);

  /**
   * Builds a serializable snapshot of the current canvas graph. Only the
   * fields needed for a full restore are captured, which naturally excludes
   * transient concerns like selection and viewport. Reads from a ref so the
   * callback stays referentially stable.
   */
  const captureSnapshot = useCallback((): CanvasSnapshot => {
    const { nodes, edges, nodeStates, edgeStates, nodeCounters, totalNodeCounters } =
      liveStateRef.current;
    return {
      nodes: nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: { ...node.position },
        data: { ...(node.data ?? {}) },
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? undefined,
        targetHandle: edge.targetHandle ?? undefined,
        type: edge.type,
      })),
      nodeStates: JSON.parse(JSON.stringify(nodeStates)),
      edgeStates: JSON.parse(JSON.stringify(edgeStates)),
      nodeCounters: { ...nodeCounters },
      totalNodeCounters: { ...totalNodeCounters },
    };
  }, []);

  /**
   * Replaces the live canvas state with a previously captured snapshot. Clears
   * editing and selection so no references dangle after a restore.
   */
  const applySnapshot = useCallback(
    (snapshot: CanvasSnapshot) => {
      setNodes(
        snapshot.nodes.map((node) => ({
          ...node,
          position: { ...node.position },
          data: { ...(node.data ?? {}) },
        }))
      );
      setEdges(snapshot.edges.map((edge) => ({ ...edge })));
      setNodeStates(JSON.parse(JSON.stringify(snapshot.nodeStates)));
      setEdgeStates(JSON.parse(JSON.stringify(snapshot.edgeStates)));
      setNodeCounters({ ...snapshot.nodeCounters });
      setTotalNodeCounters({ ...snapshot.totalNodeCounters });
      setEditingStates({});
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    [setNodes, setEdges]
  );

  // Records the current canvas as an undo step. Call before a mutation so the
  // pre-change state can be restored.
  const recordHistory = useCallback(() => {
    recordSnapshot(captureSnapshot());
  }, [recordSnapshot, captureSnapshot]);

  const undo = useCallback(() => {
    const target = undoHistory(captureSnapshot());
    if (target) applySnapshot(target);
  }, [undoHistory, captureSnapshot, applySnapshot]);

  const redo = useCallback(() => {
    const target = redoHistory(captureSnapshot());
    if (target) applySnapshot(target);
  }, [redoHistory, captureSnapshot, applySnapshot]);

  // Initialize counters when the active model becomes available and reset the
  // canvas whenever the model changes. Switching models clears any existing
  // nodes/edges so the canvas always reflects the selected model.
  useEffect(() => {
    if (!modelId) return;

    setNodes([]);
    setEdges([]);
    setNodeStates({});
    setEditingStates({});
    setEdgeStates({});
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    clearHistory();

    const initialCounters = Object.keys(elementInfo).reduce(
      (acc, type) => {
        acc[type] = 0;
        return acc;
      },
      {} as Record<string, number>
    );
    setNodeCounters(initialCounters);
    setTotalNodeCounters(initialCounters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // Create a Set of used labels for O(1) lookup performance
  const usedLabels = useMemo(() => {
    const labels = new Set<unknown>();
    Object.values(nodeStates).forEach((nodeState) => {
      if (nodeState?.parameters?.label) {
        labels.add(nodeState.parameters.label);
      }
    });
    return labels;
  }, [nodeStates]);

  /**
   * Private function to check if a label is already in use
   * Optimized to use Set for O(1) lookup
   */
  const isLabelInUse = useCallback(
    (label: unknown) => {
      return usedLabels.has(label);
    },
    [usedLabels]
  );

  /**
   * Private function to check if an id is already in use
   * Already O(1) using hasOwnProperty
   */
  const isIdInUse = useCallback(
    (id: string) => {
      return Object.prototype.hasOwnProperty.call(nodeStates, id);
    },
    [nodeStates]
  );

  /**
   * Private function to generate a random string of specified length
   */
  const generateRandomSuffix = (length: number = 3) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  /**
   * Private function to generate unique node id
   * Format: {FULL_TYPE_NAME}-{COUNTER}-{RANDOM_SUFFIX}
   * Example: MassFlowInlet-1-x7k
   */
  const getNewNodeId = useCallback(
    (type: string) => {
      // Get the current counter for this type
      const counter = totalNodeCounters[type] || 0;

      // Generate a random suffix
      const suffix = generateRandomSuffix();

      // Combine to create the new ID using full type name
      let newId = `${type}${counter + 1}-${suffix}`;

      // In the unlikely case of a collision, regenerate with a new suffix
      while (isIdInUse(newId)) {
        newId = `${type}-${counter + 1}-${generateRandomSuffix()}`;
      }

      return newId;
    },
    [totalNodeCounters, isIdInUse]
  );

  /**
   * Private function to generate unique node label
   */
  const getNewNodeLabel = useCallback(
    (type: string) => {
      const currentCount = totalNodeCounters[type] || 0;
      const nextCount = currentCount + 1;
      const defaultLabel = elementInfo[type]?.parameters?.label?.defaultValue;

      if (defaultLabel === undefined || defaultLabel === null) {
        throw new Error(`Default label not found for node type: ${type}`);
      }

      let newLabel = `${String(defaultLabel)}${nextCount}`;

      // Check if label is already in use
      if (isLabelInUse(newLabel)) {
        console.error(`Label "${newLabel}" is already in use.`);
      }

      return newLabel;
    },
    [totalNodeCounters, isLabelInUse, elementInfo]
  );

  /**
   * Validates if a connection between two nodes is allowed
   * Simplified to only check:
   * - Connection from "out" port (source) to "in" port (target) - enforced by ReactFlow handle types
   * - One connection per port
   * - A node can't connect to itself
   *
   * @param {Object} connection - The connection parameters
   * @returns {boolean} - Whether the connection is valid
   */
  const isValidConnection = useCallback(
    (connection: Connection) => {
      // Check if handles exist (ReactFlow enforces source/target handle types)
      if (!connection.sourceHandle || !connection.targetHandle) {
        debugLog('Invalid connection: No source or target handle');
        return false;
      }

      // Check that a node can't connect to itself
      if (connection.source === connection.target) {
        debugLog('Invalid connection: Source and target are the same');
        return false;
      }

      // Check that each port can only have one connection
      const existingEdges = edges.filter(
        (edge) =>
          edge.sourceHandle === connection.sourceHandle ||
          edge.targetHandle === connection.targetHandle
      );

      if (existingEdges.length > 0) {
        debugLog('Invalid connection: Port is already connected');
        return false;
      }

      return true;
    },
    [edges]
  );

  /**
   * updateNodeParameter updates a specific parameter of a node.
   * It also triggers any parameter change handlers defined in the node's elementInfo.
   *
   * @param {string} nodeId - The id of the node to update.
   * @param {string} paramName - The name of the parameter to update.
   * @param {*} value - The new value for the parameter.
   * @returns {boolean} - Whether the update was successful
   */
  const updateNodeParameter = useCallback(
    (
      nodeId: string,
      paramName: string,
      value: unknown,
      options: { recordHistory?: boolean } = {}
    ) => {
      const { recordHistory: shouldRecord = true } = options;
      // Get the node's current state and type
      const node = nodes.find((n) => n.id === nodeId);
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

      // Get the current value before update
      const oldValue = nodeStates[nodeId]?.parameters[paramName];

      // If the value hasn't changed, no need to proceed
      if (oldValue === value) {
        return true;
      }

      // Get parameter change handlers
      const handlers: Record<string, ParameterChangeHandler> = (nodeElementInfo.onParameterChange ||
        {}) as Record<string, ParameterChangeHandler>;
      const specificHandler = handlers[paramName];
      const defaultHandler = handlers['*'];

      if (specificHandler || defaultHandler) {
        // Create a temporary state with the new value for validation
        const tempNodeStates = {
          ...nodeStates,
          [nodeId]: {
            ...nodeStates[nodeId],
            parameters: {
              ...nodeStates[nodeId]?.parameters,
              [paramName]: value,
            },
          },
        };

        // Call specific handler if it exists
        if (specificHandler) {
          const result = specificHandler(
            nodeId,
            paramName,
            value,
            oldValue,
            tempNodeStates,
            edges,
            edgeStates
          );
          if (!result.isValid) {
            debugLog(`Parameter change rejected by specific handler: ${result.reason}`);
            return false;
          }
        }

        // Call default handler if it exists
        if (defaultHandler) {
          const result = defaultHandler(
            nodeId,
            paramName,
            value,
            oldValue,
            tempNodeStates,
            edges,
            edgeStates
          );
          if (!result.isValid) {
            debugLog(`Parameter change rejected by default handler: ${result.reason}`);
            return false;
          }
        }
      }

      // If we get here, all validations passed, update the state
      if (shouldRecord) {
        recordHistory();
      }
      setNodeStates((prev) => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          parameters: {
            ...prev[nodeId]?.parameters,
            [paramName]: value,
          },
        },
      }));

      return true;
    },
    [nodes, nodeStates, edges, edgeStates, elementInfo, recordHistory]
  );

  /**
   * startEditing marks a node as being edited and initializes its temporary value.
   *
   * @param {string} nodeId - The id of the node that is starting to be edited.
   */
  const startEditing = useCallback(
    (nodeId: string) => {
      setEditingStates((prev) => ({
        ...prev,
        [nodeId]: {
          isEditing: true,
          tempLabel: String(nodeStates[nodeId]?.parameters?.label || ''),
        },
      }));
    },
    [nodeStates]
  );

  /**
   * onChange updates the temporary editing value as the user modifies it.
   */
  const onChange = useCallback((nodeId: string, evt: ReactChangeEvent<HTMLInputElement>) => {
    setEditingStates((prev) => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        tempLabel: evt.target.value,
      },
    }));
  }, []);

  /**
   * finishEditing finalizes the editing process by updating the node's label if a new non-empty
   * value exists, and then resets the editing state for that node.
   */
  const finishEditing = useCallback(
    (nodeId: string) => {
      setEditingStates((prev) => {
        const newLabel = prev[nodeId]?.tempLabel?.trim();
        if (newLabel) {
          updateNodeParameter(nodeId, 'label', newLabel);
        }
        return {
          ...prev,
          [nodeId]: {
            isEditing: false,
            tempLabel: '',
          },
        };
      });
    },
    [updateNodeParameter]
  );

  /**
   * Handles keyboard events during label editing
   */
  const onKeyDown = useCallback(
    (nodeId: string, event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finishEditing(nodeId);
      }
      // Escape tuşu ile düzenlemeyi iptal et
      if (event.key === 'Escape') {
        setEditingStates((prev) => ({
          ...prev,
          [nodeId]: {
            isEditing: false,
            tempLabel: '',
          },
        }));
      }
    },
    [finishEditing]
  );

  // Add node function that handles both node creation and registration
  const addNode = useCallback(
    ({
      type,
      position = { x: 0, y: 0 },
      data = {},
      parameters = {},
    }: {
      type: string;
      position?: XYPosition;
      data?: Record<string, unknown>;
      parameters?: Record<string, unknown>;
    }) => {
      debugLog('Adding node with type: ', type);

      if (!type) {
        console.error('Cannot add node: Node type is required');
        return;
      }

      // Get node template from elementInfo
      const nodeTemplate = elementInfo[type];
      if (!nodeTemplate) {
        console.error(`Cannot add node: Element info not found for type "${type}"`);
        return;
      }

      recordHistory();

      // Update counters first to ensure proper label generation
      setTotalNodeCounters((prev) => ({
        ...prev,
        [type]: prev[type] + 1,
      }));

      // Generate unique node ID and label
      const id = getNewNodeId(type);
      const label = getNewNodeLabel(type);

      // Get default parameters from elementInfo
      const defaultParameters: Record<string, unknown> = {};
      for (const key in nodeTemplate.parameters) {
        defaultParameters[key] = nodeTemplate.parameters[key].defaultValue;
      }

      // Merge provided parameters with defaults and override label
      const mergedParameters = {
        ...defaultParameters,
        ...parameters,
        label: label,
      };

      // Create the nodeState for node creation
      const nodeState = {
        parameters: mergedParameters,
      };

      // Register node state
      setNodeStates((prev) => ({
        ...prev,
        [id]: nodeState,
      }));

      // Create the node for ReactFlow
      const newNode: Node = {
        id,
        type,
        position,
        data: {
          ...data,
        },
      };

      // Update nodes in ReactFlow
      setNodes((nodes) => [...nodes, newNode]);

      // Update selected node
      setSelectedNodeId(newNode.id);

      // Update current counter
      setNodeCounters((prev) => ({
        ...prev,
        [type]: (prev[type] || 0) + 1,
      }));

      debugLog('Successfully added node: ', newNode);

      return newNode;
    },
    [getNewNodeId, getNewNodeLabel, setNodes, elementInfo, recordHistory]
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      debugLog('Deleting node with id: ', nodeId);

      if (!nodeId) {
        console.error('Cannot delete node: No node ID provided');
        return;
      }

      // Get node info before deletion
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.error(`Cannot delete node: Node not found for ID ${nodeId}`);
        return;
      }

      const type = node.type!;

      recordHistory();

      // Find and delete all edges connected to this node
      setEdges((eds) => {
        const connectedEdges = eds.filter(
          (edge) => edge.source === nodeId || edge.target === nodeId
        );

        // Clean up edge states for connected edges
        if (connectedEdges.length > 0) {
          setEdgeStates((prev) => {
            const newStates = { ...prev };
            connectedEdges.forEach((edge) => {
              delete newStates[edge.id];
            });
            return newStates;
          });
        }

        // Return edges without the connected ones
        return eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId);
      });

      // Update only the current counter
      setNodeCounters((prev) => ({
        ...prev,
        [type]: Math.max(0, prev[type] - 1),
      }));

      // Remove from nodeStates
      setNodeStates((prev) => {
        const newStates = { ...prev };
        delete newStates[nodeId];
        return newStates;
      });

      // Remove from editingStates
      setEditingStates((prev) => {
        const newStates = { ...prev };
        delete newStates[nodeId];
        return newStates;
      });

      // Remove node from ReactFlow
      setNodes((nodes) => nodes.filter((node) => node.id !== nodeId));

      // Clear selection if deleted node was selected
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }

      debugLog('Successfully deleted node: ', nodeId);
    },
    [nodes, setNodes, selectedNodeId, setEdges, setEdgeStates, recordHistory]
  );

  /**
   * Removes all nodes and resets all states to their initial values
   */
  const reset = useCallback(() => {
    debugLog('Resetting all nodes and states ...');

    // Clear all nodes
    setNodes([]);

    // Clear all edges
    setEdges([]);

    // Reset node states
    setNodeStates({});

    // Reset edge states
    setEdgeStates({});

    // Reset editing states
    setEditingStates({});

    // Reset current node counters
    setNodeCounters((prev) => {
      return Object.keys(prev).reduce(
        (acc, key) => {
          acc[key] = 0;
          return acc;
        },
        {} as Record<string, number>
      );
    });

    // Clear selected node
    setSelectedNodeId(null);

    // Clear selected edge
    setSelectedEdgeId(null);

    // A new/blank document or a freshly loaded file starts a clean history.
    clearHistory();

    debugLog('All nodes and states have been cleared');
  }, [setNodes, setEdges, setEdgeStates, clearHistory]);

  // Define updateEdgeParameter similar to updateNodeParameter
  const updateEdgeParameter = useCallback(
    (edgeId: string, paramName: string, value: unknown) => {
      // Skip no-op updates so they do not create empty undo steps.
      if (edgeStates[edgeId]?.parameters?.[paramName] === value) {
        return;
      }

      recordHistory();
      setEdgeStates((prev) => ({
        ...prev,
        [edgeId]: {
          ...prev[edgeId],
          parameters: {
            ...prev[edgeId]?.parameters,
            [paramName]: value,
          },
        },
      }));
    },
    [edgeStates, recordHistory]
  );

  /**
   * Generates optimized node and edge indices for the solver.
   * The indexing strategy aims to:
   * 1. Keep connected nodes close in index space to minimize Jacobian bandwidth
   * 2. Index edges based on their connected nodes to maintain locality
   *
   * @returns {Object} Object containing updated node and edge states with solver indices
   */
  const generateSolverIndices = useCallback(() => {
    const nodeIndexMap: Record<string, number> = {};
    const edgeIndexMap: Record<string, number> = {};
    let currentNodeIndex = 0;
    let currentEdgeIndex = 0;

    // Create deep copies of current states
    const updatedNodeStates = JSON.parse(JSON.stringify(nodeStates)) as Record<
      string,
      NodeRuntimeState
    >;
    const updatedEdgeStates = JSON.parse(JSON.stringify(edgeStates)) as Record<
      string,
      EdgeRuntimeState
    >;

    // Create an adjacency list representation of the network
    const adjacencyList: Record<string, { connectedNodes: Set<string>; edges: Edge[] }> = {};
    nodes.forEach((node) => {
      adjacencyList[node.id] = {
        connectedNodes: new Set(),
        edges: [],
      };
    });

    // Build the adjacency information
    edges.forEach((edge) => {
      adjacencyList[edge.source].connectedNodes.add(edge.target);
      adjacencyList[edge.target].connectedNodes.add(edge.source);
      adjacencyList[edge.source].edges.push(edge);
      adjacencyList[edge.target].edges.push(edge);
    });

    // Helper function for BFS traversal
    const bfs = (startNodeId: string) => {
      const queue: string[] = [startNodeId];
      const visited = new Set([startNodeId]);

      while (queue.length > 0) {
        const currentId = queue.shift()!;

        // Assign index to this node if not already assigned
        if (!(currentId in nodeIndexMap)) {
          nodeIndexMap[currentId] = currentNodeIndex++;
          // Update the node's solver index parameter in our copy
          if (updatedNodeStates[currentId]) {
            updatedNodeStates[currentId].parameters.solverIndex = nodeIndexMap[currentId];
          }
        }

        // Index all edges connected to this node that haven't been indexed yet
        for (const edge of adjacencyList[currentId].edges) {
          if (!(edge.id in edgeIndexMap)) {
            edgeIndexMap[edge.id] = currentEdgeIndex++;
            if (updatedEdgeStates[edge.id]) {
              updatedEdgeStates[edge.id].parameters.solverIndex = edgeIndexMap[edge.id];
            }
          }
        }

        // Add unvisited neighbors to queue
        adjacencyList[currentId].connectedNodes.forEach((neighborId) => {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            queue.push(neighborId);
          }
        });
      }
    };

    // Process all nodes using BFS, starting new traversals for unvisited components
    const unvisitedNodes = new Set(nodes.map((node) => node.id));
    while (unvisitedNodes.size > 0) {
      const startNode = unvisitedNodes.values().next().value!;
      bfs(startNode);
      // Remove all nodes that were visited in this BFS traversal
      Object.keys(nodeIndexMap).forEach((id) => unvisitedNodes.delete(id));
    }

    return {
      updatedNodeStates,
      updatedEdgeStates,
    };
  }, [nodes, edges, nodeStates, edgeStates]);

  /**
   * Regenerates solver indices and commits them to live state so the
   * properties panel reflects the updated values immediately.
   */
  const regenerateSolverIndices = useCallback(() => {
    recordHistory();
    const { updatedNodeStates, updatedEdgeStates } = generateSolverIndices();
    setNodeStates(updatedNodeStates);
    setEdgeStates(updatedEdgeStates);
  }, [generateSolverIndices, recordHistory]);

  /**
   * Builds the complete, restorable save payload.
   *
   * Model data (the simulation graph: node/edge identity, topology and runtime
   * parameters) and UI data (presentation: node positions and ReactFlow data)
   * are kept in separate sections so the two concerns can evolve independently
   * while together describing everything needed for a full restore.
   *
   * @returns {SaveFilePayload} The complete save payload.
   */
  const generateSaveData = useCallback((): SaveFilePayload => {
    // Generate solver indices and get updated states
    const { updatedNodeStates, updatedEdgeStates } = generateSolverIndices();

    return {
      version: SAVE_FILE_VERSION,
      timestamp: new Date().toISOString(),
      model: {
        id: modelId,
        globalAttributes: {},
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type!,
          attributes: updatedNodeStates[node.id]?.parameters ?? {},
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? null,
          targetHandle: edge.targetHandle ?? null,
          type: edge.type,
          attributes: updatedEdgeStates[edge.id]?.parameters ?? {},
        })),
      },
      uiAttributes: {
        nodes: nodes.map((node) => ({
          id: node.id,
          position: node.position,
          data: node.data,
        })),
      },
      uiState: {
        counters: {
          nodeCounters,
          totalNodeCounters,
        },
      },
    };
  }, [nodes, edges, nodeCounters, totalNodeCounters, generateSolverIndices, modelId]);

  /**
   * Serializes the current state to a YAML file and triggers a download.
   */
  const saveToFile = useCallback(() => {
    try {
      const saveData = generateSaveData();

      // Serialize to YAML, preserving key insertion order and avoiding
      // anchors/aliases and line wrapping for a clean, diff-friendly file.
      const yamlString = yaml.dump(saveData, {
        noRefs: true,
        sortKeys: false,
        lineWidth: -1,
      });

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
  }, [generateSaveData]);

  /**
   * Applies a validated save payload to the canvas, replacing any current
   * state. Assumes the matching model definition is already active so that
   * node/edge types resolve correctly.
   *
   * @param {SaveFilePayload} saveData - A validated save payload.
   */
  const applySaveData = useCallback(
    (saveData: SaveFilePayload) => {
      // Reset current state
      reset();

      // Index UI data by node id so model and presentation data can be
      // recombined into ReactFlow nodes.
      const uiNodeById = new Map(
        (saveData.uiAttributes?.nodes ?? []).map((uiNode) => [uiNode.id, uiNode])
      );

      // Restore node states (the runtime parameter bag) first.
      const newNodeStates: Record<string, NodeRuntimeState> = {};
      saveData.model.nodes.forEach((node) => {
        newNodeStates[node.id] = { parameters: node.attributes ?? {} };
      });
      setNodeStates(newNodeStates);

      // Recombine model + UI data into ReactFlow nodes.
      setNodes(
        saveData.model.nodes.map((node) => {
          const ui = uiNodeById.get(node.id);
          return {
            id: node.id,
            type: node.type,
            position: ui?.position ?? { x: 0, y: 0 },
            data: ui?.data ?? {},
          };
        })
      );

      const modelEdges = saveData.model.edges ?? [];

      // Restore edge states, falling back to template defaults when a saved
      // edge carries no attributes.
      const newEdgeStates: Record<string, EdgeRuntimeState> = {};
      modelEdges.forEach((edge) => {
        if (edge.attributes) {
          newEdgeStates[edge.id] = { parameters: edge.attributes };
        } else {
          const edgeTemplate = edgeInfo[edge.type || 'flow'];
          if (!edgeTemplate) {
            console.warn(`Edge template not found for type ${edge.type}, using flow type`);
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
      setEdgeStates(newEdgeStates);

      // Rebuild ReactFlow edges from the model topology.
      setEdges(
        modelEdges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle ?? undefined,
          targetHandle: edge.targetHandle ?? undefined,
          type: edge.type,
        }))
      );

      // Restore counters
      setNodeCounters(saveData.uiState?.counters?.nodeCounters ?? {});
      setTotalNodeCounters(saveData.uiState?.counters?.totalNodeCounters ?? {});

      debugLog('Successfully loaded canvas state from file');
      if (saveData.timestamp) {
        debugLog('File was saved on: ' + new Date(saveData.timestamp).toLocaleString());
      }
    },
    [
      reset,
      setNodes,
      setEdges,
      setNodeStates,
      setNodeCounters,
      setTotalNodeCounters,
      setEdgeStates,
      edgeInfo,
    ]
  );

  // Holds a parsed payload whose target model is still loading. Once the model
  // selector switches and the new model finishes loading, the deferred-apply
  // effect below restores it.
  const pendingLoadRef = useRef<SaveFilePayload | null>(null);

  // Applies a deferred load once its target model has finished loading.
  //
  // Switching the active model triggers a canvas reset (see the model-change
  // effect above). This effect is declared afterwards so that, within the same
  // commit, the reset runs first and the restored data wins.
  useEffect(() => {
    const pending = pendingLoadRef.current;
    if (!pending) return;
    if (modelId !== pending.model.id) return;
    pendingLoadRef.current = null;
    applySaveData(pending);
  }, [modelId, applySaveData]);

  /**
   * Loads and restores the canvas state from a YAML save file.
   *
   * If the file targets a model that is not in the available models, the load
   * is refused and the current canvas is left untouched. When the target model
   * differs from the active one, the model selector is switched and the data is
   * applied once the new model finishes loading.
   *
   * @param {File} file - The YAML file to load
   */
  const loadFromFile = useCallback(
    (file: File) => {
      const reader = new FileReader();

      reader.onload = (event: ProgressEvent<FileReader>) => {
        try {
          const raw = event.target?.result;
          if (typeof raw !== 'string') {
            throw new Error('Invalid file contents');
          }

          const saveData = yaml.load(raw) as SaveFilePayload | null;

          // Check version compatibility
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

          // Refuse the load when the target model is unavailable, leaving the
          // current canvas untouched.
          const targetModelId = saveData.model.id;
          if (targetModelId && !models.some((m) => m.id === targetModelId)) {
            pendingLoadRef.current = null;
            throw new Error(
              `The model "${targetModelId}" required by this file is not available. ` +
                'Load cancelled.'
            );
          }

          if (!targetModelId || targetModelId === modelId) {
            // Target model is already active: apply immediately.
            pendingLoadRef.current = null;
            applySaveData(saveData);
          } else {
            // Switch the model selector and defer the restore until the new
            // model has loaded.
            pendingLoadRef.current = saveData;
            setActiveModelId(targetModelId);
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
    [models, modelId, setActiveModelId, applySaveData]
  );

  /**
   * Adds a new edge to the flow diagram and initializes its state.
   *
   * @param {Object} params - Edge connection parameters
   * @param {string} params.source - ID of the source node
   * @param {string} params.target - ID of the target node
   * @param {string} params.sourceHandle - ID of the source port
   * @param {string} params.targetHandle - ID of the target port
   * @param {string} [type='flow'] - Type of the edge to create
   * @returns {Object} The newly created edge
   */
  const addCustomEdge = useCallback(
    (params: Connection, type: string = 'flow') => {
      // Get edge template from edgeInfo
      const edgeTemplate = edgeInfo[type];
      if (!edgeTemplate) {
        console.error(`Cannot add edge: Edge info not found for type "${type}"`);
        return;
      }

      // Get default parameters from edgeInfo
      const defaultParameters: Record<string, unknown> = {};
      for (const key in edgeTemplate.parameters) {
        defaultParameters[key] = edgeTemplate.parameters[key].defaultValue;
      }

      // Create the edge state with default parameters
      const edgeState: EdgeRuntimeState = {
        parameters: {
          ...defaultParameters,
        },
      };

      recordHistory();

      // Add the edge to ReactFlow
      setEdges((eds) => {
        const newEdges = addEdge({ ...params, type } as Connection & { type: string }, eds);
        const newEdge = newEdges[newEdges.length - 1]!;

        debugLog('Adding edge: ', newEdge);
        debugLog('Edge state: ', edgeState);

        // Register edge state
        setEdgeStates((prev) => ({
          ...prev,
          [newEdge.id]: edgeState,
        }));

        return newEdges;
      });
    },
    [setEdges, edgeInfo, recordHistory]
  );

  /**
   * Deletes an edge and cleans up its state.
   *
   * @param {string} edgeId - ID of the edge to delete
   */
  const deleteEdge = useCallback(
    (edgeId: string) => {
      recordHistory();
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));

      // Clean up edge state
      setEdgeStates((prev) => {
        const newStates = { ...prev };
        delete newStates[edgeId];
        return newStates;
      });
    },
    [setEdges, recordHistory]
  );

  /**
   * Updates multiple edges at once, maintaining their states.
   * Used for bulk operations like port reconfiguration.
   *
   * @param {Array} newEdges - Array of updated edges
   * @param {Array} removedEdgeIds - Array of edge IDs that were removed
   */
  const updateEdges = useCallback(
    (newEdges: Edge[], removedEdgeIds: string[] = []) => {
      recordHistory();
      setEdges(newEdges);

      // Clean up states for removed edges
      if (removedEdgeIds.length > 0) {
        setEdgeStates((prev) => {
          const newStates = { ...prev };
          removedEdgeIds.forEach((edgeId) => {
            delete newStates[edgeId];
          });
          return newStates;
        });
      }
    },
    [setEdges, recordHistory]
  );

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<NodeContextValue>(
    () => ({
      nodeStates,
      editingStates,
      nodeCounters,
      totalNodeCounters,
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      setNodes,
      setEdges,
      addNode,
      deleteNode,
      reset,
      updateNodeParameter,
      updateEdgeParameter,
      startEditing,
      onChange,
      onKeyDown,
      finishEditing,
      selectedNodeId,
      selectedEdgeId,
      setSelectedNodeId,
      setSelectedEdgeId,
      isValidConnection,
      saveToFile,
      generateSaveData,
      loadFromFile,
      edgeStates,
      addCustomEdge,
      deleteEdge,
      updateEdges,
      regenerateSolverIndices,
      recordHistory,
      undo,
      redo,
      canUndo,
      canRedo,
    }),
    [
      nodeStates,
      editingStates,
      nodeCounters,
      totalNodeCounters,
      nodes,
      edges,
      onNodesChange,
      onEdgesChange,
      setNodes,
      setEdges,
      addNode,
      deleteNode,
      reset,
      updateNodeParameter,
      updateEdgeParameter,
      startEditing,
      onChange,
      onKeyDown,
      finishEditing,
      selectedNodeId,
      selectedEdgeId,
      setSelectedNodeId,
      setSelectedEdgeId,
      isValidConnection,
      saveToFile,
      generateSaveData,
      loadFromFile,
      edgeStates,
      addCustomEdge,
      deleteEdge,
      updateEdges,
      regenerateSolverIndices,
      recordHistory,
      undo,
      redo,
      canUndo,
      canRedo,
    ]
  );

  return <NodeContext.Provider value={contextValue}>{children}</NodeContext.Provider>;
};

/**
 * useNodeContext is a custom hook that lets components access the node context.
 *
 * @returns {Object} The context value containing node states and CRUD functions.
 */
export const useNodeContext = () => {
  const context = useContext(NodeContext);
  if (!context) {
    throw new Error('useNodeContext must be used within a NodeProvider');
  }
  return context;
};

export default NodeContext;
