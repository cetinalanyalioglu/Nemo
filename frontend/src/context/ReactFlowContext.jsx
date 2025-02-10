import React, { createContext, useContext, useState } from 'react';

const ReactFlowContext = createContext(null);

export const ReactFlowProvider = ({ children }) => {
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    return (
        <ReactFlowContext.Provider value={{ reactFlowInstance, setReactFlowInstance }}>
            {children}
        </ReactFlowContext.Provider>
    );
};

export const useReactFlow = () => {
    const context = useContext(ReactFlowContext);
    if (context === undefined) {
        throw new Error('useReactFlow must be used within a ReactFlowProvider');
    }
    return context;
}; 