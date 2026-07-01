import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, memo } from 'react';
import { Handle, useReactFlow, useUpdateNodeInternals, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { IoChevronForward } from 'react-icons/io5';
import '../../styles/custom-node.css';
import { useGraphStore } from '../../store/graphStore';
import { useDataStore, useElementDataView, formatDataValue } from '../../store/dataStore';
import { buildIncidentEdgesSignature } from '../../store/graph-selectors';
import { useAppearanceState, useGridState, useRotationState } from '../../context/AppStateContext';
import { useModel } from '../../context/ModelContext';
import { debugLog } from '../../utils/debug';
import { computePortLayout, groupPortsBySide } from '../../utils/ports';
import type { PlacedPort } from '../../utils/ports';
import type {
  ParameterChangeHandler,
  ElementInfoEntry,
  NodePorts,
  PortPlacements,
  PortSide,
} from '../../types/flow';

type ResizeSession = {
  startX?: number;
  startY?: number;
  startWidth?: number;
  startHeight?: number;
  pendingWidth?: number;
  pendingHeight?: number;
  updateTimer?: ReturnType<typeof setTimeout>;
  rafId?: number;
  cleanup?: () => void;
};

/**
 * Base configuration object that defines common properties for all nodes.
 */
export const baseElementInfo: ElementInfoEntry = {
  parameters: {
    label: {
      label: 'Label',
      type: 'string',
      defaultValue: 'Node',
      category: 'General',
      description: 'Display name of the node',
    },
    width: {
      label: 'Width',
      type: 'number',
      defaultValue: undefined,
      category: 'Appearance',
      description: 'Width of the node in pixels',
      min: 10,
      step: 1,
      unit: 'px',
    },
    height: {
      label: 'Height',
      type: 'number',
      defaultValue: undefined,
      category: 'Appearance',
      description: 'Height of the node in pixels',
      min: 10,
      step: 1,
      unit: 'px',
    },
    index: {
      label: 'Index',
      type: 'number',
      defaultValue: undefined,
      category: 'Connectivity',
      description: 'Sequential index assigned to this element',
      editable: false,
      visible: true,
    },
  },
  ports: {
    target: [],
    source: [],
  },
  onParameterChange: {
    '*': ((_nodeId, _paramName, _value, _oldValue, _tempNodeStates, _edges, _edgeStates) => {
      return { isValid: true };
    }) as ParameterChangeHandler,
  },
};

/** Maps a port's presentational side to the React Flow handle position. */
const SIDE_POSITION: Record<PortSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

/** Sides offered as drop targets while a port is in move-mode. */
const ALL_SIDES: PortSide[] = ['top', 'right', 'bottom', 'left'];

/** Arrow key → destination edge, so a moving port can be sent with the keyboard. */
const ARROW_KEY_SIDE: Record<string, PortSide> = {
  ArrowUp: 'top',
  ArrowDown: 'bottom',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const GenericNode = ({ id, selected, type, data }: NodeProps) => {
  // Per-node selectors: re-render when this node's state, editing state, or
  // incident edges change — not on unrelated edge updates or node drags.
  const nodeState = useGraphStore((s) => s.nodeStates[id]);
  const editingState = useGraphStore((s) => s.editingStates[id]);
  // Boolean selector (stable) — re-renders only when this node's highlight flips.
  const isHighlighted = useGraphStore((s) => s.highlightedNodeIds.includes(id));
  // Subscribe to the edges array reference (O(1)) and derive the incident-edge
  // signature with useMemo so the scan only runs when edges actually change,
  // not on every store update (e.g. each node-drag tick).
  const edges = useGraphStore((s) => s.edges);
  const incidentEdgesSignature = useMemo(() => buildIncidentEdgesSignature(edges, id), [edges, id]);
  const updateNodeParameter = useGraphStore((s) => s.updateNodeParameter);
  const setNodeDimensions = useGraphStore((s) => s.setNodeDimensions);
  const setNodeRotation = useGraphStore((s) => s.setNodeRotation);
  const updateEdges = useGraphStore((s) => s.updateEdges);
  const contextStartEditing = useGraphStore((s) => s.startEditing);
  const contextOnChange = useGraphStore((s) => s.onChange);
  const contextOnKeyDown = useGraphStore((s) => s.onKeyDown);
  const contextFinishEditing = useGraphStore((s) => s.finishEditing);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const setPortPlacement = useGraphStore((s) => s.setPortPlacement);
  const setActivePort = useGraphStore((s) => s.setActivePort);
  // The suffix of this node's port currently in move-mode, or null. A primitive
  // selector so a change to the active port only re-renders the two nodes it
  // moves between, not the whole canvas.
  const activePortSuffix = useGraphStore((s) =>
    s.activePort && s.activePort.nodeId === id ? s.activePort.port : null
  );
  const { getNode, getZoom } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { model } = useModel();
  const { snapToGrid, size: gridSize } = useGridState();
  const { snap: rotationSnap, increment: rotationIncrement } = useRotationState();
  const { showIndices } = useAppearanceState();

  // Data visualization: color this node by the active node dataset (keyed on
  // the generated index) and optionally print its value below the node.
  const rawIndex = nodeState?.parameters?.index;
  const dataIndex = typeof rawIndex === 'number' ? rawIndex : undefined;
  const dataView = useElementDataView('node', dataIndex);
  const showContour = useDataStore((s) => s.nodeDisplay.showContour);
  const showValues = useDataStore((s) => s.nodeDisplay.showValues);
  const precision = useDataStore((s) => s.nodeDisplay.precision);
  const notation = useDataStore((s) => s.nodeDisplay.notation);

  const nodeRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<ResizeSession>({});
  const [isResizing, setIsResizing] = useState(false);

  const config = type && model ? model.nodeConfig[type] : undefined;
  const editingStateValue = editingState || { isEditing: false, tempLabel: '' };

  /**
   * Computes the ports rendered for this node. For dynamic-port nodes the
   * counts are derived from parameters via `dynamicPortConfig`. Ports are
   * numbered sequentially: targets are `0..(T-1)` and sources `T..(T+S-1)`,
   * matching the positional handle ids used throughout the canvas.
   */
  const calculatedPorts = useMemo<NodePorts>(() => {
    if (!config) {
      return { target: [], source: [] };
    }
    return computePortLayout(
      config.ports,
      config.dynamicPorts,
      config.dynamicPortConfig,
      nodeState?.parameters
    );
  }, [config, nodeState]);

  // Per-port edge overrides live in the node's UI data. Defaults (targets left,
  // sources right) apply to any port without an entry, so this is undefined for
  // untouched nodes and rendering matches the pre-placement behavior exactly.
  const portPlacements = (data as { portPlacements?: PortPlacements } | undefined)?.portPlacements;

  // On-canvas rotation is presentation-only and lives in `node.data` (the UI
  // section), so it round-trips through save/load and history without ever
  // reaching the solver model.
  const rotation =
    typeof (data as { rotation?: unknown } | undefined)?.rotation === 'number'
      ? (data as { rotation: number }).rotation
      : 0;

  // Buckets every port onto the edge it renders on, preserving port numbering.
  const portBuckets = useMemo(
    () => groupPortsBySide(calculatedPorts, portPlacements),
    [calculatedPorts, portPlacements]
  );

  // Moving a port changes which side its handle sits on, so React Flow must
  // re-measure the node's handle geometry for edges to re-route to the new edge.
  const placementSignature = useMemo(() => JSON.stringify(portPlacements ?? {}), [portPlacements]);
  useEffect(() => {
    updateNodeInternals(id);
  }, [placementSignature, id, updateNodeInternals]);

  // The edge the port in move-mode currently sits on (null when nothing is
  // active), so its own ghost target can be shown as the current, inert one.
  const activePortSide = useMemo<PortSide | null>(() => {
    if (activePortSuffix == null) return null;
    return (
      ALL_SIDES.find((side) => portBuckets[side].some((p) => p.suffix === activePortSuffix)) ?? null
    );
  }, [activePortSuffix, portBuckets]);

  // While a port is in move-mode, arrow keys send it to an edge and Escape
  // cancels. Capture phase + stopPropagation so React Flow doesn't also nudge
  // the selected node on the same key press.
  useEffect(() => {
    if (activePortSuffix == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setActivePort(null);
        return;
      }
      const side = ARROW_KEY_SIDE[e.key];
      if (side) {
        e.preventDefault();
        e.stopPropagation();
        setPortPlacement(id, activePortSuffix, side);
        setActivePort(null);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [activePortSuffix, id, setPortPlacement, setActivePort]);

  // When a dynamic-port count shrinks, prune any edges connected to ports that
  // no longer exist. Handle ids are positional, so no renumbering is required.
  useLayoutEffect(() => {
    if (!config?.dynamicPorts || !config.dynamicPortConfig || !nodeState) return;

    try {
      const edges = useGraphStore.getState().edges;
      const targetCount = calculatedPorts.target.length;
      const sourceCount = calculatedPorts.source.length;
      const removedEdgeIds: string[] = [];

      const newEdges = edges.filter((edge) => {
        if (edge.source !== id && edge.target !== id) return true;

        let keepEdge = true;

        if (edge.source === id) {
          const portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
          if (!portMatch) {
            debugLog(`[${id}] Invalid source handle format: ${edge.sourceHandle}`);
            return true;
          }
          const portNumber = parseInt(portMatch[1], 10);
          keepEdge = portNumber >= targetCount && portNumber < targetCount + sourceCount;
        } else if (edge.target === id) {
          const portMatch = edge.targetHandle?.match(/-port-(\d+)$/);
          if (!portMatch) {
            debugLog(`[${id}] Invalid target handle format: ${edge.targetHandle}`);
            return true;
          }
          const portNumber = parseInt(portMatch[1], 10);
          keepEdge = portNumber < targetCount;
        }

        if (!keepEdge) {
          removedEdgeIds.push(edge.id);
        }
        return keepEdge;
      });

      if (removedEdgeIds.length > 0) {
        debugLog(`[${id}] Removed ${removedEdgeIds.length} edges due to port reduction`);
        updateEdges(newEdges, removedEdgeIds);
      }

      updateNodeInternals(id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      debugLog(`[${id}] Error in edge management: ${message}`);
      console.error('Error updating dynamic port edges:', error);
    }
  }, [
    config,
    id,
    nodeState,
    calculatedPorts.target.length,
    calculatedPorts.source.length,
    incidentEdgesSignature,
    updateEdges,
    updateNodeInternals,
  ]);

  const snapToGridSize = (value: number) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const style = useMemo((): React.CSSProperties => {
    // Rotate about the element centre (the default transform-origin), keeping
    // the node's React Flow position/anchor unchanged.
    const base: React.CSSProperties = rotation ? { transform: `rotate(${rotation}deg)` } : {};
    if (!nodeState?.parameters) return base;
    const width = nodeState.parameters.width;
    const height = nodeState.parameters.height;

    if (width || height) {
      return {
        ...base,
        ...(width ? { width: `${width}px` } : {}),
        ...(height ? { height: `${height}px` } : {}),
        boxSizing: 'content-box',
      };
    }
    return base;
  }, [nodeState, rotation]);

  // Rotation changes where the handles sit, so React Flow must re-measure this
  // node's handle geometry for incident edges to re-route to the rotated ports.
  useEffect(() => {
    updateNodeInternals(id);
  }, [rotation, id, updateNodeInternals]);

  const { hasLeftPort, hasRightPort, hasTopPort, hasBottomPort } = useMemo(
    () => ({
      hasLeftPort: portBuckets.left.length > 0,
      hasRightPort: portBuckets.right.length > 0,
      hasTopPort: portBuckets.top.length > 0,
      hasBottomPort: portBuckets.bottom.length > 0,
    }),
    [portBuckets]
  );

  const nodeClasses = [
    'custom-node',
    type,
    selected ? 'custom-node-selected' : '',
    isHighlighted ? 'custom-node-issue' : '',
    hasLeftPort ? 'has-left-port' : '',
    hasRightPort ? 'has-right-port' : '',
    hasTopPort ? 'has-top-port' : '',
    hasBottomPort ? 'has-bottom-port' : '',
    activePortSuffix != null ? 'custom-node--port-move' : '',
    isResizing ? 'resizing' : '',
  ].join(' ');

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);

    const node = getNode(id);
    if (!node || !nodeRef.current) return;

    // Records the pre-resize size once, on the first actual movement, so the
    // whole gesture is a single undo step (and a plain click adds nothing).
    let hasRecorded = false;

    const initialWidth = node.style?.width
      ? parseInt(String(node.style.width), 10)
      : nodeRef.current.offsetWidth;
    const initialHeight = node.style?.height
      ? parseInt(String(node.style.height), 10)
      : nodeRef.current.offsetHeight;

    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: initialWidth,
      startHeight: initialHeight,
    };

    const onPointerMove = (eMove: PointerEvent) => {
      const r = resizeRef.current;
      if (r.startX === undefined || r.startY === undefined) return;

      if (!hasRecorded) {
        recordHistory();
        hasRecorded = true;
      }

      const screenDx = eMove.clientX - r.startX;
      const screenDy = eMove.clientY - r.startY;

      // Project the screen-space drag onto the node's local (possibly rotated)
      // axes so the bottom-right grip still grows width/height along the
      // element's own orientation after it has been rotated.
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const deltaX = screenDx * cos + screenDy * sin;
      const deltaY = -screenDx * sin + screenDy * cos;

      const sw = r.startWidth ?? 0;
      const sh = r.startHeight ?? 0;

      const newWidth = Math.max(snapToGridSize(sw + deltaX), gridSize);
      const newHeight = Math.max(snapToGridSize(sh + deltaY), gridSize);

      const roundedWidth = Math.round(newWidth);
      const roundedHeight = Math.round(newHeight);

      if (nodeRef.current) {
        nodeRef.current.style.width = `${roundedWidth}px`;
        nodeRef.current.style.height = `${roundedHeight}px`;
      }

      resizeRef.current.pendingWidth = roundedWidth;
      resizeRef.current.pendingHeight = roundedHeight;

      if (resizeRef.current.updateTimer) {
        clearTimeout(resizeRef.current.updateTimer);
      }

      resizeRef.current.updateTimer = setTimeout(() => {
        setNodeDimensions(id, roundedWidth, roundedHeight);
      }, 16);
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    const onPointerUp = () => {
      setIsResizing(false);

      if (resizeRef.current.updateTimer) {
        clearTimeout(resizeRef.current.updateTimer);
        resizeRef.current.updateTimer = undefined;
      }

      if (
        resizeRef.current.pendingWidth !== undefined ||
        resizeRef.current.pendingHeight !== undefined
      ) {
        const finalWidth =
          resizeRef.current.pendingWidth ?? resizeRef.current.startWidth ?? initialWidth;
        const finalHeight =
          resizeRef.current.pendingHeight ?? resizeRef.current.startHeight ?? initialHeight;
        setNodeDimensions(id, finalWidth, finalHeight);
        resizeRef.current.pendingWidth = undefined;
        resizeRef.current.pendingHeight = undefined;
      }

      cleanup();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const autoResize = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();

    if (resizeRef.current.rafId) {
      cancelAnimationFrame(resizeRef.current.rafId);
    }

    // One undo step for the reset; the two writes below are applied silently.
    recordHistory();

    resizeRef.current.rafId = requestAnimationFrame(() => {
      updateNodeParameter(id, 'width', undefined, { recordHistory: false });
      updateNodeParameter(id, 'height', undefined, { recordHistory: false });
    });
  };

  const handleRotateStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();

    const rect = nodeRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Rotation pivots on the node centre, which is invariant under the rotation
    // itself, so the centre captured here stays valid for the whole gesture.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startPointerAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRotation = rotation;

    // Record the pre-rotation state once, on the first actual movement, so the
    // whole drag is a single undo step (and a plain click adds nothing).
    let hasRecorded = false;

    const onPointerMove = (ev: PointerEvent) => {
      if (!hasRecorded) {
        recordHistory();
        hasRecorded = true;
      }
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let degrees = startRotation + ((angle - startPointerAngle) * 180) / Math.PI;
      // The settings pane sets whether angles snap and to what increment; holding
      // Shift inverts that choice for the duration of the drag.
      const shouldSnap = rotationSnap !== ev.shiftKey;
      if (shouldSnap && rotationIncrement > 0) {
        degrees = Math.round(degrees / rotationIncrement) * rotationIncrement;
      }
      setNodeRotation(id, degrees, { recordHistory: false });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Alt-double-clicking the corner grip restores the upright orientation.
  const resetRotation = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setNodeRotation(id, 0);
  };

  // The single bottom-right grip drives both gestures: a plain drag resizes,
  // while holding Alt turns the same drag into a rotate-about-centre. Reset is
  // symmetric: plain double-click auto-fits the size, Alt double-click uprights.
  const handleGripPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.altKey) {
      handleRotateStart(e);
      return;
    }
    handleResizeStart(e);
  };

  const handleGripDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.altKey) {
      resetRotation(e);
      return;
    }
    autoResize(e);
  };

  // Renders one port. The React Flow handle `type` is fixed by the port's
  // direction (its physics role), while `position` follows its presentational
  // side — the two are deliberately decoupled. The handle id keeps the port's
  // positional number so connectivity survives any re-placement. Clicking the
  // chip (not the handle dot, which still drags out edges) toggles move-mode;
  // `nodrag` keeps that click from dragging the whole node.
  const renderPort = (port: PlacedPort) => {
    const isActive = activePortSuffix === port.suffix;
    return (
      <div
        key={port.suffix}
        className={`port-wrapper nodrag port-side-${port.side} port-dir-${port.direction}${
          isActive ? ' port-wrapper--active' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation();
          setActivePort(isActive ? null : { nodeId: id, port: port.suffix });
        }}
      >
        <IoChevronForward className="port-icon" />
        <span className="port-index">{port.suffix}</span>
        <Handle
          type={port.direction}
          position={SIDE_POSITION[port.side]}
          id={`${id}-port-${port.suffix}`}
          className={`react-flow__handle custom-handle custom-handle-${port.side}`}
        />
      </div>
    );
  };

  // The four drop targets shown around the node while a port is in move-mode.
  const renderGhostTargets = () => {
    if (activePortSuffix == null) return null;
    return (
      <div className="port-ghost-layer">
        {ALL_SIDES.map((side) => {
          const isCurrent = side === activePortSide;
          return (
            <button
              key={side}
              type="button"
              disabled={isCurrent}
              className={`port-ghost port-ghost-${side}${isCurrent ? ' port-ghost--current' : ''}`}
              title={`Move port ${activePortSuffix} to ${side}`}
              onClick={(e) => {
                e.stopPropagation();
                setPortPlacement(id, activePortSuffix, side);
                setActivePort(null);
              }}
            >
              <IoChevronForward className={`port-ghost-icon port-ghost-icon-${side}`} />
            </button>
          );
        })}
      </div>
    );
  };

  useEffect(() => {
    if (isResizing) {
      return () => {
        if (resizeRef.current.cleanup) {
          resizeRef.current.cleanup();
        }
      };
    }
  }, [isResizing]);

  useEffect(() => {
    if (nodeRef.current && (!nodeState?.parameters?.width || !nodeState?.parameters?.height)) {
      const computedStyle = window.getComputedStyle(nodeRef.current);
      const rect = nodeRef.current.getBoundingClientRect();

      try {
        const paddingValues = computedStyle.padding.split(' ');
        const [paddingTop, paddingRight, paddingBottom, paddingLeft] =
          paddingValues.length === 1
            ? [paddingValues[0], paddingValues[0], paddingValues[0], paddingValues[0]]
            : paddingValues;

        const borderWidth = parseFloat(computedStyle.borderWidth || '0');

        const safeParseFloat = (val: string) => {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? 0 : parsed;
        };

        const pTop = safeParseFloat(paddingTop ?? '0');
        const pRight = safeParseFloat(paddingRight ?? '0');
        const pBottom = safeParseFloat(paddingBottom ?? '0');
        const pLeft = safeParseFloat(paddingLeft ?? '0');
        const bWidth = safeParseFloat(String(borderWidth));

        const zoom = getZoom();
        const unscaledWidth = rect.width / zoom;
        const unscaledHeight = rect.height / zoom;

        const contentWidth = Math.max(0, unscaledWidth - pLeft - pRight - bWidth * 2);
        const contentHeight = Math.max(0, unscaledHeight - pTop - pBottom - bWidth * 2);

        if (contentWidth > 0 && contentHeight > 0) {
          // Initial auto-measured size is derived state, not a user action, so
          // it must not create undo steps (otherwise undoing an add/move would
          // first revert these silent size writes). Written as a single store
          // update so a freshly-mounted graph doesn't pay two render passes per
          // node.
          setNodeDimensions(id, Math.round(contentWidth), Math.round(contentHeight));
        }
      } catch (error) {
        console.error('Error calculating node dimensions:', error);
      }
    }
  }, [nodeState, id, setNodeDimensions, getZoom]);

  if (!config) {
    console.error(`No configuration found for node type: ${type}`);
    return null;
  }

  if (!nodeState || !nodeState.parameters || !nodeState.parameters.label) {
    return null;
  }

  const TypeIcon = config.icon;
  const elementIndex = nodeState.parameters.index;
  const elementIndexLabel =
    showIndices && typeof elementIndex === 'number' ? elementIndex : undefined;

  return (
    <div className={nodeClasses} ref={nodeRef} style={style}>
      {showContour && dataView.color && (
        <div
          className="custom-node-data-strip"
          style={{ background: dataView.color }}
          aria-hidden
        />
      )}
      {elementIndexLabel !== undefined && (
        <span className="element-index-label port-index">{elementIndexLabel}</span>
      )}
      {showValues && dataView.value !== undefined && (
        <span className="custom-node-data-value">
          {formatDataValue(dataView.value, precision, notation, dataView.unit)}
        </span>
      )}
      {hasTopPort && (
        <div className="custom-port-container custom-port-top">
          {portBuckets.top.map(renderPort)}
        </div>
      )}
      <div className="custom-port-container custom-port-left">
        {portBuckets.left.map(renderPort)}
      </div>

      <div className="middle-section">
        {TypeIcon && <TypeIcon className="node-type-icon" />}
        <div className="custom-node-content">
          {editingStateValue.isEditing ? (
            <input
              value={editingStateValue.tempLabel}
              onChange={(e) => contextOnChange(id, e)}
              onBlur={() => contextFinishEditing(id, { fromBlur: true })}
              onKeyDown={(e) => contextOnKeyDown(id, e)}
              autoFocus
              className="custom-node-input"
              spellCheck={false}
              // Size the field to its text so swapping the label for the input
              // doesn't abruptly resize the node (the default ~20-char width
              // would overflow a short label).
              size={Math.max(editingStateValue.tempLabel.length, 1)}
            />
          ) : (
            <div className="custom-node-label" onDoubleClick={() => contextStartEditing(id)}>
              {String(nodeState.parameters.label)}
            </div>
          )}
          <div className="custom-node-type">{type}</div>
        </div>
      </div>

      <div className="custom-port-container custom-port-right">
        {portBuckets.right.map(renderPort)}
      </div>
      {hasBottomPort && (
        <div className="custom-port-container custom-port-bottom">
          {portBuckets.bottom.map(renderPort)}
        </div>
      )}

      {renderGhostTargets()}

      {selected && (
        <div
          className="resize-handle"
          onPointerDown={handleGripPointerDown}
          onDoubleClick={handleGripDoubleClick}
          title={
            'Drag to resize • Alt-drag to rotate (Shift toggles angle snapping)\n' +
            'Double-click resets size • Alt-double-click resets rotation'
          }
        />
      )}
    </div>
  );
};

export default memo(GenericNode);
