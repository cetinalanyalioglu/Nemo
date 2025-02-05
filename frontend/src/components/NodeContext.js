import React, { createContext, useContext, useState } from 'react';
import { elementInfo } from './nodes/nodeTypes';

export const NodeContext = createContext({
  nodeStates: {},
  updateNodeParameter: () => {},
  editingStates: {},
  startEditing: () => {},
  onChange: () => {},
  finishEditing: () => {},
  onKeyDown: () => {},
  addNodes: () => {}
});

export const NodeProvider = ({ children }) => {
  const [nodeStates, setNodeStates] = useState({});
  const [editingStates, setEditingStates] = useState({});

  const addNodes = (nodes) => {
    nodes.forEach(node => {
      if (node.type === 'add') {
        const nodeType = node.item.type;
        const nodeId = node.item.id;
        
        const defaultParams = elementInfo[nodeType]?.parameters;

        if (!defaultParams) {
          console.error(`ElementInfo for nodeType "${nodeType}" bulunamadı.`);
          return;
        }

        setNodeStates(prev => ({
          ...prev,
          [nodeId]: {
            parameters: Object.keys(defaultParams).reduce((acc, key) => {
              acc[key] = defaultParams[key].defaultValue;
              return acc;
            }, {}),
          }
        }));
      }
    });
  };

  const updateNodeParameter = (nodeId, paramName, value) => {
    setNodeStates(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        parameters: {
          ...prev[nodeId]?.parameters,
          [paramName]: value
        }
      }
    }));
  };

  const startEditing = (nodeId) => {
    setEditingStates(prev => ({
      ...prev,
      [nodeId]: {
        isEditing: true,
        tempLabel: nodeStates[nodeId]?.parameters?.label || ''
      }
    }));
  };

  const onChange = (nodeId, evt) => {
    setEditingStates(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        tempLabel: evt.target.value
      }
    }));
  };

  const finishEditing = (nodeId) => {
    const newLabel = editingStates[nodeId]?.tempLabel?.trim();
    if (newLabel) {
      updateNodeParameter(nodeId, 'label', newLabel);
    }
    setEditingStates(prev => ({
      ...prev,
      [nodeId]: {
        isEditing: false,
        tempLabel: ''
      }
    }));
  };

  const onKeyDown = (nodeId, evt) => {
    if (evt.key === 'Enter' && !evt.shiftKey) {
      evt.preventDefault();
      finishEditing(nodeId);
    } else if (evt.key === 'Escape') {
      setEditingStates(prev => ({
        ...prev,
        [nodeId]: {
          isEditing: false,
          tempLabel: ''
        }
      }));
    }
  };

  return (
    <NodeContext.Provider value={{
      nodeStates,
      updateNodeParameter,
      editingStates,
      startEditing,
      onChange,
      finishEditing,
      onKeyDown,
      addNodes
    }}>
      {children}
    </NodeContext.Provider>
  );
};

export const useNodeContext = () => {
  const context = useContext(NodeContext);
  if (!context) {
    throw new Error('useNodeContext must be used within a NodeProvider');
  }
  return context;
}; 