import { memo, useCallback } from 'react';
import type { Node, NodeChange } from 'reactflow';
import { useReactFlow } from '../context/ReactFlowContext';
import { useGraphStore } from '../store/graphStore';
import '../styles/canvas-align.css';

/** Which axis of the selected nodes' centers gets equalized. */
type AlignAxis = 'horizontal' | 'vertical';

/**
 * A node's rendered size. Prefers ReactFlow's measured dimensions (so centers
 * use the real on-canvas size), falling back to an explicit style size then a
 * default — mirroring the layout engine's `nodeSize`.
 */
const nodeSize = (node: Node): { width: number; height: number } => ({
  width: (typeof node.width === 'number' ? node.width : Number(node.style?.width)) || 150,
  height: (typeof node.height === 'number' ? node.height : Number(node.style?.height)) || 50,
});

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

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
 * vertical alignment onto a shared vertical centerline (a column). The target
 * line is the mean of the selected centers, so the group stays put on average.
 * Enabled only when two or more nodes are selected.
 *
 * Mirrors `AutoLayoutControl`: it reads measured geometry from the ReactFlow
 * instance, then commits one batch of position changes behind a single
 * `recordHistory()` so the whole align is a single undo step. Centers are
 * rotation-invariant (rotation pivots on the center), so rotated nodes need no
 * special handling.
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

      const centers = selected.map((node) => {
        const { width, height } = nodeSize(node);
        return {
          node,
          width,
          height,
          cx: node.position.x + width / 2,
          cy: node.position.y + height / 2,
        };
      });
      const targetX = mean(centers.map((c) => c.cx));
      const targetY = mean(centers.map((c) => c.cy));

      const changes: NodeChange[] = [];
      for (const c of centers) {
        const position =
          axis === 'vertical'
            ? { x: targetX - c.width / 2, y: c.node.position.y }
            : { x: c.node.position.x, y: targetY - c.height / 2 };
        // Skip nodes already on the line so an aligned selection adds no undo step.
        if (position.x !== c.node.position.x || position.y !== c.node.position.y) {
          changes.push({ type: 'position', id: c.node.id, position });
        }
      }
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
        title="Align selected nodes horizontally (centers to a shared row)"
        aria-label="Align selected nodes horizontally"
      >
        <AlignHorizontalIcon />
      </button>
      <button
        type="button"
        className="canvas-align-button"
        onClick={() => align('vertical')}
        disabled={disabled}
        title="Align selected nodes vertically (centers to a shared column)"
        aria-label="Align selected nodes vertically"
      >
        <AlignVerticalIcon />
      </button>
    </div>
  );
});

CanvasAlignControls.displayName = 'CanvasAlignControls';

export default CanvasAlignControls;
