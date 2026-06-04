import React, { memo, useCallback } from 'react';
import { ControlButton, useStore, useStoreApi } from 'reactflow';
import { BsGrid } from 'react-icons/bs';
import { IoGitNetwork } from 'react-icons/io5';
import { useAppState } from '../context/AppStateContext';
import { useReactFlow } from '../context/ReactFlowContext';
import { useNodeContext } from '../context/NodeContext';
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
  const {
    grid: { snapToGrid },
    actions,
  } = useAppState();

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
  const { nodes, edges, onNodesChange, recordHistory } = useNodeContext();

  const onLayout = useCallback(() => {
    if (!reactFlowInstance) return;

    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges);

    const changes = layoutedNodes.map((node) => ({
      type: 'position' as const,
      id: node.id,
      position: node.position,
    }));

    recordHistory();
    onNodesChange(changes);

    const { x, y, zoom } = reactFlowInstance.getViewport();
    reactFlowInstance.setViewport({ x, y, zoom });
  }, [nodes, edges, reactFlowInstance, onNodesChange, recordHistory]);

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
    store.setState({
      nodesDraggable: !isInteractive,
      nodesConnectable: !isInteractive,
      elementsSelectable: !isInteractive,
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
