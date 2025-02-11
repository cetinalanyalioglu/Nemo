import React, { useCallback, useRef, useState, useEffect } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useEdgesState,
    useNodesState,
    addEdge,
    ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import "../styles/edges.css";
import "../styles/sidebar.css";
import "./Canvas.css";
import { nodeTypes } from './nodes/nodeTypes';
import ZoomIndicator from "./ZoomIndicator";
import { useNodeContext } from "./NodeContext";
import exportTopology from "../utils/exportTopology";
import { useReactFlow } from '../context/ReactFlowContext';

const Canvas = ({
    onNodeSelect,
    updateNodes,
    updateEdges
}) => {
    const reactFlowWrapper = useRef(null);
    const { reactFlowInstance, setReactFlowInstance } = useReactFlow();
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [zoom, setZoom] = useState(1);

    const { nodeStates, addNode, deleteNode } = useNodeContext();

    useEffect(() => {
        updateNodes(nodes);
    }, [nodes, updateNodes]);

    useEffect(() => {
        updateEdges(edges);
    }, [edges, updateEdges]);

    /**
     * Initializes the ReactFlow instance and sets initial zoom level. After that the ReactFlow instance can be obtained from the context.
     * 
     * @param {ReactFlowInstance} instance - The ReactFlow instance being initialized
     */
    const onInit = (instance) => {
        setReactFlowInstance(instance);
        console.log("ReactFlow instance initialized:", instance);
        setZoom(instance.getZoom());
    };

    const onMove = useCallback((_, viewPort) => {
        setZoom(viewPort.zoom);
    }, []);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event) => {
        event.preventDefault();

        if (!reactFlowInstance) return;

        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;

        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY
        });

        addNode(
            { type, position },
            { onNodeSelect }
        );
    }, [reactFlowInstance, addNode, onNodeSelect]);

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge(params, eds));
    }, []);

    const handleNodeClick = (event, node) => {
        if (typeof onNodeSelect === 'function') {
            onNodeSelect(node.id);
        }
    };

    const handlePaneClick = (event) => {
        if (typeof onNodeSelect === 'function') {
            onNodeSelect(null);
        }
    };

    const isValidConnection = (connection) => {
        if (!connection.sourceHandle || !connection.targetHandle) {
            return false;
        }

        if (connection.source === connection.target) {
            return false;
        }

        const existingEdges = edges.filter(edge =>
            edge.sourceHandle === connection.sourceHandle ||
            edge.targetHandle === connection.targetHandle
        );

        if (existingEdges.length > 0) {
            return false;
        }

        return true;
    };

    const handleExport = useCallback(() => {
        const dataStr = exportTopology({ nodes, edges, nodeStates });
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "topology.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [nodes, edges, nodeStates]);

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
                fitView
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