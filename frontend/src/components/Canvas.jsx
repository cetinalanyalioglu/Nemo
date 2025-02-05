import React, { useCallback, useRef, useState } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useEdgesState,
    useNodesState,
    addEdge,
} from "reactflow";
import "reactflow/dist/style.css";
import "../styles/edges.css";
// import "../styles/ports.css";
import "../styles/sidebar.css";
import "./Canvas.css";
import { nodeTypes } from './nodes/nodeTypes';
import ZoomIndicator from "./ZoomIndicator";

const Canvas = ({ onNodeSelect, onNodeAdd, getNextNodeId }) => {
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [zoom, setZoom] = useState(1);

    const onInit = (instance) => {
        setReactFlowInstance(instance);
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

        if (!reactFlowInstance) {
            return;
        }

        const type = event.dataTransfer.getData('application/reactflow');

        if (typeof type === 'undefined' || !type) {
            return;
        }

        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const id = getNextNodeId(type);

        console.log(id);

        const newNode = {
            id,
            type,
            position,
            data: { label: id },
        };

        setNodes((nds) => nds.concat(newNode));
        onNodeAdd([{ item: newNode, type: 'add' }]);
        onNodeSelect(newNode.id);
    }, [reactFlowInstance, onNodeAdd, setNodes, onNodeSelect, getNextNodeId]);

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
            >
                <Background />
                <Controls />
                <MiniMap />
            </ReactFlow>
            <ZoomIndicator zoom={zoom} />
        </div>
    );
};

export default Canvas;