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
import "../styles/ports.css";
import "../styles/sidebar.css";
import "./Canvas.css";
import { nodeTypes } from './nodeTypes';
import ZoomIndicator from "./ZoomIndicator";

const Canvas = ({ onNodeSelect, onNodesChange }) => {
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [nodes, setNodes, handleNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [zoom, setZoom] = useState(1);

    const onInit = (instance) => {
        setReactFlowInstance(instance);
    };

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event) => {
        event.preventDefault();

        const type = event.dataTransfer.getData('application/reactflow');
        if (!type) return;

        const position = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const newNode = {
            id: `${type}_${Date.now()}`,
            type,
            position,
            data: { label: `${type}`, type }
        };

        setNodes((nds) => {
            const updatedNodes = nds.concat(newNode);
            // Parent'a node eklendiğini bildir
            onNodesChange([{ item: newNode, type: 'add' }]);
            return updatedNodes;
        });
    }, [reactFlowInstance, onNodesChange, setNodes]);

    const onConnect = useCallback((params) => {
        setEdges((eds) => addEdge(params, eds));
    }, []);

    const handleNodeClick = (event, node) => {
        if (typeof onNodeSelect === 'function') {
            onNodeSelect(node.id);
        }
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
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                onNodeClick={handleNodeClick}
                onInit={onInit}
                fitView
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