import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Handle } from 'reactflow';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import '../../styles/custom-node.css';
import { elementIcons } from './nodeTypes';
import { useNodeContext } from '../../context/NodeContext';
import PropTypes from 'prop-types';

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
  // Skip rendering if we don't have valid data (happens during unmounting)
  if (!data || !data.label) {
    return null;
  }

  // =========== Constants & Icon Setup ===========
  const TypeIcon = elementIcons[type];
  const { updateNodeSize } = useNodeContext();

  // =========== Port Setup ===========
  const targetPorts = Array.isArray(ports.target) ? ports.target : [];
  const sourcePorts = Array.isArray(ports.source) ? ports.source : [];
  const hasLeftPort = targetPorts.length > 0;
  const hasRightPort = sourcePorts.length > 0;

  // =========== Refs ===========
  const nodeRef = useRef(null);
  const resizeRef = useRef({});

  // =========== State ===========
  const [nodeSize, setNodeSize] = useState(null);
  const [isResizing, setIsResizing] = useState(false);

  // =========== Style Computations ===========
  const style = nodeSize
    ? {
        width: `${nodeSize.width}px`,
        height: `${nodeSize.height}px`,
        boxSizing: 'content-box'
      }
    : {};

  const nodeClasses = [
    'custom-node',
    type,
    selected ? 'custom-node-selected' : '',
    hasLeftPort ? 'has-left-port' : '',
    hasRightPort ? 'has-right-port' : '',
    isResizing ? 'resizing' : ''
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

    // Get the current size and position of the node
    const rect = nodeRef.current.getBoundingClientRect();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height
    };

    const onPointerMove = (eMove) => {
      // Calculate the delta between the start position and the current position
      const deltaX = eMove.clientX - resizeRef.current.startX;
      const deltaY = eMove.clientY - resizeRef.current.startY;

      // Compute the new size based on the delta
      const newWidth = resizeRef.current.startWidth + deltaX;
      const newHeight = resizeRef.current.startHeight + deltaY;

      // Update the internal state
      setNodeSize({ width: newWidth, height: newHeight });
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    const onPointerUp = () => {
      setIsResizing(false);
      const finalSize = nodeSize || { 
        width: resizeRef.current.startWidth, 
        height: resizeRef.current.startHeight 
      };
      updateNodeSize(id, finalSize, false);
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
    e.stopPropagation();

    // Cancel any pending animation frame
    if (resizeRef.current.rafId) {
      cancelAnimationFrame(resizeRef.current.rafId);
    }

    resizeRef.current.rafId = requestAnimationFrame(() => {
      setNodeSize(null);
      
      // Wait for next frame to ensure DOM has updated
      requestAnimationFrame(() => {
        const rect = nodeRef.current?.getBoundingClientRect();
        if (rect) {
          updateNodeSize(id, { width: rect.width, height: rect.height }, false);
        }
      });
    });
  };

  // =========== Memoized Port Renders ===========
  /**
   * Memoized render function for target (input) ports.
   * Creates Handle components for each input port with appropriate styling and positioning.
   */
  const renderTargetPorts = useMemo(() => {
    return targetPorts.map(portId => (
      <div key={portId} className="port-wrapper">
        <IoChevronForward className="port-icon port-icon-target" />
        <span className="port-index">{portId}</span>
        <Handle
          type="target"
          position="left"
          id={`${id}-port-${portId}`}
          className="react-flow__handle custom-handle"
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
        <div key={portId} className="port-wrapper">
          <IoChevronBack className="port-icon port-icon-source" />
          <span className="port-index">{portIndex}</span>
          <Handle
            type="source"
            position="right"
            id={`${id}-port-${portIndex}`}
            className="react-flow__handle custom-handle"
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

  // =========== Render ===========
  return (
    <div
      className={nodeClasses}
      ref={nodeRef}
      style={style}
    >
      {/* Node type icon */}
      {TypeIcon && <TypeIcon className="node-type-icon" />}

      {/* Input ports container */}
      <div className="custom-port-container custom-port-left">
        {renderTargetPorts}
      </div>

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
          <div
            className="custom-node-label"
            onDoubleClick={() => data.startEditing(id)}
          >
            {data.label}
          </div>
        )}
        <div className="custom-node-type">{type}</div>
      </div>

      {/* Output ports container */}
      <div className="custom-port-container custom-port-right">
        {renderSourcePorts}
      </div>

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