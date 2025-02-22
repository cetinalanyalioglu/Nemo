import React from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsArrowLeftRight } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';

export const elementIcon = BsArrowLeftRight;

/**
 * Configuration object for the LosslessDuct element.
 * Defines a duct component that simulates fluid flow without energy losses.
 * Contains fixed input/output ports and configurable physical parameters.
 */
export const elementInfo = createElementInfo({
  type: 'LosslessDuct',
  displayName: 'Lossless Duct',
  category: 'Two port elements',
  // Fixed ports configuration: one input (target) and one output (source)
  ports: {
    target: ['0'],
    source: ['1'],
  },
  parameters: {
    label: {
      defaultValue: 'LosslessDuct',
    },
    area: {
      label: 'Area',
      type: 'float',
      defaultValue: 1,
      unit: 'm^2',
      category: 'Parameters',
      min: 0.000001,
    },
    length: {
      label: 'Length',
      type: 'float',
      defaultValue: 1.0,
      unit: 'm',
      category: 'Parameters',
      min: 0.000001, // Minimum length: 1 micron
    },
    providesArea: {
      label: 'Provides area',
      type: 'boolean',
      defaultValue: true,
      category: 'Logic',
      description: 'Whether this node provides an area value to connected edges',
      editable: false,
      visible: false,
    },
  },
});

/**
 * LosslessDuct component representing an ideal duct with no energy losses.
 * Provides a two-port element with configurable diameter and length parameters.
 *
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} LosslessDuct node component
 */
const LosslessDuct = ({ id, selected, type }) => {
  const {
    nodeStates,
    editingStates,
    startEditing: contextStartEditing,
    onChange: contextOnChange,
    onKeyDown: contextOnKeyDown,
    finishEditing: contextFinishEditing,
  } = useNodeContext();

  const nodeState = nodeStates[id];
  const editingState = editingStates[id] || { isEditing: false, tempLabel: '' };

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
      ports={elementInfo.ports}
    />
  );
};

export default LosslessDuct;
