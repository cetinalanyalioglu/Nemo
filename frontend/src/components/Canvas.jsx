import React, { useCallback, useRef, useEffect } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import "../styles/edges.css";
import "../styles/sidebar.css";
import "../styles/canvas.css";
import { nodeTypes } from './nodes/nodeTypes';
import ZoomIndicator from "./ZoomIndicator";
import { useNodeContext } from "../context/NodeContext";
import { useReactFlow } from '../context/ReactFlowContext';
import { useAppState } from '../context/AppStateContext';
import PropTypes from 'prop-types';

/**
 * Canvas component that provides the main drawing area for the flow diagram.
 * Handles node placement, connections, and user interactions with the diagram.
 * Uses ReactFlow for rendering and managing the flow diagram.
 * 
 * @returns {React.Component} Canvas component with flow diagram functionality
 */
const Canvas = () => {
    // Reference to the ReactFlow wrapper div for drag-and-drop operations
    const reactFlowWrapper = useRef(null);

    // Get ReactFlow instance from context for programmatic control
    const { reactFlowInstance, setReactFlowInstance } = useReactFlow();

    // Get node management functions and state from context
    const {
        nodes,
        edges,
        setEdges,
        onNodesChange,
        onEdgesChange,
        addNode,
        deleteNode,
        setSelectedNodeId,
        isValidConnection
    } = useNodeContext();

    // Get UI states from AppState context
    const { 
        snapToGrid, 
        gridSize,
        zoom,
        updateZoom
    } = useAppState();

    /**
     * Initializes the ReactFlow instance. After that the ReactFlow instance can be obtained from the context.
     * 
     * @param {ReactFlowInstance} instance - The ReactFlow instance being initialized
     */
    const onInit = useCallback((instance) => {
        setReactFlowInstance(instance);
        if (!instance) {
            console.error("Can not initialize ReactFlow instance.");
            return;
        }
    }, [setReactFlowInstance]);

    /**
     * Updates zoom level state when the viewport changes
     */
    const onMove = useCallback((_, viewPort) => {
        updateZoom(viewPort.zoom);
    }, [updateZoom]);

    /**
     * Handles the dragover event for node drag and drop
     */
    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    /**
     * Handles node creation when a node is dropped onto the canvas
     */
    const onDrop = useCallback((event) => {
        event.preventDefault();

        // Check if the ReactFlow instance is initialized
        if (!reactFlowInstance) {
            console.error("ReactFlow instance is not initialized.");
            return;
        }

        // Get the node type from the data transfer
        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) {
            console.error("No node type provided.");
            return;
        }

        // Convert screen coordinates to flow coordinates and create the node
        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
        });

        addNode({ type, position });
    }, [reactFlowInstance, addNode]);

    /**
     * Handles creation of new edges between nodes
     */
    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge(params, eds));
    }, []);

    /**
     * Updates selected node when a node is clicked
     */
    const handleNodeClick = (event, node) => {
        setSelectedNodeId(node.id);
    };

    /**
     * Clears node selection when clicking on the canvas
     */
    const handlePaneClick = (event) => {
        setSelectedNodeId(null);
    };

    /**
     * Handles keyboard events for node/edge deletion
     */
    const handleKeyDown = useCallback((event) => {
        if (!reactFlowInstance) return;

        // Don't handle delete if target is an input, textarea, or contentEditable element
        if (
            event.target.tagName === 'INPUT' || 
            event.target.tagName === 'TEXTAREA' ||
            event.target.isContentEditable
        ) {
            return;
        }

        // Delete selected nodes and edges on Delete/Backspace
        if (event.key === 'Delete' || event.key === 'Backspace') {
            // Delete selected nodes
            const selectedNodes = reactFlowInstance
                .getNodes()
                .filter(node => node.selected);

            selectedNodes.forEach(node => {
                deleteNode(node.id);
            });

            // Delete selected edges
            reactFlowInstance.setEdges(edges =>
                edges.filter(edge => !edge.selected)
            );
        }
    }, [reactFlowInstance, deleteNode]);

    // Set up keyboard event listeners
    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    return (
        <div
            className="canvas-wrapper"
            style={{ flex: 1 }}
            ref={reactFlowWrapper}
            onDrop={onDrop}
            onDragOver={onDragOver}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                onNodeClick={handleNodeClick}
                onPaneClick={handlePaneClick}
                onInit={onInit}
                onMove={onMove}
                minZoom={0.5}
                maxZoom={4}
                defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
                isValidConnection={isValidConnection}
                deleteKeyCode={null}  // Disable built-in delete to use custom deletion
                snapToGrid={snapToGrid}
                snapGrid={[gridSize, gridSize]}
            >
                <Background
                    variant="dots"
                    gap={gridSize}
                    size={1}
                    color="#eee"
                />
                <Controls />
                <MiniMap />
            </ReactFlow>
            <ZoomIndicator zoom={zoom} />
        </div>
    );
};

Canvas.propTypes = {
    snapToGrid: PropTypes.bool
};

export default Canvas;