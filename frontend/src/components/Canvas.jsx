import React, { useCallback, useRef, useState } from "react";
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import { nodeTypes } from './nodeTypes/FlowNetwork/index';
import "reactflow/dist/style.css";
import "./Canvas.css";
import "../styles/ports.css";
import "../styles/edges.css";
import "../styles/sidebar.css";
import ZoomIndicator from "./ZoomIndicator";

const Canvas = () => {
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [zoom, setZoom] = useState(1);

    const onInit = (instance) => {
        setReactFlowInstance(instance);
    };

    const onMove = (_, viewport) => {
        setZoom(viewport.zoom);
    };

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();

            if (!reactFlowInstance) return;

            const type = event.dataTransfer.getData('application/reactflow');
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY
            });

            const newNode = {
                id: `${type}_${Date.now()}`,
                type,
                position,
                data: { label: type }
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes]
    );

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    return (
        <div className="canvas-container" ref={reactFlowWrapper}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={onInit}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onMove={onMove}
                nodeTypes={nodeTypes}
                defaultViewport={{ x: 0, y: 0, zoom: 1 }}
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