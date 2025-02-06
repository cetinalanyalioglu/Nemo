import React from 'react';
import { useNodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsLightningFill } from 'react-icons/bs';

export const elementIcon = BsLightningFill;

export const elementInfo = {
  type: 'Junction',
  displayName: 'Junction',
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
      defaultValue: 1,
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
    return <div>Loading...</div>;
  }

  // Port sayılarını integer olarak parametrelerden alıyoruz:
  const leftPortCount = parseInt(nodeState.parameters.leftPorts, 10) || 0;
  const rightPortCount = parseInt(nodeState.parameters.rightPorts, 10) || 0;

  // Bu sayılara bağlı olarak otomatik port ID'lerini oluşturuyoruz.
  const leftPorts = Array.from({ length: leftPortCount }, (_, index) => `port-left-${index}`);
  const rightPorts = Array.from({ length: rightPortCount }, (_, index) => `port-right-${index}`);

  const dynamicPorts = {
    target: leftPorts,  // BaseCustomNode'da sol portlar target olarak render ediliyor.
    source: rightPorts  // Sağ portlar source olarak render ediliyor.
  };

  return (
    <BaseCustomNode
      id={id}
      data={{
        label: nodeState.parameters.label,
        isEditing: editingState.isEditing,
        tempLabel: editingState.tempLabel,
        onChange: (e) => contextOnChange(id, e),
        finishEditing: () => contextFinishEditing(id),
        onKeyDown: (e) => contextOnKeyDown(id, e),
        startEditing: () => contextStartEditing(id)
      }}
      selected={selected}
      type={type}
      ports={dynamicPorts}
    />
  );
};

export default Junction; 