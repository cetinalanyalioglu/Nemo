import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Handle, useReactFlow } from 'reactflow';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import '../../styles/custom-node.css';
import { elementIcons } from './nodeTypes';
import { useNodeContext } from '../../context/NodeContext';
import { useAppState } from '../../context/AppStateContext';
import PropTypes from 'prop-types';
import { validateConnectionAreaChange, assignConnectionArea } from '../../utils/connectionUtils';

/**
 * Base configuration object that defines common properties for all custom nodes.
 * This will be merged with specific node configurations.
 */
export const elementInfo = {
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
    allowsAreaChange: {
      label: 'Allows area change',
      type: 'boolean',
      defaultValue: false,
      category: 'Logic',
      description: 'Whether this node allows a change in the areas of edges connected to it',
      editable: false,
      visible: false,
    },
    providesArea: {
      label: 'Provides area',
      type: 'boolean',
      defaultValue: false,
      category: 'Logic',
      description: 'Whether this node provides an area value to connected edges',
      editable: false,
      visible: false,
    },
  },
  // Default empty ports configuration
  ports: {
    target: [],
    source: [],
  },
  // Default connection validation function
  isConnectionValid: (
    connection,
    sourceNode,
    targetNode,
    sourceNodeState,
    targetNodeState,
    connectionContext,
    edges,
    edgeStates
  ) => {
    return validateConnectionAreaChange(
      connection,
      sourceNode,
      targetNode,
      sourceNodeState,
      targetNodeState,
      connectionContext,
      edges,
      edgeStates
    );
  },
  // Default connection start handler
  onConnectionStart: (
    connection,
    sourceNode,
    targetNode,
    sourceNodeState,
    targetNodeState,
    connectionContext
  ) => {
    assignConnectionArea(
      connection,
      sourceNode,
      targetNode,
      sourceNodeState,
      targetNodeState,
      connectionContext
    );
  },
  // Parameter change handlers
  onParameterChange: {
    // If the node provides area and user changes the area, we need to re-run the validator for all edges connected to the node
    // as if we were re-connecting all edges associated with this node
    area: (nodeId, paramName, newValue, oldValue, nodeStates, edges, edgeStates) => {
      // If the node does not provide area, we don't need to run the validator
      if (!nodeStates[nodeId].parameters.providesArea) {
        console.warn(
          `Node ${nodeId} does not provide area, but has the area parameter set to ${newValue}`
        );
        return { isValid: true };
      }

      // Find all edges connected to this node
      const connectedEdges = edges.filter(
        (edge) => edge.source === nodeId || edge.target === nodeId
      );

      // For each connected edge, validate if the area change would be allowed
      for (const edge of connectedEdges) {
        // Get the source and target nodes for this edge
        const sourceNodeState =
          edge.source === nodeId ? nodeStates[nodeId] : nodeStates[edge.source];
        const targetNodeState =
          edge.target === nodeId ? nodeStates[nodeId] : nodeStates[edge.target];

        // Create a temporary connection context with the new area value
        const connectionContext = {
          parameters: {
            area: newValue,
          },
          metadata: {},
        };

        // Run the validation
        const validation = validateConnectionAreaChange(
          edge,
          { id: edge.source }, // Minimal source node object
          { id: edge.target }, // Minimal target node object
          sourceNodeState,
          targetNodeState,
          connectionContext,
          edges,
          edgeStates,
          nodeId // No need to validate the node itself
        );

        // If any validation fails, return the failure
        if (!validation.isValid) {
          return validation;
        }
      }

      // If all validations pass, set the edge states to the new area value and return success
      for (const edge of connectedEdges) {
        edgeStates[edge.id].parameters.area = newValue;
      }
      return { isValid: true };
    },
    // Default handler for any parameter
    // eslint-disable-next-line no-unused-vars
    '*': (nodeId, paramName, newValue, oldValue, nodeStates, edges, edgeStates) => {
      // By default, do nothing
      return { isValid: true };
    },
  },
};

/**
 * BaseCustomNode is a foundational React component for creating custom nodes in a flow diagram.
 * It provides resizing capabilities, port management, and label editing functionality.
 *
 * @component
 * @param {Object} props
 * @param {string} props.id - Unique identifier for the node
 * @param {Object} props.data - Node data containing label and editing-related functions
 * @param {boolean} props.selected - Whether the node is currently selected
 * @param {string} props.type - Type of the node (determines its icon and behavior)
 * @param {Object} props.ports - Configuration for input/output ports
 * @param {string[]} [props.ports.target=[]] - Array of input port IDs
 * @param {string[]} [props.ports.source=[]] - Array of output port IDs
 */
const BaseCustomNode = ({ id, data, selected, type, ports = { target: [], source: [] } }) => {
  // =========== Hooks ===========
  const { nodeStates, updateNodeParameter } = useNodeContext();
  const { getNode } = useReactFlow();
  const {
    grid: { snapToGrid, size: gridSize },
    viewport: { zoom },
  } = useAppState();
  const nodeRef = useRef(null);
  const resizeRef = useRef({});
  const [isResizing, setIsResizing] = useState(false);

  // Function to snap a value to the nearest grid size
  const snapToGridSize = (value) => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  const style = useMemo(() => {
    const nodeState = nodeStates[id];
    const width = nodeState?.parameters?.width;
    const height = nodeState?.parameters?.height;

    if (width || height) {
      return {
        ...(width && { width: `${width}px` }),
        ...(height && { height: `${height}px` }),
        boxSizing: 'content-box',
      };
    }
    return {};
  }, [nodeStates, id]);

  // =========== Port Setup ===========
  const portSetup = useMemo(() => {
    const targetPorts = Array.isArray(ports.target) ? ports.target : [];
    const sourcePorts = Array.isArray(ports.source) ? ports.source : [];
    return {
      targetPorts,
      sourcePorts,
      hasLeftPort: targetPorts.length > 0,
      hasRightPort: sourcePorts.length > 0,
    };
  }, [ports.target, ports.source]);

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
  /**
   * Handles the start of a manual resize operation.
   * Sets up event listeners for pointer move and up events.
   *
   * @param {PointerEvent} e - The pointer event that triggered the resize
   */
  const handleResizeStart = (e) => {
    // Stop event propagation and prevent default behavior
    e.stopPropagation();
    e.preventDefault();

    // Set the resizing flag
    setIsResizing(true);

    // Get the current node data from ReactFlow
    const node = getNode(id);
    if (!node) return;

    // Store initial dimensions from the node's style
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
      // Calculate the delta between the start position and the current position
      const deltaX = eMove.clientX - resizeRef.current.startX;
      const deltaY = eMove.clientY - resizeRef.current.startY;

      // Compute the new size based on the delta and snap to grid if enabled
      const newWidth = Math.max(snapToGridSize(resizeRef.current.startWidth + deltaX), gridSize);
      const newHeight = Math.max(snapToGridSize(resizeRef.current.startHeight + deltaY), gridSize);

      // Round to the nearest integer and update the node context state
      updateNodeParameter(id, 'width', Math.round(newWidth));
      updateNodeParameter(id, 'height', Math.round(newHeight));
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    const onPointerUp = () => {
      setIsResizing(false);
      cleanup();
    };

    // Add event listeners
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  /**
   * Automatically resizes the node to fit its content.
   * Uses requestAnimationFrame for smooth resizing and DOM updates.
   *
   * @param {Event} e - The event that triggered the auto-resize
   */
  const autoResize = (e) => {
    // TODO This probably has unnecessary things inside
    e.stopPropagation();

    // Cancel any pending animation frame
    if (resizeRef.current.rafId) {
      cancelAnimationFrame(resizeRef.current.rafId);
    }

    resizeRef.current.rafId = requestAnimationFrame(() => {
      // Reset node size parameters to undefined to allow auto-resize
      updateNodeParameter(id, 'width', undefined);
      updateNodeParameter(id, 'height', undefined);
    });
  };

  // =========== Memoized Port Renders ===========
  /**
   * Memoized render function for target (input) ports.
   * Creates Handle components for each input port with appropriate styling and positioning.
   */
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

  /**
   * Memoized render function for source (output) ports.
   * Creates Handle components for each output port with appropriate styling and positioning.
   * Port indices continue from where target ports left off.
   */
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
  useEffect(() => {
    if (isResizing) {
      return () => {
        if (resizeRef.current.cleanup) {
          resizeRef.current.cleanup();
        }
      };
    }
  }, [isResizing]);

  // =========== Auto-resize ===========
  useEffect(() => {
    if (
      nodeRef.current &&
      (!nodeStates[id]?.parameters?.width || !nodeStates[id]?.parameters?.height)
    ) {
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
  }, [nodeStates, id, updateNodeParameter, zoom]);

  // Skip rendering if we don't have valid data (happens during unmounting)
  if (!data || !data.label) {
    return null;
  }

  // =========== Constants & Icon Setup ===========
  const TypeIcon = elementIcons[type];

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
          {data.isEditing ? (
            <input
              value={data.tempLabel}
              onChange={(e) => data.onChange(e)}
              onBlur={() => data.finishEditing(id)}
              onKeyDown={(e) => data.onKeyDown(e)}
              autoFocus
              className="custom-node-input"
              spellCheck="false"
            />
          ) : (
            <div className="custom-node-label" onDoubleClick={() => data.startEditing(id)}>
              {data.label}
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
BaseCustomNode.propTypes = {
  id: PropTypes.string.isRequired,
  data: PropTypes.shape({
    label: PropTypes.string,
    tempLabel: PropTypes.string,
    isEditing: PropTypes.bool,
    onChange: PropTypes.func,
    finishEditing: PropTypes.func,
    onKeyDown: PropTypes.func,
    startEditing: PropTypes.func,
  }).isRequired,
  selected: PropTypes.bool,
  type: PropTypes.string.isRequired,
  ports: PropTypes.shape({
    target: PropTypes.arrayOf(PropTypes.string),
    source: PropTypes.arrayOf(PropTypes.string),
  }),
};

export default BaseCustomNode;
