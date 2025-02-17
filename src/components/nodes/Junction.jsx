import React, { useLayoutEffect } from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsLightningFill } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';
import { useUpdateNodeInternals } from 'reactflow';
import { debugLog } from '../../utils/debug';
export const elementIcon = BsLightningFill;

/**
 * Configuration object for the Junction element.
 * Defines the element type, display name, ports, category and configurable parameters.
 */
export const elementInfo = createElementInfo({
  type: 'Junction',
  displayName: 'Junction',
  category: 'Dynamic Port Elements',
  // Ports are dynamically created based on user input parameters
  ports: {
    target: [],
    source: [],
  },
  parameters: {
    label: {
      defaultValue: 'Junction',
    },
    leftPorts: {
      label: 'Left Ports',
      type: 'number',
      defaultValue: 2,
      min: 1,
      category: 'Ports',
      description: 'Number of left ports',
    },
    rightPorts: {
      label: 'Right Ports',
      type: 'number',
      defaultValue: 1,
      min: 1,
      category: 'Ports',
      description: 'Number of right ports',
    },
  },
});

/**
 * Junction component that represents a node with configurable number of input and output ports.
 *
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} Junction node component
 */
const Junction = ({ id, data, selected, type }) => {
  const {
    edges,
    setEdges,
    nodeStates,
    editingStates,
    startEditing: contextStartEditing,
    onChange: contextOnChange,
    onKeyDown: contextOnKeyDown,
    finishEditing: contextFinishEditing,
  } = useNodeContext();

  const updateNodeInternals = useUpdateNodeInternals();

  const nodeState = nodeStates[id];
  const editingState = editingStates[id] || { isEditing: false, tempLabel: '' };

  // Get the number of ports from parameters as integers
  const leftPortCount = nodeState ? parseInt(nodeState.parameters.leftPorts, 10) || 0 : 2;
  const rightPortCount = nodeState ? parseInt(nodeState.parameters.rightPorts, 10) || 0 : 1;

  // Generate automatic port IDs based on the port counts
  const leftPorts = Array.from({ length: leftPortCount }, (_, index) => `${index}`);
  const rightPorts = Array.from(
    { length: rightPortCount },
    (_, index) => `${leftPortCount + index}`
  );

  // Effect to manage edges when port configuration changes
  useLayoutEffect(() => {
    if (!nodeState) {
      return;
    }

    let needsUpdate = false;

    // Get all edges connected to this node
    const nodeEdges = edges.filter((edge) => edge.source === id || edge.target === id);

    // Separate edges by port side (left/target and right/source)
    const leftEdges = nodeEdges.filter((edge) => edge.target === id);
    const rightEdges = nodeEdges.filter((edge) => edge.source === id);

    // Create new edges array starting with edges not connected to this node
    const newEdges = edges.filter((edge) => edge.source !== id && edge.target !== id);

    // Helper to update edge handle IDs
    const createNewEdge = (edge, portId) => ({
      ...edge,
      sourceHandle: edge.source === id ? `${id}-port-${portId}` : edge.sourceHandle,
      targetHandle: edge.target === id ? `${id}-port-${portId}` : edge.targetHandle,
    });

    // Keep as many left (target) edges as possible
    leftEdges.slice(0, leftPortCount).forEach((edge, index) => {
      newEdges.push(createNewEdge(edge, leftPorts[index]));
      needsUpdate = true;
    });

    // Keep as many right (source) edges as possible
    rightEdges.slice(0, rightPortCount).forEach((edge, index) => {
      newEdges.push(createNewEdge(edge, rightPorts[index]));
      needsUpdate = true;
    });

    // Update edges if any changes were made
    if (needsUpdate) {
      debugLog(`Updating edges for Junction node ${id}`);
      setEdges(newEdges);
    }

    // Always update node internals to ensure proper rendering
    updateNodeInternals(id);
  }, [id, leftPortCount, rightPortCount, setEdges, updateNodeInternals]);

  if (!nodeState) {
    return null;
  }

  return (
    <BaseCustomNode
      id={id}
      data={{
        label: nodeState.parameters.label,
        isEditing: editingState.isEditing,
        tempLabel: editingState.tempLabel,
        onChange: (e) => contextOnChange(id, e),
        onKeyDown: (e) => contextOnKeyDown(id, e),
        finishEditing: () => contextFinishEditing(id),
        startEditing: () => contextStartEditing(id),
      }}
      selected={selected}
      type={type}
      ports={{
        target: leftPorts,
        source: rightPorts,
      }}
    />
  );
};

export default Junction;
