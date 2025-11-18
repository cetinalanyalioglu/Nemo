import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { Handle, useReactFlow, useUpdateNodeInternals } from 'reactflow';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import '../../styles/custom-node.css';
import { nodeConfig } from '../../config/nodeConfig';
import { useNodeContext } from '../../context/NodeContext';
import { useAppState } from '../../context/AppStateContext';
import PropTypes from 'prop-types';
import { debugLog } from '../../utils/debug';

/**
 * Base configuration object that defines common properties for all nodes.
 * Generic parameters that all nodes should have.
 */
export const baseElementInfo = {
  // Base parameters that all nodes should have
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
  // Default empty ports configuration
  ports: {
    target: [],
    source: [],
  },
  // Parameter change handlers
  onParameterChange: {
    '*': () => {
      return { isValid: true };
    },
  },
};

/**
 * GenericNode is a universal React component for all node types in the flow diagram.
 * It provides resizing capabilities, port management, label editing, and dynamic port support.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id - Unique identifier for the node
 * @param {boolean} props.selected - Whether the node is currently selected
 * @param {string} props.type - Type of the node (used to look up config)
 * @param {Object} props.data - Node data from ReactFlow (not used, label comes from nodeState)
 */
// eslint-disable-next-line no-unused-vars
const GenericNode = ({ id, selected, type, data: _data }) => {
  // =========== Hooks ===========
  // All hooks MUST be called unconditionally before any early returns
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
  const nodeRef = useRef(null);
  const resizeRef = useRef({});
  const [isResizing, setIsResizing] = useState(false);

  // Get node configuration and state
  const config = nodeConfig[type];
  const nodeState = nodeStates[id];
  const editingState = editingStates[id] || { isEditing: false, tempLabel: '' };

  // =========== Dynamic Ports Calculation ===========
  // This hook must be called unconditionally
  const calculatedPorts = useMemo(() => {
    if (!config || !config.dynamicPorts) {
      return config?.ports || { target: [], source: [] };
    }

    // Dynamic ports - calculate from parameters
    if (type === 'Junction') {
      const leftPortCount = (() => {
        if (!nodeState?.parameters?.leftPorts) return 2;
        const parsed = parseInt(nodeState.parameters.leftPorts, 10);
        return isNaN(parsed) ? 2 : Math.max(1, parsed);
      })();

      const rightPortCount = (() => {
        if (!nodeState?.parameters?.rightPorts) return 1;
        const parsed = parseInt(nodeState.parameters.rightPorts, 10);
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
        const parsed = parseInt(nodeState.parameters.rightPorts, 10);
        return isNaN(parsed) ? 2 : Math.max(2, parsed);
      })();

      const rightPorts = Array.from({ length: rightPortCount }, (_, index) => `${index + 1}`);
      return { target: ['0'], source: rightPorts };
    }

    return config.ports;
  }, [config, type, nodeState]);

  // =========== Dynamic Ports Edge Management ===========
  useLayoutEffect(() => {
    if (!config.dynamicPorts || !nodeState || !edges) return;

    try {
      let needsUpdate = false;
      let removedEdgeIds = [];
      let handlesUpdated = 0;
      const currentEdges = [...edges];

      if (type === 'Junction') {
        const leftPortCount = (() => {
          if (!nodeState?.parameters?.leftPorts) return 2;
          const parsed = parseInt(nodeState.parameters.leftPorts, 10);
          return isNaN(parsed) ? 2 : Math.max(1, parsed);
        })();

        const rightPortCount = (() => {
          if (!nodeState?.parameters?.rightPorts) return 1;
          const parsed = parseInt(nodeState.parameters.rightPorts, 10);
          return isNaN(parsed) ? 1 : Math.max(1, parsed);
        })();

        // Filter out edges connected to ports that no longer exist
        const newEdges = currentEdges.filter((edge) => {
          if (edge.source !== id && edge.target !== id) return true;

          let portMatch;
          let portNumber;
          let keepEdge = true;

          if (edge.source === id) {
            portMatch = edge.sourceHandle?.match(/-port-(\d+)$/);
            if (!portMatch) {
              debugLog(`[${id}] Invalid source handle format: ${edge.sourceHandle}`);
              return true;
            }
            portNumber = parseInt(portMatch[1], 10);
            keepEdge = portNumber >= leftPortCount && portNumber < leftPortCount + rightPortCount;
          } else if (edge.target === id) {
            portMatch = edge.targetHandle?.match(/-port-(\d+)$/);
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

        // Update remaining edges if their handles need to change
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
          const parsed = parseInt(nodeState.parameters.rightPorts, 10);
          return isNaN(parsed) ? 2 : Math.max(2, parsed);
        })();

        // Filter out edges connected to ports that no longer exist
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

        // Update remaining edges if their handles need to change
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
    } catch (error) {
      debugLog(`[${id}] Error in edge management: ${error.message}`);
      console.error('Error updating dynamic port edges:', error);
    }
  }, [
    config.dynamicPorts,
    type,
    id,
    nodeState,
    nodeState?.parameters?.leftPorts,
    nodeState?.parameters?.rightPorts,
    edges,
    updateEdges,
    updateNodeInternals,
  ]);

  // Function to snap a value to the nearest grid size
  const snapToGridSize = (value) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  // =========== Style Calculation ===========
  // This hook must be called unconditionally
  const style = useMemo(() => {
    if (!nodeState?.parameters) return {};
    const width = nodeState.parameters.width;
    const height = nodeState.parameters.height;

    if (width || height) {
      return {
        ...(width && { width: `${width}px` }),
        ...(height && { height: `${height}px` }),
        boxSizing: 'content-box',
      };
    }
    return {};
  }, [nodeState]);

  // =========== Port Setup ===========
  // This hook must be called unconditionally
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

  // =========== Resize Handlers ===========
  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsResizing(true);

    const node = getNode(id);
    if (!node) return;

    const initialWidth = node.style?.width
      ? parseInt(node.style.width)
      : nodeRef.current.offsetWidth;
    const initialHeight = node.style?.height
      ? parseInt(node.style.height)
      : nodeRef.current.offsetHeight;

    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: initialWidth,
      startHeight: initialHeight,
    };

    const onPointerMove = (eMove) => {
      const deltaX = eMove.clientX - resizeRef.current.startX;
      const deltaY = eMove.clientY - resizeRef.current.startY;

      const newWidth = Math.max(snapToGridSize(resizeRef.current.startWidth + deltaX), gridSize);
      const newHeight = Math.max(snapToGridSize(resizeRef.current.startHeight + deltaY), gridSize);

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
        resizeRef.current.updateTimer = null;
      }

      if (
        resizeRef.current.pendingWidth !== undefined ||
        resizeRef.current.pendingHeight !== undefined
      ) {
        const finalWidth = resizeRef.current.pendingWidth ?? resizeRef.current.startWidth;
        const finalHeight = resizeRef.current.pendingHeight ?? resizeRef.current.startHeight;
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

  const autoResize = (e) => {
    e.stopPropagation();

    if (resizeRef.current.rafId) {
      cancelAnimationFrame(resizeRef.current.rafId);
    }

    resizeRef.current.rafId = requestAnimationFrame(() => {
      updateNodeParameter(id, 'width', undefined);
      updateNodeParameter(id, 'height', undefined);
    });
  };

  // =========== Memoized Port Renders ===========
  const renderTargetPorts = useMemo(() => {
    return targetPorts.map((portId) => (
      <div key={portId} className="port-wrapper port-wrapper-left port-wrapper-target">
        <IoChevronForward className="port-icon port-icon-target" />
        <span className="port-index">{portId}</span>
        <Handle
          type="target"
          position="left"
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
            position="right"
            id={`${id}-port-${portIndex}`}
            className="react-flow__handle custom-handle-source"
          />
        </div>
      );
    });
  }, [sourcePorts, targetPorts.length, id]);

  // =========== Effects ===========
  // These hooks must be called unconditionally
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

        const safeParseFloat = (val) => {
          const parsed = parseFloat(val);
          return isNaN(parsed) ? 0 : parsed;
        };

        const pTop = safeParseFloat(paddingTop);
        const pRight = safeParseFloat(paddingRight);
        const pBottom = safeParseFloat(paddingBottom);
        const pLeft = safeParseFloat(paddingLeft);
        const bWidth = safeParseFloat(borderWidth);

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

  // Early return checks (after all hooks)
  if (!config) {
    console.error(`No configuration found for node type: ${type}`);
    return null;
  }

  if (!nodeState || !nodeState.parameters || !nodeState.parameters.label) {
    return null;
  }

  // =========== Icon Setup ===========
  const TypeIcon = config.icon;

  // =========== Render ===========
  return (
    <div className={nodeClasses} ref={nodeRef} style={style}>
      {/* Input ports container */}
      <div className="custom-port-container custom-port-left">{renderTargetPorts}</div>

      {/* Middle section with icon and content */}
      <div className="middle-section">
        {/* Node type icon */}
        {TypeIcon && <TypeIcon className="node-type-icon" />}

        {/* Node content area with label/input */}
        <div className="custom-node-content">
          {editingState.isEditing ? (
            <input
              value={editingState.tempLabel}
              onChange={(e) => contextOnChange(id, e)}
              onBlur={() => contextFinishEditing(id)}
              onKeyDown={(e) => contextOnKeyDown(id, e)}
              autoFocus
              className="custom-node-input"
              spellCheck="false"
            />
          ) : (
            <div className="custom-node-label" onDoubleClick={() => contextStartEditing(id)}>
              {nodeState.parameters.label}
            </div>
          )}
          <div className="custom-node-type">{type}</div>
        </div>
      </div>

      {/* Output ports container */}
      <div className="custom-port-container custom-port-right">{renderSourcePorts}</div>

      {/* Resize handle - only visible when node is selected */}
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

// =========== PropTypes ===========
GenericNode.propTypes = {
  id: PropTypes.string.isRequired,
  selected: PropTypes.bool,
  type: PropTypes.string.isRequired,
  data: PropTypes.object, // ReactFlow passes this but we don't use it
};

export default GenericNode;
