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
import { nodeTypes } from './nodeTypes';
import "reactflow/dist/style.css";
import "./Canvas.css";
import "../styles/ports.css";
import "../styles/edges.css";
import "../styles/sidebar.css";
import ZoomIndicator from "./ZoomIndicator";
import { NodeProvider } from './NodeContext';
import { elementInfo } from './nodeTypes/FlowNetwork/index';

const Canvas = () => {
    const reactFlowWrapper = useRef(null);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [zoom, setZoom] = useState(1);
    const [nodeStates, setNodeStates] = useState({});
    const [nodeCounters, setNodeCounters] = useState({
        MassFlowInlet: 0,
        LosslessDuct: 0,
        PressureOutlet: 0
    });

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
            const position = reactFlowInstance.project({
                x: event.clientX - reactFlowWrapper.current.getBoundingClientRect().left,
                y: event.clientY - reactFlowWrapper.current.getBoundingClientRect().top,
            });

            const newCounter = nodeCounters[type] + 1;
            setNodeCounters(prev => ({
                ...prev,
                [type]: newCounter
            }));

            const newId = `${type}_${Date.now()}`;

            const initialParameters = {};
            Object.entries(elementInfo[type].parameters).forEach(([key, param]) => {
                if (key === 'label') {
                    initialParameters[key] = `${param.defaultValue}${newCounter}`;
                } else {
                    initialParameters[key] = param.defaultValue;
                }
            });

            setNodeStates(prev => ({
                ...prev,
                [newId]: {
                    parameters: initialParameters
                }
            }));

            const newNode = {
                id: newId,
                type,
                position,
                data: { 
                    type: type,
                    stateId: newId
                }
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [reactFlowInstance, setNodes, setNodeStates, nodeCounters]
    );

    const onConnect = useCallback((params) => {
        const targetConnections = edges.filter(
            edge => edge.target === params.target && edge.targetHandle === params.targetHandle
        );

        const sourceConnections = edges.filter(
            edge => edge.source === params.source && edge.sourceHandle === params.sourceHandle
        );

        if (targetConnections.length > 0 || sourceConnections.length > 0) {
            return;
        }

        setEdges((eds) => addEdge({
            ...params,
            type: 'normal-edge',
            markerEnd: { 
                type: MarkerType.Arrow,
                width: 20,
                height: 20,
                color: '#1a192b',
                strokeWidth: 1
            }
        }, eds));
    }, [edges, setEdges]);

    const updateNodeParameter = useCallback((nodeId, paramName, value) => {
        setNodeStates(prev => ({
            ...prev,
            [nodeId]: {
                ...prev[nodeId],
                parameters: {
                    ...prev[nodeId].parameters,
                    [paramName]: value
                }
            }
        }));
    }, []);

    return (
        <NodeProvider nodeStates={nodeStates} updateNodeParameter={updateNodeParameter}>
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
        </NodeProvider>
    );
};

export default Canvas;