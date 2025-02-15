import React from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsLightningFill } from 'react-icons/bs';

export const elementIcon = BsLightningFill;

/**
 * Configuration object for the Junction element.
 * Defines the element type, display name, ports, category and configurable parameters.
 */
export const elementInfo = {
  type: 'Junction',
  displayName: 'Junction',
  // Ports are dynamically created based on user input parameters
  ports: {
    target: [],
    source: []
  },
  category: 'Dynamic Port Elements',
  parameters: {
    label: {
      label: 'Label',
      type: 'string',
      defaultValue: 'Junction',
      category: 'General'
    },
    leftPorts: {
      label: 'Left Ports',
      type: 'number',
      defaultValue: 2,
      min: 1,
      category: 'Ports',
      description: 'Number of left ports'
    },
    rightPorts: {
      label: 'Right Ports',
      type: 'number',
      defaultValue: 1,
      min: 1,
      category: 'Ports',
      description: 'Number of right ports'
    }
  }
};

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
    nodeStates,
    editingStates,
    startEditing: contextStartEditing,
    onChange: contextOnChange,
    onKeyDown: contextOnKeyDown,
    finishEditing: contextFinishEditing
  } = useNodeContext();

  const nodeState = nodeStates[id];
  const editingState = editingStates[id] || { isEditing: false, tempLabel: '' };

  if (!nodeState) {
    console.log("Received null nodeState while rendering node ", id);
    return <div>Error</div>;
  }

  // Get the number of ports from parameters as integers
  const leftPortCount = parseInt(nodeState.parameters.leftPorts, 10) || 0;
  const rightPortCount = parseInt(nodeState.parameters.rightPorts, 10) || 0;

  // Generate automatic port IDs based on the port counts
  const leftPorts = Array.from({ length: leftPortCount }, (_, index) => `${index}`);
  const rightPorts = Array.from({ length: rightPortCount }, (_, index) => `${leftPortCount + index}`);

  // Configure dynamic ports object with left ports as targets and right ports as sources
  const dynamicPorts = {
    target: leftPorts,
    source: rightPorts
  };

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
        startEditing: () => contextStartEditing(id)
      }}
      selected={selected}
      type={type}
      ports={dynamicPorts}
    />
  );
};

export default Junction; 