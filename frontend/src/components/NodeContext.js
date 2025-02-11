import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { elementInfo } from './nodes/nodeTypes';

/**
 * NodeContext is used to share node-related state and functions 
 * throughout the component tree.
 */
const NodeContext = createContext();

/**
 * NodeProvider wraps the application (or parts of it) that need access 
 * to node states (parameters and editing states) along with functions 
 * that allow modifications.
 *
 * The provider maintains two main pieces of state:
 *  1. nodeStates: Stores parameters for each node.
 *  2. editingStates: Tracks if a node is currently being edited and 
 *     holds temporary values (e.g., temporary label inputs) during editing.
 *
 * It also provides functions to:
 *  - registerNode: To register a node and initialize its parameters.
 *  - updateNodeParameter: To update a specific parameter of a node.
 *  - startEditing: To begin editing a node (setting editing flag and initial temporary value).
 *  - onChange: To update temporary editing values as the user enters new data.
 *  - finishEditing: To finalize editing by updating the node parameters and resetting editing state.
 */
export const NodeProvider = ({ children }) => {
  // This state holds the parameters of nodes.
  const [nodeStates, setNodeStates] = useState({});
  // This state holds the editing statuses and temporary values of nodes.
  const [editingStates, setEditingStates] = useState({});
  // This state holds the counters for each node type.
  const [nodeCounters, setNodeCounters] = useState(Object.keys(elementInfo).reduce((acc, type) => {
    acc[type] = 0;
    return acc;
  }, {}));

  /**
   * Private function to check if a label is already in use
   */
  const isLabelInUse = (label) => {
    return Object.values(nodeStates).some(
      nodeState => nodeState.parameters.label === label
    );
  };

  /**
   * Private function to check if an id is already in use
   */
  const isIdInUse = (id) => {
    return nodeStates.hasOwnProperty(id);
  };

  /**
   * Private function to generate unique node id
   */
  const getNewNodeId = (type) => {
    let newId;
    do {
      newId = `${type}-${uuidv4()}`;
    } while (isIdInUse(newId));
    return newId;
  };

  /**
   * Private function to generate unique node label
   */
  const getNewNodeLabel = (type) => {
    let nextCount = nodeCounters[type] + 1;
    const defaultLabel = elementInfo[type]?.parameters?.label?.defaultValue;
    
    if (!defaultLabel) {
      throw new Error(`Default label not found for node type: ${type}`);
    }

    let newLabel;
    do {
      newLabel = `${defaultLabel}${nextCount}`;
      nextCount++;
    } while (isLabelInUse(newLabel));

    // Update the counter to the actual used number
    setNodeCounters(prev => ({
      ...prev,
      [type]: nextCount - 1
    }));

    return newLabel;
  };

  /**
   * registerNode function receives a node registration event and initializes its parameters
   * based on default values defined in elementInfo. It expects a single node object with the 
   * property type set to 'add' and an 'item' field containing the new node.
   *
   * @param {Object} node - A node registration event object.
   */
  const registerNode = (node) => {
    if (node.type === 'add') {
      // Extract the node ID and type from the provided node item.
      const nodeId = node.item.id;
      const nodeType = node.item.type;

      // Retrieve default parameters from elementInfo for the given nodeType.
      const defaultParams = elementInfo[nodeType]?.parameters;
      if (!defaultParams) {
        console.error(`ElementInfo not found for nodeType "${nodeType}"`);
        return;
      }

      // Initialize the node's parameters with a default label and every other parameter's default value.
      setNodeStates(prev => ({
        ...prev,
        [nodeId]: {
          parameters: {
            // Default label is set as the node ID.
            label: nodeId,
            ...Object.keys(defaultParams).reduce((acc, key) => {
              if (key !== 'label') {
                acc[key] = defaultParams[key].defaultValue;
              }
              return acc;
            }, {})
          }
        }
      }));
    }
  };

  /**
   * updateNodeParameter updates a specific parameter of a node.
   *
   * @param {string} nodeId - The id of the node to update.
   * @param {string} paramName - The name of the parameter to update.
   * @param {*} value - The new value for the parameter.
   */
  const updateNodeParameter = (nodeId, paramName, value) => {
    setNodeStates(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        parameters: {
          ...prev[nodeId]?.parameters,
          [paramName]: value
        }
      }
    }));
  };

  /**
   * startEditing marks a node as being edited and initializes its temporary value.
   *
   * @param {string} nodeId - The id of the node that is starting to be edited.
   */
  const startEditing = (nodeId) => {
    setEditingStates(prev => ({
      ...prev,
      [nodeId]: {
        isEditing: true,
        tempLabel: nodeStates[nodeId]?.parameters?.label || ''
      }
    }));
  };

  /**
   * onChange updates the temporary editing value as the user modifies it.
   *
   * @param {string} nodeId - The id of the node being edited.
   * @param {Object} evt - The event object containing the new value.
   */
  const onChange = (nodeId, evt) => {
    setEditingStates(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        tempLabel: evt.target.value
      }
    }));
  };

  /**
   * finishEditing finalizes the editing process by updating the node's label if a new non-empty 
   * value exists, and then resets the editing state for that node.
   *
   * @param {string} nodeId - The id of the node finishing editing.
   */
  const finishEditing = (nodeId) => {
    const newLabel = editingStates[nodeId]?.tempLabel?.trim();
    if (newLabel) {
      updateNodeParameter(nodeId, 'label', newLabel);
    }
    setEditingStates(prev => ({
      ...prev,
      [nodeId]: {
        isEditing: false,
        tempLabel: ''
      }
    }));
  };

  /**
   * Handles keyboard events during label editing
   */
  const onKeyDown = useCallback((nodeId, event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishEditing(nodeId);
    }
    // Escape tuşu ile düzenlemeyi iptal et
    if (event.key === 'Escape') {
      setEditingStates(prev => ({
        ...prev,
        [nodeId]: {
          isEditing: false,
          tempLabel: ''
        }
      }));
    }
  }, [finishEditing]);

  /**
   * Unregisters a node from the context when it's deleted
   * @param {string} nodeId - The id of the node to unregister
   */
  const unregisterNode = useCallback((nodeId) => {
    setNodeStates(prev => {
      const newStates = { ...prev };
      delete newStates[nodeId];
      return newStates;
    });

    setEditingStates(prev => {
      const newStates = { ...prev };
      delete newStates[nodeId];
      return newStates;
    });
  }, []);

  // Add node function that handles both node creation and registration
  const addNode = useCallback(({ type, position = { x: 0, y: 0 }, data = {}, parameters = {} },
    { reactFlowInstance, onNodeSelect }) => {
    
    if (!type) {
      throw new Error('Node type is required!');
    }

    if (!reactFlowInstance) {
      throw new Error('ReactFlow instance is required!');
    }

    // Generate unique node ID and label
    const id = getNewNodeId(type);
    const label = getNewNodeLabel(type);

    // Get node template from elementInfo
    const nodeTemplate = elementInfo[type];
    if (!nodeTemplate) {
      throw new Error(`Element info not found for type: "${type}"`);
    }

    // Get default parameters from elementInfo
    const defaultParameters = {};
    for (const key in nodeTemplate.parameters) {
      defaultParameters[key] = nodeTemplate.parameters[key].defaultValue;
    }

    // Merge provided parameters with defaults and override label
    const mergedParameters = { 
      ...defaultParameters, 
      ...parameters,
      label: label
    };

    // Create the new node
    const newNode = {
      id,
      type,
      position,
      data: { ...data }
    };

    // Register node state
    setNodeStates(prev => ({
      ...prev,
      [id]: {
        parameters: mergedParameters
      }
    }));

    // Update nodes in ReactFlow
    const currentNodes = reactFlowInstance.getNodes();
    reactFlowInstance.setNodes([...currentNodes, newNode]);

    // Update selected node
    if (onNodeSelect) {
      onNodeSelect(newNode.id);
    }

    return newNode;
  }, [nodeCounters]);

  return (
    <NodeContext.Provider value={{
      nodeStates,
      nodeCounters,
      editingStates,
      addNode,
      unregisterNode,
      updateNodeParameter,
      startEditing,
      onChange,
      onKeyDown,
      finishEditing
    }}>
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
