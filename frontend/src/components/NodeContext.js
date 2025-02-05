import React, { createContext, useContext } from 'react';

export const NodeContext = createContext({
  nodeStates: {},
  updateNodeParameter: () => {},
});

export const useNodeContext = () => {
  const context = useContext(NodeContext);
  if (!context) {
    throw new Error('useNodeContext must be used within a NodeProvider');
  }
  return context;
};

export const NodeProvider = NodeContext.Provider; 