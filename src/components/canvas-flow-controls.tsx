import React, { memo, useCallback, useEffect, useRef } from 'react';
import { ControlButton, useStoreApi, useNodesInitialized, internalsSymbol } from 'reactflow';
import { BsGrid } from 'react-icons/bs';
import { IoGitNetwork } from 'react-icons/io5';
import { useAppState, useGridState, useLayoutState } from '../context/AppStateContext';
import { useReactFlow } from '../context/ReactFlowContext';
import { useGraphStore } from '../store/graphStore';
import { useDataStore, selectActiveItem, currentFrameValues } from '../store/dataStore';
import { getElkLayoutedElements, getLayoutedElements } from '../utils/layoutUtils';
import type { LayoutPort } from '../utils/layoutUtils';
import { logger } from '../utils/logger';
import { ANNOTATION_NODE_TYPE } from '../types/annotations';

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
  const store = useStoreApi();
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const { layoutEngine, layoutDirection, nodeSep, rankSep } = useLayoutState();

  const onLayout = useCallback(async () => {
    if (!reactFlowInstance) return;

    // Read from the ReactFlow instance so nodes carry their measured dimensions,
    // letting the engine lay them out by real size instead of a hardcoded default.
    // Annotations stay where the user put them: they are not part of the network,
    // so the layout engine never sees (or moves) them.
    const nodes = reactFlowInstance.getNodes().filter((node) => node.type !== ANNOTATION_NODE_TYPE);
    const edges = reactFlowInstance.getEdges();

    let layoutedNodes;
    if (layoutEngine === 'elk') {
      // Hand ELK the measured handle positions so the layout respects where
      // each port actually sits on its node (top/bottom branches, rail stacks).
      const ports: Record<string, LayoutPort[]> = {};
      store.getState().nodeInternals.forEach((node, id) => {
        const handleBounds = node[internalsSymbol]?.handleBounds;
        const handles = [...(handleBounds?.target ?? []), ...(handleBounds?.source ?? [])];
        const resolved = handles
          .filter((h) => h.id)
          .map((h) => ({ id: h.id!, x: h.x + h.width / 2, y: h.y + h.height / 2 }));
        if (resolved.length > 0) ports[id] = resolved;
      });
      ({ nodes: layoutedNodes } = await getElkLayoutedElements(nodes, edges, {
        direction: layoutDirection,
        nodeSep,
        rankSep,
        ports,
      }));
    } else {
      ({ nodes: layoutedNodes } = getLayoutedElements(
        nodes,
        edges,
        layoutDirection,
        nodeSep,
        rankSep
      ));
    }

    const changes = layoutedNodes.map((node) => ({
      type: 'position' as const,
      id: node.id,
      position: node.position,
    }));

    recordHistory();
    onNodesChange(changes);

    const { x, y, zoom } = reactFlowInstance.getViewport();
    reactFlowInstance.setViewport({ x, y, zoom });
  }, [
    reactFlowInstance,
    store,
    onNodesChange,
    recordHistory,
    layoutEngine,
    layoutDirection,
    nodeSep,
    rankSep,
  ]);

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
  const locked = useGraphStore((s) => s.locked);
  const setLocked = useGraphStore((s) => s.setLocked);

  const onToggle = () => {
    const nextLocked = !locked;
    // Unlocking while data is loaded is risky: editing the canvas changes the
    // generated indices the data is bound to. Warn before allowing it.
    if (!nextLocked && useDataStore.getState().datasets.length > 0) {
      const confirmed = window.confirm(
        'The canvas was locked because data is loaded. Editing it can change the ' +
          'element indices the data maps to and make the loaded data incompatible. ' +
          'Unlock anyway?'
      );
      if (!confirmed) return;
    }
    setLocked(nextLocked);
  };

  return (
    <ControlButton
      type="button"
      className="react-flow__controls-interactive"
      onClick={onToggle}
      title={locked ? 'Unlock canvas' : 'Lock canvas'}
      aria-label={locked ? 'Unlock canvas' : 'Lock canvas'}
      aria-pressed={locked}
    >
      {locked ? <LockIcon /> : <UnlockIcon />}
    </ControlButton>
  );
});

FlowInteractiveToggle.displayName = 'FlowInteractiveToggle';

/**
 * Headless bridge: mirrors the graph store's `locked` flag onto ReactFlow's
 * interactivity flags so a locked canvas can't be dragged or connected. `locked`
 * is the single source of truth (it's also readable from outside the ReactFlow
 * subtree, where these flags aren't); this keeps the pointer-level affordances
 * in step with it.
 *
 * Selection stays enabled regardless of lock: clicking a node or edge opens the
 * properties pane for read-only inspection (e.g. loaded data values), which is
 * the whole point of a locked, data-bound canvas. Selection doesn't renumber
 * anything, and the destructive paths it could feed (delete) are guarded in the
 * store.
 */
export const LockSyncBridge = memo(() => {
  const store = useStoreApi();
  const locked = useGraphStore((s) => s.locked);

  useEffect(() => {
    store.setState({
      nodesDraggable: !locked,
      nodesConnectable: !locked,
      elementsSelectable: true,
    });
  }, [locked, store]);

  return null;
});

LockSyncBridge.displayName = 'LockSyncBridge';

/**
 * Headless bridge: locks the canvas whenever a dataset is loaded. A modified
 * canvas renders to data that no longer matches, so loading data drops the
 * canvas into a safe, read-only state until the user explicitly unlocks.
 * Watches the data store's `loadCount` so every load — not just the first —
 * re-locks. `LockSyncBridge` then disables dragging and connecting (selection
 * stays on for inspection).
 */
export const DataFreezeBridge = memo(() => {
  const loadCount = useDataStore((s) => s.loadCount);
  const prevLoadCount = useRef(loadCount);

  useEffect(() => {
    if (loadCount !== prevLoadCount.current) {
      prevLoadCount.current = loadCount;
      useGraphStore.getState().setLocked(true);
    }
  }, [loadCount]);

  return null;
});

DataFreezeBridge.displayName = 'DataFreezeBridge';

/**
 * Headless bridge: fits the freshly-loaded graph into view whenever a saved
 * case is applied. Loading a file can leave the viewport positioned far from
 * the loaded nodes; watching the graph store's `viewFitNonce` re-centers them.
 *
 * The fit is measurement-driven rather than time-based: it waits for
 * `useNodesInitialized` so every loaded node has reported its measured size
 * before framing them. Because that hook can still read the *previous* graph's
 * initialized state on the render the nonce bumps (ReactFlow processes the new
 * nodes in a later effect), we wait for the initialized flag to fall to false
 * and rise back to true after each load — the false→true edge guarantees the
 * loaded nodes, not the old ones, are what got measured. The initial mount is
 * skipped so the empty default canvas isn't fitted on startup.
 */
export const FitViewBridge = memo(() => {
  const { reactFlowInstance } = useReactFlow();
  const viewFitNonce = useGraphStore((s) => s.viewFitNonce);
  const nodesInitialized = useNodesInitialized();

  const lastNonce = useRef(viewFitNonce);
  // 'idle' → nothing pending; 'armed' → load seen, awaiting the unmeasured
  // (false) window; 'awaiting' → unmeasured window seen, awaiting measurement.
  const phase = useRef<'idle' | 'armed' | 'awaiting'>('idle');

  useEffect(() => {
    if (viewFitNonce !== lastNonce.current) {
      lastNonce.current = viewFitNonce;
      phase.current = 'armed';
    }

    // New nodes mount unmeasured, so the flag drops to false first; only then do
    // we wait for it to come back true, ignoring any stale true from before.
    if (phase.current === 'armed' && !nodesInitialized) {
      phase.current = 'awaiting';
    }

    if (phase.current === 'awaiting' && nodesInitialized) {
      phase.current = 'idle';
      reactFlowInstance?.fitView({ padding: 0.2, duration: 400 });
    }
  }, [viewFitNonce, nodesInitialized, reactFlowInstance]);

  return null;
});

FitViewBridge.displayName = 'FitViewBridge';

/**
 * Headless bridge: fulfills "scale to visible" requests from the Data pane.
 * Recomputes the target's colormap min/max from only the elements currently
 * within the canvas viewport. Lives inside ReactFlow so it can read the live
 * viewport transform and node geometry from the flow store.
 */
export const ScaleToVisibleBridge = memo(() => {
  const store = useStoreApi();
  const scaleRequest = useDataStore((s) => s.scaleRequest);
  const prevSeq = useRef(scaleRequest?.seq ?? 0);

  useEffect(() => {
    if (!scaleRequest || scaleRequest.seq === prevSeq.current) return;
    prevSeq.current = scaleRequest.seq;
    const target = scaleRequest.target;

    const item = selectActiveItem(useDataStore.getState(), target);
    if (!item) {
      logger.warn(`Scale to visible: select a ${target} variable first.`);
      return;
    }

    // Visible region in flow coordinates, derived from the live viewport.
    const { width, height, transform } = store.getState();
    const [tx, ty, zoom] = transform;
    if (!width || !height || !zoom) return;
    const viewMinX = -tx / zoom;
    const viewMinY = -ty / zoom;
    const viewMaxX = (width - tx) / zoom;
    const viewMaxY = (height - ty) / zoom;

    const nodeInternals = store.getState().nodeInternals;
    const graph = useGraphStore.getState();

    // Resolve the value mapped to an element via its generated index; a
    // per-frame item is read at the playback cursor's current frame.
    const itemValues = currentFrameValues(useDataStore.getState(), item);
    const valueAtIndex = (index: unknown): number | null => {
      if (typeof index !== 'number' || index < 0 || index >= itemValues.length) return null;
      const value = itemValues[index];
      return Number.isFinite(value) ? value : null;
    };

    const values: number[] = [];

    if (target === 'node') {
      nodeInternals.forEach((node, id) => {
        const pos = node.positionAbsolute ?? node.position;
        const w = node.width ?? 0;
        const h = node.height ?? 0;
        const intersects =
          pos.x <= viewMaxX && pos.x + w >= viewMinX && pos.y <= viewMaxY && pos.y + h >= viewMinY;
        if (!intersects) return;
        const value = valueAtIndex(graph.nodeStates[id]?.parameters?.index);
        if (value !== null) values.push(value);
      });
    } else {
      // An edge counts as visible when either endpoint node's center is in view.
      const centerInView = (nodeId: string): boolean => {
        const node = nodeInternals.get(nodeId);
        if (!node) return false;
        const pos = node.positionAbsolute ?? node.position;
        const cx = pos.x + (node.width ?? 0) / 2;
        const cy = pos.y + (node.height ?? 0) / 2;
        return cx >= viewMinX && cx <= viewMaxX && cy >= viewMinY && cy <= viewMaxY;
      };
      for (const edge of graph.edges) {
        if (!centerInView(edge.source) && !centerInView(edge.target)) continue;
        const value = valueAtIndex(graph.edgeStates[edge.id]?.parameters?.index);
        if (value !== null) values.push(value);
      }
    }

    if (values.length === 0) {
      logger.warn(`Scale to visible: no ${target} values are currently in view.`);
      return;
    }

    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    if (min === max) max = min + 1; // keep the colormap spanning a visible interval

    useDataStore.getState().setRange(target, min, max);
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toPrecision(4));
    logger.info(
      `Scaled ${target} colormap to visible range [${fmt(min)}, ${fmt(max)}] ` +
        `(${values.length} element${values.length === 1 ? '' : 's'}).`
    );
  }, [scaleRequest, store]);

  return null;
});

ScaleToVisibleBridge.displayName = 'ScaleToVisibleBridge';
