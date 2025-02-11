import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { elementInfo } from './nodes/nodeTypes';
import { useReactFlow } from '../context/ReactFlowContext';
import { useNodesState, useEdgesState } from 'reactflow';

const NodeContext = createContext();

export const NodeProvider = ({ children }) => {
    const { reactFlowInstance } = useReactFlow();

    // ReactFlow states
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Node states for parameters and editing
    const [nodeStates, setNodeStates] = useState({});
    const [editingStates, setEditingStates] = useState({});
    const [nodeCounters, setNodeCounters] = useState({});
    const [totalNodeCounters, setTotalNodeCounters] = useState({});

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
        console.debug("New node id generated: ", newId);
        return newId;
    };

    /**
     * Private function to generate unique node label
     */
    const getNewNodeLabel = (type) => {
        const currentCount = totalNodeCounters[type] || 0;
        const nextCount = currentCount + 1;
        const defaultLabel = elementInfo[type]?.parameters?.label?.defaultValue;

        if (!defaultLabel) {
            throw new Error(`Default label not found for node type: ${type}`);
        }

        let newLabel = `${defaultLabel}${nextCount}`;
        console.debug("New node label generated: ", newLabel);

        // Check if label is already in use
        if (isLabelInUse(newLabel)) {
            console.error(`Label "${newLabel}" is already in use.`);
        }

        return newLabel;
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

    // Add node function that handles both node creation and registration
    const addNode = useCallback(({ type, position = { x: 0, y: 0 }, data = {}, parameters = {} },
        { onNodeSelect } = {}) => {

        console.debug("Adding node with type: ", type);

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

        console.debug("Total node counters before update: ", totalNodeCounters);

        // Update counters first to ensure proper label generation
        setTotalNodeCounters(prev => ({
            ...prev,
            [type]: prev[type] + 1
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
        setNodes(nodes => [...nodes, newNode]);

        // Update selected node
        if (onNodeSelect) {
            onNodeSelect(newNode.id);
        }

        // Update current counter
        setNodeCounters(prev => ({
            ...prev,
            [type]: (prev[type] || 0) + 1
        }));

        console.debug("Successfully added node: ", newNode);

        return newNode;
    }, [setNodes, setNodeStates, setNodeCounters, totalNodeCounters, setTotalNodeCounters]);

    const deleteNode = useCallback((nodeId) => {
        if (!nodeId) {
            console.warn('Cannot delete node: No node ID provided');
            return;
        }

        // Get node info before deletion
        const nodeState = nodeStates[nodeId];
        if (!nodeState) {
            console.warn(`Cannot delete node: Node state not found for ID ${nodeId}`);
            return;
        }

        const type = nodeState.type;

        // Update only the current counter
        setNodeCounters(prev => ({
            ...prev,
            [type]: Math.max(0, prev[type] - 1)
        }));

        // Remove from nodeStates
        setNodeStates(prev => {
            const newStates = { ...prev };
            delete newStates[nodeId];
            return newStates;
        });

        // Remove from editingStates
        setEditingStates(prev => {
            const newStates = { ...prev };
            delete newStates[nodeId];
            return newStates;
        });

        // Remove node from ReactFlow
        setNodes(nodes => nodes.filter(node => node.id !== nodeId));
    }, [nodeStates, setNodes]);

    return (
        <NodeContext.Provider value={{
            nodeStates,
            editingStates,
            nodeCounters,         // Current count (can decrease)
            totalNodeCounters,    // Total count (never decreases)
            nodes,
            edges,
            onNodesChange,
            onEdgesChange,
            setNodes,
            setEdges,
            addNode,
            deleteNode,
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
