import React, { createContext, useContext, useState } from 'react';

/**
 * Context for managing the ReactFlow instance across components.
 * Provides access to the ReactFlow instance and its setter function.
 */
const ReactFlowContext = createContext(null);

/**
 * Provider component for ReactFlow instance management.
 * Wraps the application to provide ReactFlow instance access to child components.
 *
 * @param {Object} props Component properties
 * @param {React.ReactNode} props.children Child components to be wrapped
 * @returns {React.Component} Context provider component
 */
export const ReactFlowProvider = ({ children }) => {
  // Store the ReactFlow instance reference
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  return (
    <ReactFlowContext.Provider value={{ reactFlowInstance, setReactFlowInstance }}>
      {children}
    </ReactFlowContext.Provider>
  );
};

/**
 * Custom hook to access the ReactFlow instance and its setter.
 * Must be used within a ReactFlowProvider component.
 *
 * @returns {Object} Object containing:
 *   - reactFlowInstance: The current ReactFlow instance
 *   - setReactFlowInstance: Function to update the ReactFlow instance
 * @throws {Error} If used outside of a ReactFlowProvider
 */
export const useReactFlow = () => {
  const context = useContext(ReactFlowContext);
  if (context === undefined) {
    throw new Error('useReactFlow must be used within a ReactFlowProvider');
  }
  return context;
};
