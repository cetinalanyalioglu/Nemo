import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Handle, useReactFlow, useUpdateNodeInternals, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import '../../styles/custom-node.css';
import { nodeConfig } from '../../config/nodeConfig';
import { useNodeContext } from '../../context/NodeContext';
import { useAppState } from '../../context/AppStateContext';
import { debugLog } from '../../utils/debug';
import type { ParameterChangeHandler, ElementInfoEntry } from '../../types/flow';

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
      label: 'Solver Index',
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
  const {
    nodeStates,
    updateNodeParameter,
    edges,
    updateEdges,
    editingStates,
    startEditing: contextStartEditing,
    onChange: contextOnChange,
    onKeyDown: contextOnKeyDown,
    finishEditing: contextFinishEditing,
  } = useNodeContext();
  const { getNode } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const {
    grid: { snapToGrid, size: gridSize },
    viewport: { zoom },
  } = useAppState();
  const nodeRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<ResizeSession>({});
  const [isResizing, setIsResizing] = useState(false);

  const config = type ? nodeConfig[type as keyof typeof nodeConfig] : undefined;
  const nodeState = nodeStates[id];
  const editingState = editingStates[id] || { isEditing: false, tempLabel: '' };

  const calculatedPorts = useMemo(() => {
    if (!config || !config.dynamicPorts) {
      return config?.ports || { target: [], source: [] };
    }

    if (type === 'Junction') {
      const leftPortCount = (() => {
        if (!nodeState?.parameters?.leftPorts) return 2;
        const parsed = parseInt(String(nodeState.parameters.leftPorts), 10);
        return isNaN(parsed) ? 2 : Math.max(1, parsed);
      })();

      const rightPortCount = (() => {
        if (!nodeState?.parameters?.rightPorts) return 1;
        const parsed = parseInt(String(nodeState.parameters.rightPorts), 10);
        return isNaN(parsed) ? 1 : Math.max(1, parsed);
      })();

      const leftPorts = Array.from({ length: leftPortCount }, (_, index) => `${index}`);
      const rightPorts = Array.from(
        { length: rightPortCount },
        (_, index) => `${leftPortCount + index}`
      );

      return { target: leftPorts, source: rightPorts };
    } else if (type === 'LosslessSplitter') {
      const rightPortCount = (() => {
        if (!nodeState?.parameters?.rightPorts) return 2;
        const parsed = parseInt(String(nodeState.parameters.rightPorts), 10);
        return isNaN(parsed) ? 2 : Math.max(2, parsed);
      })();

      const rightPorts = Array.from({ length: rightPortCount }, (_, index) => `${index + 1}`);
      return { target: ['0'], source: rightPorts };
    }

    return config.ports;
  }, [config, type, nodeState]);

  useLayoutEffect(() => {
    if (!config?.dynamicPorts || !nodeState || !edges) return;

    try {
      let needsUpdate = false;
      const removedEdgeIds: string[] = [];
      let handlesUpdated = 0;
      const currentEdges = [...edges];

      if (type === 'Junction') {
        const leftPortCount = (() => {
          if (!nodeState?.parameters?.leftPorts) return 2;
          const parsed = parseInt(String(nodeState.parameters.leftPorts), 10);
          return isNaN(parsed) ? 2 : Math.max(1, parsed);
        })();

        const rightPortCount = (() => {
          if (!nodeState?.parameters?.rightPorts) return 1;
          const parsed = parseInt(String(nodeState.parameters.rightPorts), 10);
          return isNaN(parsed) ? 1 : Math.max(1, parsed);
        })();

        const newEdges = currentEdges.filter((edge) => {
          if (edge.source !== id && edge.target !== id) return true;

          let portMatch: RegExpMatchArray | null;
          let portNumber: number;
          let keepEdge = true;

          if (edge.source === id) {
            portMatch = edge.sourceHandle?.match(/-port-(\d+)$/) ?? null;
            if (!portMatch) {
              debugLog(`[${id}] Invalid source handle format: ${edge.sourceHandle}`);
              return true;
            }
            portNumber = parseInt(portMatch[1], 10);
            keepEdge = portNumber >= leftPortCount && portNumber < leftPortCount + rightPortCount;
          } else if (edge.target === id) {
            portMatch = edge.targetHandle?.match(/-port-(\d+)$/) ?? null;
            if (!portMatch) {
              debugLog(`[${id}] Invalid target handle format: ${edge.targetHandle}`);
              return true;
            }
            portNumber = parseInt(portMatch[1], 10);
            keepEdge = portNumber < leftPortCount;
          }

          if (!keepEdge) {
            removedEdgeIds.push(edge.id);
            needsUpdate = true;
          }
          return keepEdge;
        });

        newEdges.forEach((edge) => {
          let updated = false;
          let newEdge = { ...edge };

          if (edge.source === id) {
            const portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
            if (portMatch) {
              const portNumber = parseInt(portMatch[1], 10);
              const newSourceHandle = `${id}-port-${portNumber}`;
              if (newSourceHandle !== edge.sourceHandle) {
                newEdge.sourceHandle = newSourceHandle;
                updated = true;
              }
            }
          } else if (edge.target === id) {
            const portMatch = edge.targetHandle?.match(/-port-(\d+)$/);
            if (portMatch) {
              const portNumber = parseInt(portMatch[1], 10);
              const newTargetHandle = `${id}-port-${portNumber}`;
              if (newTargetHandle !== edge.targetHandle) {
                newEdge.targetHandle = newTargetHandle;
                updated = true;
              }
            }
          }

          if (updated) {
            handlesUpdated++;
            needsUpdate = true;
            const edgeIndex = newEdges.findIndex((e) => e.id === edge.id);
            if (edgeIndex !== -1) {
              newEdges[edgeIndex] = newEdge;
            }
          }
        });

        if (needsUpdate) {
          if (removedEdgeIds.length > 0) {
            debugLog(`[${id}] Removed ${removedEdgeIds.length} edges due to port reduction`);
          }
          if (handlesUpdated > 0) {
            debugLog(`[${id}] Updated ${handlesUpdated} edge handles`);
          }
          updateEdges(newEdges, removedEdgeIds);
        }
      } else if (type === 'LosslessSplitter') {
        const rightPortCount = (() => {
          if (!nodeState?.parameters?.rightPorts) return 2;
          const parsed = parseInt(String(nodeState.parameters.rightPorts), 10);
          return isNaN(parsed) ? 2 : Math.max(2, parsed);
        })();

        const newEdges = currentEdges.filter((edge) => {
          if (edge.source !== id) return true;

          const portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
          if (!portMatch) {
            debugLog(`[${id}] Invalid handle format: ${edge.sourceHandle}`);
            return true;
          }

          const portNumber = parseInt(portMatch[1], 10);
          const keepEdge = portNumber <= rightPortCount;
          if (!keepEdge) {
            removedEdgeIds.push(edge.id);
            needsUpdate = true;
          }
          return keepEdge;
        });

        const remainingRightEdges = newEdges.filter((edge) => edge.source === id);
        remainingRightEdges.forEach((edge) => {
          const portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
          if (!portMatch) return;

          const portNumber = portMatch[1];
          const newSourceHandle = `${id}-port-${portNumber}`;

          if (newSourceHandle !== edge.sourceHandle) {
            handlesUpdated++;
            needsUpdate = true;
            const edgeIndex = newEdges.findIndex((e) => e.id === edge.id);
            if (edgeIndex !== -1) {
              newEdges[edgeIndex] = {
                ...edge,
                sourceHandle: newSourceHandle,
              };
            }
          }
        });

        if (needsUpdate) {
          if (removedEdgeIds.length > 0) {
            debugLog(`[${id}] Removed ${removedEdgeIds.length} edges due to port reduction`);
          }
          if (handlesUpdated > 0) {
            debugLog(`[${id}] Updated ${handlesUpdated} edge handles`);
          }
          updateEdges(newEdges, removedEdgeIds);
        }
      }

      updateNodeInternals(id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      debugLog(`[${id}] Error in edge management: ${message}`);
      console.error('Error updating dynamic port edges:', error);
    }
  }, [
    config?.dynamicPorts,
    type,
    id,
    nodeState,
    nodeState?.parameters?.leftPorts,
    nodeState?.parameters?.rightPorts,
    edges,
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
        updateNodeParameter(id, 'width', roundedWidth);
        updateNodeParameter(id, 'height', roundedHeight);
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
        updateNodeParameter(id, 'width', finalWidth);
        updateNodeParameter(id, 'height', finalHeight);
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

    resizeRef.current.rafId = requestAnimationFrame(() => {
      updateNodeParameter(id, 'width', undefined);
      updateNodeParameter(id, 'height', undefined);
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

        const unscaledWidth = rect.width / zoom;
        const unscaledHeight = rect.height / zoom;

        const contentWidth = Math.max(0, unscaledWidth - pLeft - pRight - bWidth * 2);
        const contentHeight = Math.max(0, unscaledHeight - pTop - pBottom - bWidth * 2);

        if (contentWidth > 0 && contentHeight > 0) {
          updateNodeParameter(id, 'width', Math.round(contentWidth));
          updateNodeParameter(id, 'height', Math.round(contentHeight));
        }
      } catch (error) {
        console.error('Error calculating node dimensions:', error);
      }
    }
  }, [nodeState, id, updateNodeParameter, zoom]);

  if (!config) {
    console.error(`No configuration found for node type: ${type}`);
    return null;
  }

  if (!nodeState || !nodeState.parameters || !nodeState.parameters.label) {
    return null;
  }

  const TypeIcon = config.icon;

  return (
    <div className={nodeClasses} ref={nodeRef} style={style}>
      <div className="custom-port-container custom-port-left">{renderTargetPorts}</div>

      <div className="middle-section">
        {TypeIcon && <TypeIcon className="node-type-icon" />}
        <div className="custom-node-content">
          {editingState.isEditing ? (
            <input
              value={editingState.tempLabel}
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

export default GenericNode;
