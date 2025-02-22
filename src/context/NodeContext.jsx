import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { elementInfo } from '../components/nodes/nodeTypes';
import { useNodesState, useEdgesState, addEdge } from 'reactflow';
import { debugLog } from '../utils/debug';
import { edgeInfo } from '../components/edges/edgeTypes';

// Define save file version at module level
const SAVE_FILE_VERSION = '1.0.0';

const NodeContext = createContext();

export const NodeProvider = ({ children }) => {
  // Add selected node state
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // ReactFlow states
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Node states for parameters and editing
  const [nodeStates, setNodeStates] = useState({});
  const [editingStates, setEditingStates] = useState({});
  const [nodeCounters, setNodeCounters] = useState({});
  const [totalNodeCounters, setTotalNodeCounters] = useState({});

  // Add edgeStates for managing edge parameters
  const [edgeStates, setEdgeStates] = useState({});
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);

  // Initialize counters when component mounts
  useEffect(() => {
    const initialCounters = Object.keys(elementInfo).reduce((acc, type) => {
      acc[type] = 0;
      return acc;
    }, {});
    setNodeCounters(initialCounters);
    setTotalNodeCounters(initialCounters);
  }, []);

  /**
   * Private function to check if a label is already in use
   */
  const isLabelInUse = useCallback(
    (label) => {
      return Object.values(nodeStates).some((nodeState) => nodeState.parameters.label === label);
    },
    [nodeStates]
  );

  /**
   * Private function to check if an id is already in use
   */
  const isIdInUse = useCallback(
    (id) => {
      return Object.prototype.hasOwnProperty.call(nodeStates, id);
    },
    [nodeStates]
  );

  /**
   * Private function to generate a random string of specified length
   */
  const generateRandomSuffix = (length = 3) => {
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
    (type) => {
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
    (type) => {
      const currentCount = totalNodeCounters[type] || 0;
      const nextCount = currentCount + 1;
      const defaultLabel = elementInfo[type]?.parameters?.label?.defaultValue;

      if (!defaultLabel) {
        throw new Error(`Default label not found for node type: ${type}`);
      }

      let newLabel = `${defaultLabel}${nextCount}`;

      // Check if label is already in use
      if (isLabelInUse(newLabel)) {
        console.error(`Label "${newLabel}" is already in use.`);
      }

      return newLabel;
    },
    [totalNodeCounters, isLabelInUse]
  );

  /**
   * Validates if a connection between two nodes is allowed
   *
   * @param {Object} connection - The connection parameters
   * @returns {boolean} - Whether the connection is valid
   */
  const isValidConnection = useCallback(
    (connection) => {
      if (!connection.sourceHandle || !connection.targetHandle) {
        debugLog('Invalid connection: No source or target handle');
        return false;
      }

      if (connection.source === connection.target) {
        debugLog('Invalid connection: Source and target are the same');
        return false;
      }

      const existingEdges = edges.filter(
        (edge) =>
          edge.sourceHandle === connection.sourceHandle ||
          edge.targetHandle === connection.targetHandle
      );

      if (existingEdges.length > 0) {
        debugLog('Invalid connection: Port is not empty');
        return false;
      }

      // Get source and target nodes and their states
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      const sourceNodeState = nodeStates[sourceNode.id];
      const targetNodeState = nodeStates[targetNode.id];

      if (!sourceNode || !targetNode) {
        debugLog('Invalid connection: Source or target node not found');
        return false;
      }

      // Create a temporary connection context
      const connectionContext = {
        parameters: {}, // Will hold edge parameters like area
        metadata: {}, // Any other metadata nodes might want to share
      };

      // Get node handlers
      const sourceHandler = elementInfo[sourceNode.type]?.onConnectionStart;
      const targetHandler = elementInfo[targetNode.type]?.onConnectionStart;

      // Warn if sourceHandler or targetHandler is not defined
      if (!sourceHandler) {
        console.warn(`No source handler defined for node type: ${sourceNode.type}`);
      }
      if (!targetHandler) {
        console.warn(`No target handler defined for node type: ${targetNode.type}`);
      }

      // Let nodes prepare the connection
      if (sourceHandler) {
        sourceHandler(
          connection,
          sourceNode,
          targetNode,
          sourceNodeState,
          targetNodeState,
          connectionContext
        );
      }
      if (targetHandler) {
        targetHandler(
          connection,
          sourceNode,
          targetNode,
          sourceNodeState,
          targetNodeState,
          connectionContext
        );
      }

      // Get node type validators
      const sourceValidator = elementInfo[sourceNode.type]?.isConnectionValid;
      const targetValidator = elementInfo[targetNode.type]?.isConnectionValid;

      // Warn if sourceValidator or targetValidator is not defined
      if (!sourceValidator) {
        console.warn(`No source validator defined for node type: ${sourceNode.type}`);
      }
      if (!targetValidator) {
        console.warn(`No target validator defined for node type: ${targetNode.type}`);
      }

      // Check source node's validation rules
      if (sourceValidator) {
        const sourceValidation = sourceValidator(
          connection,
          sourceNode,
          targetNode,
          sourceNodeState,
          targetNodeState,
          connectionContext,
          edges,
          edgeStates
        );
        if (!sourceValidation.isValid) {
          debugLog(`Invalid connection: ${sourceValidation.reason}`);
          return false;
        }
      }

      // Check target node's validation rules
      if (targetValidator) {
        const targetValidation = targetValidator(
          connection,
          sourceNode,
          targetNode,
          sourceNodeState,
          targetNodeState,
          connectionContext,
          edges,
          edgeStates
        );
        if (!targetValidation.isValid) {
          debugLog(`Invalid connection: ${targetValidation.reason}`);
          return false;
        }
      }

      // Store the connection context for edge creation
      connection.context = connectionContext;
      return true;
    },
    [edges, nodeStates, nodes, edgeStates]
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
    (nodeId, paramName, value) => {
      // Get the node's current state and type
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) {
        console.error(`Cannot update parameter: Node ${nodeId} not found`);
        return false;
      }

      const nodeType = node.type;
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
      const handlers = nodeElementInfo.onParameterChange || {};
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
    [nodes, nodeStates, edges, edgeStates]
  );

  /**
   * startEditing marks a node as being edited and initializes its temporary value.
   *
   * @param {string} nodeId - The id of the node that is starting to be edited.
   */
  const startEditing = (nodeId) => {
    setEditingStates((prev) => ({
      ...prev,
      [nodeId]: {
        isEditing: true,
        tempLabel: nodeStates[nodeId]?.parameters?.label || '',
      },
    }));
  };

  /**
   * onChange updates the temporary editing value as the user modifies it.
   *
   * @param {string} nodeId - The id of the node being edited.
   * @param {Object} evt - The event object containing the new value.
   */
  const onChange = (nodeId, evt) => {
    setEditingStates((prev) => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        tempLabel: evt.target.value,
      },
    }));
  };

  /**
   * finishEditing finalizes the editing process by updating the node's label if a new non-empty
   * value exists, and then resets the editing state for that node.
   *
   * @param {string} nodeId - The id of the node finishing editing.
   */
  const finishEditing = useCallback(
    (nodeId) => {
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
    (nodeId, event) => {
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
    ({ type, position = { x: 0, y: 0 }, data = {}, parameters = {} }) => {
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

      // Update counters first to ensure proper label generation
      setTotalNodeCounters((prev) => ({
        ...prev,
        [type]: prev[type] + 1,
      }));

      // Generate unique node ID and label
      const id = getNewNodeId(type);
      const label = getNewNodeLabel(type);

      // Get default parameters from elementInfo
      const defaultParameters = {};
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
      const newNode = {
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
    [getNewNodeId, getNewNodeLabel, setNodes]
  );

  const deleteNode = useCallback(
    (nodeId) => {
      debugLog('Deleting node with id: ', nodeId);

      if (!nodeId) {
        console.error('Cannot delete node: No node ID provided');
        return;
      }

      // Get node info before deletion
      const nodeState = nodeStates[nodeId];
      if (!nodeState) {
        console.error(`Cannot delete node: Node state not found for ID ${nodeId}`);
        return;
      }

      const type = nodeState.type;

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
    [nodeStates, setNodes, selectedNodeId, setEdges, setEdgeStates]
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

    // Reset editing states
    setEditingStates({});

    // Reset current node counters
    setNodeCounters((prev) => {
      return Object.keys(prev).reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {});
    });

    // Clear selected node
    setSelectedNodeId(null);

    // Clear selected edge
    setSelectedEdgeId(null);

    debugLog('All nodes and states have been cleared');
  }, [setNodes, setEdges]);

  // Define updateEdgeParameter similar to updateNodeParameter
  const updateEdgeParameter = useCallback((edgeId, paramName, value) => {
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
  }, []);

  /**
   * Generates optimized node and edge indices for the solver.
   * The indexing strategy aims to:
   * 1. Keep connected nodes close in index space to minimize Jacobian bandwidth
   * 2. Index edges based on their connected nodes to maintain locality
   *
   * @returns {Object} Object containing updated node and edge states with solver indices
   */
  const generateSolverIndices = useCallback(() => {
    const nodeIndexMap = {};
    const edgeIndexMap = {};
    let currentNodeIndex = 0;
    let currentEdgeIndex = 0;

    // Create deep copies of current states
    const updatedNodeStates = JSON.parse(JSON.stringify(nodeStates));
    const updatedEdgeStates = JSON.parse(JSON.stringify(edgeStates));

    // Create an adjacency list representation of the network
    const adjacencyList = {};
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
    const bfs = (startNodeId) => {
      const queue = [startNodeId];
      const visited = new Set([startNodeId]);

      while (queue.length > 0) {
        const currentId = queue.shift();

        // Assign index to this node if not already assigned
        if (!(currentId in nodeIndexMap)) {
          nodeIndexMap[currentId] = currentNodeIndex++;
          // Update the node's solver index parameter in our copy
          if (updatedNodeStates[currentId]) {
            updatedNodeStates[currentId].parameters.solverIndex = nodeIndexMap[currentId];
          }
        }

        // Index all edges connected to this node that haven't been indexed yet
        adjacencyList[currentId].edges.forEach((edge) => {
          if (!(edge.id in edgeIndexMap)) {
            edgeIndexMap[edge.id] = currentEdgeIndex++;
            // Update the edge's solver index parameter in our copy
            if (updatedEdgeStates[edge.id]) {
              updatedEdgeStates[edge.id].parameters.solverIndex = edgeIndexMap[edge.id];
            }
          }
        });

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
      const startNode = unvisitedNodes.values().next().value;
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
   * Generates a complete state object for saving
   * @returns {Object} The complete state object
   */
  const generateSaveData = useCallback(() => {
    // Generate solver indices and get updated states
    const { updatedNodeStates, updatedEdgeStates } = generateSolverIndices();

    const saveData = {
      version: SAVE_FILE_VERSION,
      timestamp: new Date().toISOString(),
      nodes: nodes.map((node) => {
        // Get the node's state from updated states
        const nodeState = updatedNodeStates[node.id];

        // Get all edges connected to this node
        const nodeEdges = edges.filter(
          (edge) => edge.source === node.id || edge.target === node.id
        );

        // Extract port information from actual connections
        const ports = {
          target: nodeEdges
            .filter((edge) => edge.target === node.id)
            .map((edge) => ({
              id: edge.targetHandle,
            })),
          source: nodeEdges
            .filter((edge) => edge.source === node.id)
            .map((edge) => ({
              id: edge.sourceHandle,
            })),
        };

        return {
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
          state: nodeState,
          ports: ports,
        };
      }),
      edges: edges.map((edge) => ({
        ...edge,
        state: updatedEdgeStates[edge.id],
      })),
      nodeCounters,
      totalNodeCounters,
    };

    return saveData;
  }, [nodes, edges, nodeCounters, totalNodeCounters, generateSolverIndices]);

  /**
   * Saves the current state to a JSON file
   */
  const saveToFile = useCallback(() => {
    try {
      const saveData = generateSaveData();

      // Convert the data to a JSON string
      const jsonString = JSON.stringify(saveData, null, 2);

      // Create a blob with the JSON data
      const blob = new Blob([jsonString], { type: 'application/json' });

      // Create a URL for the blob
      const url = URL.createObjectURL(blob);

      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.download = 'canvas.json';

      // Append the link to the document, click it, and remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL
      URL.revokeObjectURL(url);

      debugLog('Successfully saved canvas state to file');
    } catch (error) {
      console.error('Error saving canvas state:', error);
    }
  }, [generateSaveData]);

  /**
   * Loads and restores the canvas state from a JSON file
   * @param {File} file - The JSON file to load
   */
  const loadFromFile = useCallback(
    (file) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const saveData = JSON.parse(event.target.result);

          // Check version compatibility
          if (!saveData.version) {
            throw new Error('Invalid save file: Missing version information');
          }

          const [major] = saveData.version.split('.');
          if (parseInt(major) > 1) {
            throw new Error(
              'This save file was created with a newer version and is not compatible.'
            );
          }

          // Reset current state
          reset();

          // Restore node states first
          const newNodeStates = {};
          saveData.nodes.forEach((node) => {
            if (node.state) {
              newNodeStates[node.id] = node.state;
            }
          });
          setNodeStates(newNodeStates);

          // Restore nodes
          setNodes(
            saveData.nodes.map((node) => ({
              id: node.id,
              type: node.type,
              position: node.position,
              data: node.data,
            }))
          );

          // Create edge states for each edge
          const newEdgeStates = {};
          saveData.edges.forEach((edge) => {
            if (edge.state) {
              // Use saved state if it exists
              newEdgeStates[edge.id] = edge.state;
            } else {
              // Fallback to creating new state from template
              const edgeTemplate = edgeInfo[edge.type || 'flow'];
              if (!edgeTemplate) {
                console.warn(`Edge template not found for type ${edge.type}, using flow type`);
              }

              // Get default parameters from edgeInfo
              const defaultParameters = {};
              if (edgeTemplate) {
                for (const key in edgeTemplate.parameters) {
                  defaultParameters[key] = edgeTemplate.parameters[key].defaultValue;
                }
              }

              // Create the edge state
              newEdgeStates[edge.id] = {
                parameters: defaultParameters,
              };
            }
          });

          // Set edge states
          setEdgeStates(newEdgeStates);

          // Restore edges
          setEdges(saveData.edges);

          // Restore counters
          setNodeCounters(saveData.nodeCounters);
          setTotalNodeCounters(saveData.totalNodeCounters);

          debugLog('Successfully loaded canvas state from file');
          if (saveData.timestamp) {
            debugLog('File was saved on: ' + new Date(saveData.timestamp).toLocaleString());
          }
        } catch (error) {
          console.error('Error loading canvas state:', error);
          alert('Error loading file: ' + error.message);
        }
      };

      reader.onerror = () => {
        console.error('Error reading file');
        alert('Error reading file');
      };

      reader.readAsText(file);
    },
    [reset, setNodes, setEdges, setNodeStates, setNodeCounters, setTotalNodeCounters, setEdgeStates]
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
    (params, type = 'flow') => {
      // Get edge template from edgeInfo
      const edgeTemplate = edgeInfo[type];
      if (!edgeTemplate) {
        console.error(`Cannot add edge: Edge info not found for type "${type}"`);
        return;
      }

      // Get default parameters from edgeInfo
      const defaultParameters = {};
      for (const key in edgeTemplate.parameters) {
        defaultParameters[key] = edgeTemplate.parameters[key].defaultValue;
      }

      // Create the edge state, merging default parameters with any from the connection context
      const edgeState = {
        parameters: {
          ...defaultParameters,
          ...(params.context?.parameters || {}),
        },
      };

      // Add the edge to ReactFlow
      setEdges((eds) => {
        const newEdges = addEdge({ ...params, type }, eds);
        const newEdge = newEdges[newEdges.length - 1];

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
    [setEdges]
  );

  /**
   * Deletes an edge and cleans up its state.
   *
   * @param {string} edgeId - ID of the edge to delete
   */
  const deleteEdge = useCallback(
    (edgeId) => {
      setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));

      // Clean up edge state
      setEdgeStates((prev) => {
        const newStates = { ...prev };
        delete newStates[edgeId];
        return newStates;
      });
    },
    [setEdges]
  );

  /**
   * Updates multiple edges at once, maintaining their states.
   * Used for bulk operations like port reconfiguration.
   *
   * @param {Array} newEdges - Array of updated edges
   * @param {Array} removedEdgeIds - Array of edge IDs that were removed
   */
  const updateEdges = useCallback(
    (newEdges, removedEdgeIds = []) => {
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
    [setEdges]
  );

  return (
    <NodeContext.Provider
      value={{
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
      }}
    >
      {children}
    </NodeContext.Provider>
  );
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
