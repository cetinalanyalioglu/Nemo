import { memo, useCallback } from 'react';
import type { Node, NodeChange } from 'reactflow';
import { useReactFlow } from '../context/ReactFlowContext';
import { useGraphStore } from '../store/graphStore';
import { alignToAnchor, pickAnchor } from '../utils/align-nodes';
import type { AlignAxis, AlignCandidate } from '../utils/align-nodes';
import '../styles/canvas-align.css';

/** Sizes to fall back on when a node's real one cannot be had; mirrors the layout engine. */
const DEFAULT_NODE_WIDTH = 150;
const DEFAULT_NODE_HEIGHT = 50;

/** An explicit style size as a number, where it is one: `150` and `'150px'` both read. */
const styleLength = (value: string | number | undefined): number => {
  const length = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(length) ? length : 0;
};

/** Every node React Flow currently has on the canvas, by id. */
const renderedNodes = (): Map<string, HTMLElement> => {
  const byId = new Map<string, HTMLElement>();
  document.querySelectorAll<HTMLElement>('.react-flow__node').forEach((element) => {
    const id = element.dataset.id;
    if (id) byId.set(id, element);
  });
  return byId;
};

/**
 * The selected nodes, each with the size its center has to be worked out from.
 *
 * React Flow measures a node once it has rendered and hands the result back on the
 * node itself, which is the answer whenever there is one. A node added moments ago
 * has none yet, and a guess is not harmless there: the size is what places the center,
 * so a wrong one drops that node off the line everything else landed on. The DOM is
 * asked instead — `offsetWidth` is the layout size, which the canvas's zoom transform
 * scales on screen but does not change, so it is already in the units positions are
 * written in. Collected in one pass, and only when something is actually missing, so
 * the usual case costs nothing.
 *
 * A node the canvas is not rendering at all — a hidden note — reaches neither, and
 * falls back to whatever size it declares and then to the default.
 */
const alignCandidates = (nodes: Node[]): AlignCandidate[] => {
  const measured = (node: Node): boolean =>
    typeof node.width === 'number' && typeof node.height === 'number';
  const elements = nodes.every(measured) ? null : renderedNodes();

  return nodes.map((node) => {
    const element = elements?.get(node.id);
    return {
      id: node.id,
      position: node.position,
      width:
        typeof node.width === 'number'
          ? node.width
          : element?.offsetWidth || styleLength(node.style?.width) || DEFAULT_NODE_WIDTH,
      height:
        typeof node.height === 'number'
          ? node.height
          : element?.offsetHeight || styleLength(node.style?.height) || DEFAULT_NODE_HEIGHT,
    };
  });
};

/** Rows aligned on a shared horizontal centerline (equalizes the vertical centers). */
const AlignHorizontalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <line x1="2" y1="12" x2="22" y2="12" strokeWidth="1.4" />
    <rect x="5" y="5" width="5" height="14" rx="1" strokeWidth="2" strokeLinejoin="round" />
    <rect x="14" y="8" width="5" height="8" rx="1" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/** Columns aligned on a shared vertical centerline (equalizes the horizontal centers). */
const AlignVerticalIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
    <line x1="12" y1="2" x2="12" y2="22" strokeWidth="1.4" />
    <rect x="5" y="5" width="14" height="5" rx="1" strokeWidth="2" strokeLinejoin="round" />
    <rect x="8" y="14" width="8" height="5" rx="1" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

/**
 * On-canvas control that aligns the centers of the selected nodes. Horizontal
 * alignment drops every selection onto a shared horizontal centerline (a row);
 * vertical alignment onto a shared vertical centerline (a column). Enabled only
 * when two or more nodes are selected.
 *
 * The line is one of the selected nodes' own — the last one clicked, where that is
 * among them (see `pickAnchor`). Aligning to a node rather than to the selection's
 * average means the element already placed where it belongs is the one that stays
 * there, the result does not shift when another node joins the selection, and the
 * row lands wherever that node was: on the grid, if it was.
 *
 * Mirrors `AutoLayoutControl`: it reads measured geometry from the ReactFlow
 * instance, then commits one batch of position changes behind a single
 * `recordHistory()` so the whole align is a single undo step.
 */
const CanvasAlignControls = memo(() => {
  const { reactFlowInstance } = useReactFlow();
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  // Count reactively so the buttons enable/disable as the selection changes.
  const selectedCount = useGraphStore((s) =>
    s.nodes.reduce((count, node) => count + (node.selected ? 1 : 0), 0)
  );

  const align = useCallback(
    (axis: AlignAxis) => {
      if (!reactFlowInstance) return;
      const selected = reactFlowInstance.getNodes().filter((node) => node.selected);
      if (selected.length < 2) return;

      const candidates = alignCandidates(selected);
      // Read at click time rather than subscribed to: which node is the anchor only
      // matters the moment the button is pressed, and nothing here re-renders on it.
      const lastClicked = useGraphStore.getState().selectedNodeId;
      const anchor = pickAnchor(candidates, axis, lastClicked);
      if (!anchor) return;

      const changes: NodeChange[] = alignToAnchor(candidates, axis, anchor).map((move) => ({
        type: 'position',
        id: move.id,
        position: move.position,
      }));
      if (changes.length === 0) return;

      recordHistory();
      onNodesChange(changes);
    },
    [reactFlowInstance, onNodesChange, recordHistory]
  );

  const disabled = selectedCount < 2;

  return (
    <div className="canvas-align-controls">
      <button
        type="button"
        className="canvas-align-button"
        onClick={() => align('horizontal')}
        disabled={disabled}
        title="Align selected nodes horizontally (centers to a shared row, on the last one clicked)"
        aria-label="Align selected nodes horizontally"
      >
        <AlignHorizontalIcon />
      </button>
      <button
        type="button"
        className="canvas-align-button"
        onClick={() => align('vertical')}
        disabled={disabled}
        title="Align selected nodes vertically (centers to a shared column, on the last one clicked)"
        aria-label="Align selected nodes vertically"
      >
        <AlignVerticalIcon />
      </button>
    </div>
  );
});

CanvasAlignControls.displayName = 'CanvasAlignControls';

export default CanvasAlignControls;
