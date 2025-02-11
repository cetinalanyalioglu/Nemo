import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { elementInfo } from '../components/nodes/nodeTypes';
import { useNodesState, useEdgesState } from 'reactflow';

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
     * Validates if a connection between two nodes is allowed
     * 
     * @param {Object} connection - The connection parameters
     * @returns {boolean} - Whether the connection is valid
     */
    const isValidConnection = useCallback((connection) => {

        if (!connection.sourceHandle || !connection.targetHandle) {
            console.debug("Invalid connection: No source or target handle");
            return false;
        }

        if (connection.source === connection.target) {
            console.debug("Invalid connection: Source and target are the same");
            return false;
        }

        const existingEdges = edges.filter(edge =>
            edge.sourceHandle === connection.sourceHandle ||
            edge.targetHandle === connection.targetHandle
        );

        if (existingEdges.length > 0) {
            console.debug("Invalid connection: Port is not empty");
            return false;
        }

        return true;
    }, [edges]);

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

    const updateNodeSize = useCallback((nodeId, size) => {

        if (!nodeId || !size) {
            console.error("Invalid node id or size");
            return;
        }

        // Update the node state
        setNodeStates(prev => ({
            ...prev,
            [nodeId]: {
                ...prev[nodeId],
                size: {
                    width: size.width,
                    height: size.height
                }
            }
        }));

    }, []);

    // Add node function that handles both node creation and registration
    const addNode = useCallback(({ type, position = { x: 0, y: 0 }, data = {}, parameters = {}, size = null }) => {
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

        const newNode = {
            id,
            type,
            position,
            data: { ...data },
            // Add style property with size if provided
            style: size ? {
                width: `${size.width}px`,
                height: `${size.height}px`
            } : undefined
        };

        // Register node state
        setNodeStates(prev => ({
            ...prev,
            [id]: {
                parameters: mergedParameters,
                size: size || {
                    width: null,
                    height: null
                }
            }
        }));

        // Update nodes in ReactFlow
        setNodes(nodes => [...nodes, newNode]);

        // Update selected node
        setSelectedNodeId(newNode.id);

        // Update current counter
        setNodeCounters(prev => ({
            ...prev,
            [type]: (prev[type] || 0) + 1
        }));

        console.debug("Successfully added node: ", newNode);

        return newNode;
    }, [setNodes, setNodeStates, setNodeCounters, totalNodeCounters, setTotalNodeCounters]);

    const deleteNode = useCallback((nodeId) => {
        console.debug("Deleting node with id: ", nodeId);

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

        // Clear selection if deleted node was selected
        if (selectedNodeId === nodeId) {
            setSelectedNodeId(null);
        }

        console.debug("Successfully deleted node: ", nodeId);
    }, [nodeStates, setNodes, selectedNodeId]);

    /**
     * Removes all nodes and resets all states to their initial values
     */
    const reset = useCallback(() => {

        console.debug("Resetting all nodes and states ...");

        // Clear all nodes
        setNodes([]);

        // Clear all edges
        setEdges([]);

        // Reset node states
        setNodeStates({});

        // Reset editing states
        setEditingStates({});

        // Reset current node counters
        setNodeCounters(prev => {
            return Object.keys(prev).reduce((acc, key) => {
                acc[key] = 0;
                return acc;
            }, {});
        });

        // Clear selected node
        setSelectedNodeId(null);

        console.debug("All nodes and states have been cleared");

    }, [setNodes, setEdges]);

    /**
     * Generates a complete state object for saving
     * @returns {Object} The complete state object
     */
    const generateSaveData = useCallback(() => {
        const saveData = {
            nodes: nodes.map(node => {
                // Get the node's state
                const nodeState = nodeStates[node.id];
                
                // Get the node's type info
                const typeInfo = elementInfo[node.type];
                
                return {
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: node.data,
                    style: node.style,
                    state: nodeState,
                    ports: {
                        target: typeInfo?.ports?.target || [],
                        source: typeInfo?.ports?.source || []
                    }
                };
            }),
            edges: edges,
            nodeCounters: nodeCounters,
            totalNodeCounters: totalNodeCounters
        };

        return saveData;
    }, [nodes, edges, nodeStates, nodeCounters, totalNodeCounters]);

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
            link.download = 'canvas-state.json';
            
            // Append the link to the document, click it, and remove it
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up the URL
            URL.revokeObjectURL(url);

            console.debug("Successfully saved canvas state to file");
        } catch (error) {
            console.error("Error saving canvas state:", error);
        }
    }, [generateSaveData]);

    /**
     * Loads and restores the canvas state from a JSON file
     * @param {File} file - The JSON file to load
     */
    const loadFromFile = useCallback((file) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
            try {
                const saveData = JSON.parse(event.target.result);
                
                // Reset current state
                reset();
                
                // Restore node states first
                const newNodeStates = {};
                saveData.nodes.forEach(node => {
                    if (node.state) {
                        newNodeStates[node.id] = node.state;
                    }
                });
                setNodeStates(newNodeStates);
                
                // Restore nodes
                setNodes(saveData.nodes.map(node => ({
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: node.data,
                    style: node.style
                })));
                
                // Restore edges
                setEdges(saveData.edges);
                
                // Restore counters
                setNodeCounters(saveData.nodeCounters);
                setTotalNodeCounters(saveData.totalNodeCounters);
                
                console.debug("Successfully loaded canvas state from file");
            } catch (error) {
                console.error("Error loading canvas state:", error);
                alert("Error loading file: Invalid format");
            }
        };
        
        reader.onerror = () => {
            console.error("Error reading file");
            alert("Error reading file");
        };
        
        reader.readAsText(file);
    }, [reset, setNodes, setEdges, setNodeStates, setNodeCounters, setTotalNodeCounters]);

    return (
        <NodeContext.Provider value={{
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
            updateNodeSize,
            startEditing,
            onChange,
            onKeyDown,
            finishEditing,
            selectedNodeId,
            setSelectedNodeId,
            isValidConnection,
            saveToFile,
            generateSaveData,
            loadFromFile,
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
