import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, memo } from 'react';
import { Handle, useReactFlow, useUpdateNodeInternals, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import '../../styles/custom-node.css';
import { useGraphStore } from '../../store/graphStore';
import { selectIncidentEdgesSignature } from '../../store/graph-selectors';
import { useAppearanceState, useGridState } from '../../context/AppStateContext';
import { useModel } from '../../context/ModelContext';
import { debugLog } from '../../utils/debug';
import type {
  ParameterChangeHandler,
  ElementInfoEntry,
  DynamicPortSide,
  NodePorts,
} from '../../types/flow';

/**
 * Resolves the number of ports for one side of a node. When the side is driven
 * by a parameter (`countParameter`), the value is read from the node state and
 * clamped to the configured minimum; otherwise the static port count is used.
 */
const resolvePortCount = (
  side: DynamicPortSide | undefined,
  staticPorts: string[],
  parameters: Record<string, unknown> | undefined
): number => {
  if (!side || !side.countParameter) {
    return staticPorts.length;
  }
  const min = side.min ?? 0;
  const fallback = Math.max(min, side.default ?? staticPorts.length);
  const raw = parameters?.[side.countParameter];
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const parsed = parseInt(String(raw), 10);
  return isNaN(parsed) ? fallback : Math.max(min, parsed);
};

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
    solverIndex: {
      label: 'Index',
      type: 'number',
      defaultValue: undefined,
      category: 'Connectivity',
      description: 'Index used by the network solver',
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

const GenericNode = ({ id, selected, type, data: _data }: NodeProps) => {
  // Per-node selectors: re-render when this node's state, editing state, or
  // incident edges change — not on unrelated edge updates or node drags.
  const nodeState = useGraphStore((s) => s.nodeStates[id]);
  const editingState = useGraphStore((s) => s.editingStates[id]);
  const incidentEdgesSignature = useGraphStore(selectIncidentEdgesSignature(id));
  const updateNodeParameter = useGraphStore((s) => s.updateNodeParameter);
  const updateEdges = useGraphStore((s) => s.updateEdges);
  const contextStartEditing = useGraphStore((s) => s.startEditing);
  const contextOnChange = useGraphStore((s) => s.onChange);
  const contextOnKeyDown = useGraphStore((s) => s.onKeyDown);
  const contextFinishEditing = useGraphStore((s) => s.finishEditing);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const { getNode, getZoom } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const { model } = useModel();
  const { snapToGrid, size: gridSize } = useGridState();
  const { showSolverIndices } = useAppearanceState();
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
    if (!config.dynamicPorts || !config.dynamicPortConfig) {
      return config.ports || { target: [], source: [] };
    }

    const dynamic = config.dynamicPortConfig;
    const params = nodeState?.parameters;

    const targetCount = resolvePortCount(dynamic.target, config.ports.target, params);
    const sourceCount = resolvePortCount(dynamic.source, config.ports.source, params);

    const target = dynamic.target?.countParameter
      ? Array.from({ length: targetCount }, (_, index) => `${index}`)
      : config.ports.target;
    const source = dynamic.source?.countParameter
      ? Array.from({ length: sourceCount }, (_, index) => `${targetCount + index}`)
      : config.ports.source;

    return { target, source };
  }, [config, nodeState]);

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
    if (!nodeState?.parameters) return {};
    const width = nodeState.parameters.width;
    const height = nodeState.parameters.height;

    if (width || height) {
      return {
        ...(width ? { width: `${width}px` } : {}),
        ...(height ? { height: `${height}px` } : {}),
        boxSizing: 'content-box',
      };
    }
    return {};
  }, [nodeState]);

  const portSetup = useMemo(() => {
    const targetPorts = Array.isArray(calculatedPorts.target) ? calculatedPorts.target : [];
    const sourcePorts = Array.isArray(calculatedPorts.source) ? calculatedPorts.source : [];
    return {
      targetPorts,
      sourcePorts,
      hasLeftPort: targetPorts.length > 0,
      hasRightPort: sourcePorts.length > 0,
    };
  }, [calculatedPorts]);

  const { targetPorts, sourcePorts, hasLeftPort, hasRightPort } = portSetup;

  const nodeClasses = [
    'custom-node',
    type,
    selected ? 'custom-node-selected' : '',
    hasLeftPort ? 'has-left-port' : '',
    hasRightPort ? 'has-right-port' : '',
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

      const deltaX = eMove.clientX - r.startX;
      const deltaY = eMove.clientY - r.startY;

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
        updateNodeParameter(id, 'width', roundedWidth, { recordHistory: false });
        updateNodeParameter(id, 'height', roundedHeight, { recordHistory: false });
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
        updateNodeParameter(id, 'width', finalWidth, { recordHistory: false });
        updateNodeParameter(id, 'height', finalHeight, { recordHistory: false });
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

  const renderTargetPorts = useMemo(() => {
    return targetPorts.map((portId) => (
      <div key={portId} className="port-wrapper port-wrapper-left port-wrapper-target">
        <IoChevronForward className="port-icon port-icon-target" />
        <span className="port-index">{portId}</span>
        <Handle
          type="target"
          position={Position.Left}
          id={`${id}-port-${portId}`}
          className="react-flow__handle custom-handle-target"
        />
      </div>
    ));
  }, [targetPorts, id]);

  const renderSourcePorts = useMemo(() => {
    return sourcePorts.map((portId, idx) => {
      const portIndex = targetPorts.length + idx;
      return (
        <div key={portId} className="port-wrapper port-wrapper-right port-wrapper-source">
          <span className="port-index">{portIndex}</span>
          <IoChevronBack className="port-icon port-icon-source" />
          <Handle
            type="source"
            position={Position.Right}
            id={`${id}-port-${portIndex}`}
            className="react-flow__handle custom-handle-source"
          />
        </div>
      );
    });
  }, [sourcePorts, targetPorts.length, id]);

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
          // first revert these silent size writes).
          updateNodeParameter(id, 'width', Math.round(contentWidth), { recordHistory: false });
          updateNodeParameter(id, 'height', Math.round(contentHeight), { recordHistory: false });
        }
      } catch (error) {
        console.error('Error calculating node dimensions:', error);
      }
    }
  }, [nodeState, id, updateNodeParameter, getZoom]);

  if (!config) {
    console.error(`No configuration found for node type: ${type}`);
    return null;
  }

  if (!nodeState || !nodeState.parameters || !nodeState.parameters.label) {
    return null;
  }

  const TypeIcon = config.icon;
  const solverIndex = nodeState.parameters.solverIndex;
  const solverIndexLabel =
    showSolverIndices && typeof solverIndex === 'number' ? solverIndex : undefined;

  return (
    <div className={nodeClasses} ref={nodeRef} style={style}>
      {solverIndexLabel !== undefined && (
        <span className="solver-index-label port-index">{solverIndexLabel}</span>
      )}
      <div className="custom-port-container custom-port-left">{renderTargetPorts}</div>

      <div className="middle-section">
        {TypeIcon && <TypeIcon className="node-type-icon" />}
        <div className="custom-node-content">
          {editingStateValue.isEditing ? (
            <input
              value={editingStateValue.tempLabel}
              onChange={(e) => contextOnChange(id, e)}
              onBlur={() => contextFinishEditing(id)}
              onKeyDown={(e) => contextOnKeyDown(id, e)}
              autoFocus
              className="custom-node-input"
              spellCheck={false}
            />
          ) : (
            <div className="custom-node-label" onDoubleClick={() => contextStartEditing(id)}>
              {String(nodeState.parameters.label)}
            </div>
          )}
          <div className="custom-node-type">{type}</div>
        </div>
      </div>

      <div className="custom-port-container custom-port-right">{renderSourcePorts}</div>

      {selected && (
        <div
          className="resize-handle"
          onPointerDown={handleResizeStart}
          onDoubleClick={autoResize}
        />
      )}
    </div>
  );
};

export default memo(GenericNode);
