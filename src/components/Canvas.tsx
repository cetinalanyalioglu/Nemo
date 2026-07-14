import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, BackgroundVariant } from 'reactflow';
import {
  SnapToGridControl,
  AutoLayoutControl,
  FlowInteractiveToggle,
  DataFreezeBridge,
  LockSyncBridge,
  FitViewBridge,
  ScaleToVisibleBridge,
} from './canvas-flow-controls';
import type { Node, Edge, ReactFlowInstance, Connection, NodeTypes, EdgeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import '../styles/edges.css';
import '../styles/sidebar.css';
import '../styles/canvas.css';
import { CanvasZoomIndicator } from './canvas-zoom-indicator';
import CanvasHistoryControls from './canvas-history-controls';
import CanvasTitle from './CanvasTitle';
import DataLegend from './DataLegend';
import CanvasPlayer from './CanvasPlayer';
import CanvasExportControl from './CanvasExportControl';
import CanvasAlignControls from './canvas-align-controls';
import { useGraphStore } from '../store/graphStore';
import { useReactFlow } from '../context/ReactFlowContext';
import { useAppearanceState, useGridState, useLayoutState } from '../context/AppStateContext';
import { useModel } from '../context/ModelContext';
import AnnotationNode from './nodes/AnnotationNode';
import { ANNOTATION_DRAG_MIME } from './annotations-pane';
import { ANNOTATION_NODE_TYPE } from '../types/annotations';
import { readAnnotationImage } from '../utils/annotation-images';
import { logger } from '../utils/logger';

// Stable fallbacks so ReactFlow never receives undefined type maps while a
// model is loading.
const EMPTY_NODE_TYPES: NodeTypes = {};
const EMPTY_EDGE_TYPES: EdgeTypes = {};

// Hoisted so these object/array props keep a stable identity across renders and
// don't trigger avoidable work inside ReactFlow.
const DEFAULT_EDGE_OPTIONS = { type: 'custom' };
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1.0 };

const Canvas = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const { reactFlowInstance, setReactFlowInstance } = useReactFlow();

  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const addNode = useGraphStore((s) => s.addNode);
  const addAnnotation = useGraphStore((s) => s.addAnnotation);
  const deleteNode = useGraphStore((s) => s.deleteNode);
  const deleteAnnotation = useGraphStore((s) => s.deleteAnnotation);
  const deleteEdge = useGraphStore((s) => s.deleteEdge);
  const setSelectedNodeId = useGraphStore((s) => s.setSelectedNodeId);
  const setSelectedEdgeId = useGraphStore((s) => s.setSelectedEdgeId);
  const setActivePort = useGraphStore((s) => s.setActivePort);
  const isValidConnection = useGraphStore((s) => s.isValidConnection);
  const addCustomEdge = useGraphStore((s) => s.addCustomEdge);
  const copySelection = useGraphStore((s) => s.copySelection);
  const pasteClipboard = useGraphStore((s) => s.pasteClipboard);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);

  const { snapToGrid, size: gridSize } = useGridState();
  const { showMinimap } = useLayoutState();
  const { showPortNumbers } = useAppearanceState();

  const snapGrid = useMemo<[number, number]>(() => [gridSize, gridSize], [gridSize]);

  const { model } = useModel();
  // Model element types plus the model-independent annotation layer.
  const nodeTypes = useMemo(
    () => ({ ...(model?.nodeTypes ?? EMPTY_NODE_TYPES), [ANNOTATION_NODE_TYPE]: AnnotationNode }),
    [model?.nodeTypes]
  );
  const edgeTypes = useMemo(() => model?.edgeTypes ?? EMPTY_EDGE_TYPES, [model?.edgeTypes]);

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

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Annotation drags (from the Annotations pane) drop onto the presentation
      // layer, never through the model's addNode path.
      if (event.dataTransfer.getData(ANNOTATION_DRAG_MIME)) {
        addAnnotation({ position });
        return;
      }

      // An image file dropped straight from the OS becomes an image annotation.
      const file = event.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) {
        readAnnotationImage(file)
          .then(({ src, width }) =>
            addAnnotation({ position, kind: 'image', src, style: { width } })
          )
          .catch((error: unknown) =>
            logger.error(error instanceof Error ? error.message : String(error))
          );
        return;
      }

      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) {
        console.error('No node type provided.');
        return;
      }

      addNode({ type, position });
    },
    [reactFlowInstance, addNode, addAnnotation]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (isValidConnection(params)) {
        addCustomEdge(params);
      }
    },
    [isValidConnection, addCustomEdge]
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Annotations have no parameters: keep the properties panel out of it and
      // let the note's own floating toolbar handle styling.
      if (node.type === ANNOTATION_NODE_TYPE) {
        setSelectedNodeId(null);
        return;
      }
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId]
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedEdgeId(edge.id);
    },
    [setSelectedEdgeId]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setActivePort(null);
  }, [setSelectedNodeId, setSelectedEdgeId, setActivePort]);

  // Record a snapshot before a drag so the move can be undone as a single step.
  const onNodeDragStart = useCallback(() => {
    recordHistory();
  }, [recordHistory]);

  // Deletes the current selection: annotations first (allowed even on a locked
  // canvas), then — canvas permitting — model nodes and edges. Shared by the
  // Delete key and cut.
  const deleteSelection = useCallback(() => {
    if (!reactFlowInstance) return;
    const selectedNodes = reactFlowInstance.getNodes().filter((node) => node.selected);

    // Annotations are presentation-only, so deleting them is allowed even on
    // a locked canvas.
    selectedNodes
      .filter((node) => node.type === ANNOTATION_NODE_TYPE)
      .forEach((node) => deleteAnnotation(node.id));

    // Model deletion is a topological change; a locked canvas rejects it in
    // the store. Bail early so inspecting a selected element doesn't spam
    // the console with one rejection per selected node/edge.
    if (useGraphStore.getState().locked) return;

    selectedNodes
      .filter((node) => node.type !== ANNOTATION_NODE_TYPE)
      .forEach((node) => deleteNode(node.id));

    const selectedEdges = reactFlowInstance.getEdges().filter((edge) => edge.selected);
    selectedEdges.forEach((edge) => {
      deleteEdge(edge.id);
    });
  }, [reactFlowInstance, deleteNode, deleteAnnotation, deleteEdge]);

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

      // Clipboard shortcuts react to the plain modifier only, so browser
      // combos like Ctrl+Shift+C stay untouched; a live text selection (e.g.
      // in the console pane) also keeps the native copy behavior.
      if (isMod && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 'c' || key === 'x') {
          const textSelection = window.getSelection();
          if (textSelection && !textSelection.isCollapsed) return;
          const selectedNodeIds = reactFlowInstance
            .getNodes()
            .filter((node) => node.selected)
            .map((node) => node.id);
          if (selectedNodeIds.length === 0) return;
          event.preventDefault();
          const copied = copySelection(selectedNodeIds);
          if (key === 'x' && copied > 0) deleteSelection();
          return;
        }
        if (key === 'v') {
          event.preventDefault();
          pasteClipboard();
          return;
        }
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelection();
      }
    },
    [reactFlowInstance, deleteSelection, copySelection, pasteClipboard, undo, redo]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div
      className={`canvas-wrapper${showPortNumbers ? ' show-port-numbers' : ''}`}
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
        onNodeDragStart={onNodeDragStart}
        onPaneClick={handlePaneClick}
        onInit={onInit}
        connectOnClick={false}
        minZoom={0.5}
        maxZoom={4}
        defaultViewport={DEFAULT_VIEWPORT}
        isValidConnection={isValidConnection}
        deleteKeyCode={null}
        snapToGrid={snapToGrid}
        snapGrid={snapGrid}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
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
        <CanvasTitle />
        <DataLegend />
        <CanvasPlayer />
        <DataFreezeBridge />
        <LockSyncBridge />
        <FitViewBridge />
        <ScaleToVisibleBridge />
        <CanvasZoomIndicator />
      </ReactFlow>
      <CanvasHistoryControls />
      <CanvasAlignControls />
      <CanvasExportControl />
    </div>
  );
};

export default Canvas;
