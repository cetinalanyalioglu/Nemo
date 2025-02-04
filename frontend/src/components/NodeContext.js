import React, { createContext } from 'react';

export const NodeContext = createContext();

export const NodeProvider = ({ children, nodeStates, updateNodeParameter }) => (
    <NodeContext.Provider value={{ nodeStates, updateNodeParameter }}>
        {children}
    </NodeContext.Provider>
); 