import React, { memo, useCallback, useEffect, useRef } from 'react';
import { ControlButton, useStore, useStoreApi } from 'reactflow';
import { BsGrid } from 'react-icons/bs';
import { IoGitNetwork } from 'react-icons/io5';
import { useAppState, useGridState, useLayoutState } from '../context/AppStateContext';
import { useReactFlow } from '../context/ReactFlowContext';
import { useGraphStore } from '../store/graphStore';
import { useDataStore } from '../store/dataStore';
import { getLayoutedElements } from '../utils/layoutUtils';

const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32" aria-hidden>
    <path
      fill="currentColor"
      d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0 8 0 4.571 3.429 4.571 7.619v3.048H3.048A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047zm4.724-13.866H7.467V7.619c0-2.59 2.133-4.724 4.723-4.724 2.591 0 4.724 2.133 4.724 4.724v3.048z"
    />
  </svg>
);

const UnlockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 32" aria-hidden>
    <path
      fill="currentColor"
      d="M21.333 10.667H19.81V7.619C19.81 3.429 16.38 0 12.19 0c-4.114 1.828-1.37 2.133.305 2.438 1.676.305 4.42 2.59 4.42 5.181v3.048H3.047A3.056 3.056 0 000 13.714v15.238A3.056 3.056 0 003.048 32h18.285a3.056 3.056 0 003.048-3.048V13.714a3.056 3.056 0 00-3.048-3.047zM12.19 24.533a3.056 3.056 0 01-3.047-3.047 3.056 3.056 0 013.047-3.048 3.056 3.056 0 013.048 3.048 3.056 3.056 0 01-3.048 3.047z"
    />
  </svg>
);

export const SnapToGridControl = memo(() => {
  const { snapToGrid } = useGridState();
  const { actions } = useAppState();

  return (
    <ControlButton
      type="button"
      title="Toggle snapping to grid lines"
      aria-label="Toggle snapping to grid lines"
      aria-pressed={snapToGrid}
      onClick={actions.grid.toggleSnap}
      className={`react-flow__controls-snapgrid ${snapToGrid ? 'active' : ''}`}
    >
      <BsGrid />
    </ControlButton>
  );
});

SnapToGridControl.displayName = 'SnapToGridControl';

export const AutoLayoutControl = memo(() => {
  const { reactFlowInstance } = useReactFlow();
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const { nodeSep, rankSep } = useLayoutState();

  const onLayout = useCallback(() => {
    if (!reactFlowInstance) return;

    // Read from the ReactFlow instance so nodes carry their measured dimensions,
    // letting dagre lay them out by real size instead of a hardcoded default.
    const nodes = reactFlowInstance.getNodes();
    const edges = reactFlowInstance.getEdges();
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'LR', nodeSep, rankSep);

    const changes = layoutedNodes.map((node) => ({
      type: 'position' as const,
      id: node.id,
      position: node.position,
    }));

    recordHistory();
    onNodesChange(changes);

    const { x, y, zoom } = reactFlowInstance.getViewport();
    reactFlowInstance.setViewport({ x, y, zoom });
  }, [reactFlowInstance, onNodesChange, recordHistory, nodeSep, rankSep]);

  return (
    <ControlButton
      type="button"
      className="react-flow__controls-autolayout"
      onClick={onLayout}
      title="Auto Layout"
      aria-label="Auto layout"
    >
      <IoGitNetwork />
    </ControlButton>
  );
});

AutoLayoutControl.displayName = 'AutoLayoutControl';

export const FlowInteractiveToggle = memo(() => {
  const store = useStoreApi();
  const isInteractive = useStore(
    (s) => !!(s.nodesDraggable || s.nodesConnectable || s.elementsSelectable)
  );

  const onToggle = () => {
    const next = !isInteractive;
    // Unfreezing while data is loaded is risky: editing the canvas changes the
    // generated indices the data is bound to. Warn before allowing it.
    if (next && useDataStore.getState().datasets.length > 0) {
      const confirmed = window.confirm(
        'The canvas was frozen because data is loaded. Editing it can change the ' +
          'element indices the data maps to and make the loaded data incompatible. ' +
          'Unfreeze anyway?'
      );
      if (!confirmed) return;
    }
    store.setState({
      nodesDraggable: next,
      nodesConnectable: next,
      elementsSelectable: next,
    });
  };

  return (
    <ControlButton
      type="button"
      className="react-flow__controls-interactive"
      onClick={onToggle}
      title="toggle interactivity"
      aria-label="toggle interactivity"
    >
      {isInteractive ? <UnlockIcon /> : <LockIcon />}
    </ControlButton>
  );
});

FlowInteractiveToggle.displayName = 'FlowInteractiveToggle';

/**
 * Headless bridge: freezes the canvas (disables dragging, connecting, and
 * selection) whenever a dataset is loaded. A modified canvas renders to data
 * that no longer matches, so loading data drops the canvas into a safe,
 * read-only state until the user explicitly unfreezes. Watches the data store's
 * `loadCount` so every load — not just the first — re-freezes.
 */
export const DataFreezeBridge = memo(() => {
  const store = useStoreApi();
  const loadCount = useDataStore((s) => s.loadCount);
  const prevLoadCount = useRef(loadCount);

  useEffect(() => {
    if (loadCount !== prevLoadCount.current) {
      prevLoadCount.current = loadCount;
      store.setState({
        nodesDraggable: false,
        nodesConnectable: false,
        elementsSelectable: false,
      });
    }
  }, [loadCount, store]);

  return null;
});

DataFreezeBridge.displayName = 'DataFreezeBridge';
