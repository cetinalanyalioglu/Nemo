import React, { useCallback, useRef, useState, useMemo } from "react";
import ReactFlow, {
  addEdge,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import { nodeTypes as flowNodeTypes, elementInfo } from './nodeTypes/FlowNetwork/index';
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
            const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY
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
        // Hedef port için mevcut bağlantıları kontrol et
        const targetConnections = edges.filter(
            edge => edge.target === params.target && edge.targetHandle === params.targetHandle
        );

        // Kaynak port için mevcut bağlantıları kontrol et
        const sourceConnections = edges.filter(
            edge => edge.source === params.source && edge.sourceHandle === params.sourceHandle
        );

        // Eğer herhangi bir portta zaten bağlantı varsa, yeni bağlantıyı engelle
        if (targetConnections.length > 0 || sourceConnections.length > 0) {
            return;
        }

        setEdges((eds) => addEdge({
            ...params,
            type: 'normal-edge',
            markerEnd: { 
                type: MarkerType.Arrow,
                width: 20,        // Ok genişliği
                height: 20,       // Ok yüksekliği
                color: '#1a192b', // Ok rengi
                strokeWidth: 1    // Ok çizgi kalınlığı
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

    const nodeTypes = useMemo(() => ({
        MassFlowInlet: (props) => (
            <flowNodeTypes.MassFlowInlet 
                {...props} 
                nodeState={nodeStates[props.id]} 
                updateNodeParameter={updateNodeParameter}
            />
        ),
        LosslessDuct: (props) => (
            <flowNodeTypes.LosslessDuct 
                {...props} 
                nodeState={nodeStates[props.id]}
                updateNodeParameter={updateNodeParameter}
            />
        ),
        PressureOutlet: (props) => (
            <flowNodeTypes.PressureOutlet 
                {...props} 
                nodeState={nodeStates[props.id]}
                updateNodeParameter={updateNodeParameter}
            />
        )
    }), [nodeStates, updateNodeParameter]);

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