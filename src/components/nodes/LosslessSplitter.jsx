import React, { useLayoutEffect } from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsDiagram2 } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';
import { useUpdateNodeInternals } from 'reactflow';

export const elementIcon = BsDiagram2;

/**
 * Configuration object for the LosslessSplitter element.
 * Defines a component that splits a flow into two outputs without energy losses.
 * Contains fixed configuration of one input port and two output ports.
 */
export const elementInfo = createElementInfo({
  type: 'LosslessSplitter',
  displayName: 'Lossless Splitter',
  category: 'Dynamic Port Elements',
  ports: {
    target: ['0'], // Fixed single input port
    source: [], // Dynamic output ports
  },
  parameters: {
    label: {
      defaultValue: 'LosslessSplitter',
    },
    rightPorts: {
      label: 'Output Ports',
      type: 'number',
      defaultValue: 2,
      min: 2,
      category: 'Ports',
      description: 'Number of output ports',
    },
  },
});

/**
 * LosslessSplitter component representing a flow splitter with no energy losses.
 * Splits an input flow into two output flows while maintaining conservation laws.
 *
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} LosslessSplitter node component
 */
const LosslessSplitter = ({ id, data, selected, type }) => {
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

  // Get the number of right ports from parameters
  const rightPortCount = nodeState ? parseInt(nodeState.parameters.rightPorts, 10) || 2 : 2;

  // Generate automatic port IDs for the right side
  const rightPorts = Array.from({ length: rightPortCount }, (_, index) => `${index + 1}`);

  // Effect to manage edges when port configuration changes
  useLayoutEffect(() => {
    // If the node state is not available, exit the effect. This triggers during deletion.
    if (!nodeState) {
      return;
    }

    let needsUpdate = false;

    // Get all edges connected to this node
    const nodeEdges = edges.filter((edge) => edge.source === id || edge.target === id);

    // Separate edges by port side
    const rightEdges = nodeEdges.filter((edge) => edge.source === id);

    // Create new edges array starting with edges not connected to output ports
    const newEdges = edges.filter((edge) => edge.source !== id);

    // Keep the input port edges as they are
    nodeEdges
      .filter((edge) => edge.target === id)
      .forEach((edge) => {
        newEdges.push(edge);
      });

    // Keep as many right (source) edges as possible
    rightEdges.slice(0, rightPortCount).forEach((edge, index) => {
      newEdges.push({
        ...edge,
        sourceHandle: `${id}-port-${rightPorts[index]}`,
      });
      needsUpdate = true;
    });

    // Update edges if any changes were made
    if (needsUpdate) {
      setEdges(newEdges);
    }

    // Always update node internals to ensure proper rendering
    updateNodeInternals(id);
  }, [id, rightPortCount, setEdges, updateNodeInternals]);

  // If the node state is not available, render nothing. This triggers during deletion.
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
        target: ['0'],
        source: rightPorts,
      }}
    />
  );
};

export default LosslessSplitter;
