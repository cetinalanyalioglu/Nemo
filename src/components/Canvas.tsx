import React, { useCallback, useRef, useEffect } from 'react';
import ReactFlow, { Background, Controls, MiniMap, BackgroundVariant } from 'reactflow';
import {
  SnapToGridControl,
  AutoLayoutControl,
  FlowInteractiveToggle,
} from './canvas-flow-controls';
import type { Node, Edge, ReactFlowInstance, Connection, NodeTypes, EdgeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/edges.css';
import '../styles/sidebar.css';
import '../styles/canvas.css';
import { CanvasZoomIndicator } from './canvas-zoom-indicator';
import CanvasHistoryControls from './canvas-history-controls';
import { useGraphStore } from '../store/graphStore';
import { useReactFlow } from '../context/ReactFlowContext';
import { useAppState } from '../context/AppStateContext';
import { useModel } from '../context/ModelContext';

// Stable fallbacks so ReactFlow never receives undefined type maps while a
// model is loading.
const EMPTY_NODE_TYPES: NodeTypes = {};
const EMPTY_EDGE_TYPES: EdgeTypes = {};

const Canvas = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { reactFlowInstance, setReactFlowInstance } = useReactFlow();

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const addNode = useGraphStore((s) => s.addNode);
  const deleteNode = useGraphStore((s) => s.deleteNode);
  const deleteEdge = useGraphStore((s) => s.deleteEdge);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId);
  const isValidConnection = useGraphStore((s) => s.isValidConnection);
  const addCustomEdge = useGraphStore((s) => s.addCustomEdge);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);

  const {
    grid: { snapToGrid, size: gridSize },
    layout: { showMinimap },
  } = useAppState();

  const { model } = useModel();
  const nodeTypes = model?.nodeTypes ?? EMPTY_NODE_TYPES;
  const edgeTypes = model?.edgeTypes ?? EMPTY_EDGE_TYPES;

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

  // Record a snapshot before a drag so the move can be undone as a single step.
  const onNodeDragStart = useCallback(() => {
    recordHistory();
  }, [recordHistory]);

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

      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && (event.key === 'z' || event.key === 'Z')) {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      if (isMod && (event.key === 'y' || event.key === 'Y')) {
        event.preventDefault();
        redo();
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
    [reactFlowInstance, deleteNode, deleteEdge, undo, redo]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="canvas-wrapper" ref={reactFlowWrapper} onDrop={onDrop} onDragOver={onDragOver}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onEdgeClick={handleEdgeClick}
        onNodeClick={handleNodeClick}
        onNodeDragStart={onNodeDragStart}
        onPaneClick={handlePaneClick}
        onInit={onInit}
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
            color="var(--color-canvas-grid-line)"
          />
          <Background
            variant={BackgroundVariant.Cross}
            gap={gridSize}
            size={3}
            id="background-cross"
            className="background-cross"
            color="var(--color-canvas-grid-cross)"
          />
        </>
        <Controls showInteractive={false}>
          <SnapToGridControl />
          <AutoLayoutControl />
          <FlowInteractiveToggle />
        </Controls>
        {showMinimap && <MiniMap />}
        <CanvasZoomIndicator />
      </ReactFlow>
      <CanvasHistoryControls />
    </div>
  );
};

export default Canvas;
