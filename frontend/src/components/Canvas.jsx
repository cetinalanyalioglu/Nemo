import React, { useCallback, useRef, useState, useEffect } from "react";
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
import { useNodeContext } from "./NodeContext";
import exportTopology from "../utils/exportTopology";
import { useReactFlow } from '../context/ReactFlowContext';

const Canvas = () => {

    // ReactFlow wrapper (canvas wrapper)
    const reactFlowWrapper = useRef(null);

    // Create a state for the zoom level
    const [zoom, setZoom] = useState(1);

    // Get the ReactFlow instance setter from the context
    const { reactFlowInstance, setReactFlowInstance } = useReactFlow();

    // Attach the node context
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

    const onMove = useCallback((_, viewPort) => {
        setZoom(viewPort.zoom);
    }, []);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

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

        // Get the position of the drop event
        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
        });

        addNode({ type, position });
    }, [reactFlowInstance, addNode]);

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge(params, eds));
    }, []);

    const handleNodeClick = (event, node) => {
        // Set the selected node id when a node is clicked
        setSelectedNodeId(node.id);
    };

    const handlePaneClick = (event) => {
        // Clear the selected node id when the pane is clicked
        setSelectedNodeId(null);
    };

    const handleExport = useCallback(() => {
        const dataStr = exportTopology({ nodes, edges });
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "topology.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [nodes, edges]);

    const handleKeyDown = useCallback((event) => {
        if (!reactFlowInstance) return;

        // Handle delete key
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

    // Add event listener for key down event
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
                deleteKeyCode={null}
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
            <ZoomIndicator zoom={zoom} />
            <button onClick={handleExport} className="export-btn">
                Export Topology
            </button>
        </div>
    );
};

export default Canvas;