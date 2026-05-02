import React, { useCallback, useRef, useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap, BackgroundVariant } from 'reactflow';
import type { Node, Edge, ReactFlowInstance, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/edges.css';
import '../styles/sidebar.css';
import '../styles/canvas.css';
import { nodeTypes } from './nodes/nodeTypes';
import { edgeTypes } from './edges/edgeTypes';
import ZoomIndicator from './ZoomIndicator';
import { useNodeContext } from '../context/NodeContext';
import { useReactFlow } from '../context/ReactFlowContext';
import { useAppState } from '../context/AppStateContext';

const Canvas = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { reactFlowInstance, setReactFlowInstance } = useReactFlow();

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    addNode,
    deleteNode,
    deleteEdge,
    setSelectedNodeId,
    setSelectedEdgeId,
    isValidConnection,
    addCustomEdge,
  } = useNodeContext();

  const {
    grid: { snapToGrid, size: gridSize },
    viewport: { zoom },
    actions,
  } = useAppState();

  const updateZoom = actions.viewport.updateZoom;

  const onInit = useCallback(
    (instance: ReactFlowInstance | null) => {
      setReactFlowInstance(instance);
      if (!instance) {
        console.error('Can not initialize ReactFlow instance.');
        return;
      }
    },
    [setReactFlowInstance]
  );

  const onMove = useCallback(
    (_evt: MouseEvent | TouchEvent | null, viewPort: { zoom: number }) => {
      updateZoom(viewPort.zoom);
    },
    [updateZoom]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!reactFlowInstance) {
        console.error('ReactFlow instance is not initialized.');
        return;
      }

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) {
        console.error('No node type provided.');
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode({ type, position });
    },
    [reactFlowInstance, addNode]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (isValidConnection(params)) {
        addCustomEdge(params);
      }
    },
    [isValidConnection, addCustomEdge]
  );

  const handleNodeClick = (_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  };

  const handleEdgeClick = (_event: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
  };

  const handlePaneClick = () => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  };

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!reactFlowInstance) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        const selectedNodes = reactFlowInstance.getNodes().filter((node) => node.selected);
        selectedNodes.forEach((node) => {
          deleteNode(node.id);
        });

        const selectedEdges = reactFlowInstance.getEdges().filter((edge) => edge.selected);
        selectedEdges.forEach((edge) => {
          deleteEdge(edge.id);
        });
      }
    },
    [reactFlowInstance, deleteNode, deleteEdge]
  );

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
        onEdgeClick={handleEdgeClick}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        onMove={onMove}
        minZoom={0.5}
        maxZoom={4}
        defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
        isValidConnection={isValidConnection}
        deleteKeyCode={null}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'custom' }}
      >
        <>
          <Background
            variant={BackgroundVariant.Lines}
            gap={gridSize}
            id="background-lines"
            className="background-lines"
            lineWidth={0.5}
            color="#e1e1e1"
          />
          <Background
            variant={BackgroundVariant.Cross}
            gap={gridSize}
            size={3}
            id="background-cross"
            className="background-cross"
            color="#d9d9d9"
          />
        </>
        <Controls />
        <MiniMap />
      </ReactFlow>
      <ZoomIndicator zoom={zoom} />
    </div>
  );
};

export default Canvas;
