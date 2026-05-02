import React, { createContext, useContext, useState } from 'react';
import type { ReactFlowInstance } from 'reactflow';

export type ReactFlowContextValue = {
  reactFlowInstance: ReactFlowInstance | null;
  setReactFlowInstance: React.Dispatch<React.SetStateAction<ReactFlowInstance | null>>;
};

const ReactFlowContext = createContext<ReactFlowContextValue | undefined>(undefined);

export const ReactFlowProvider = ({ children }: { children: React.ReactNode }) => {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  return (
    <ReactFlowContext.Provider value={{ reactFlowInstance, setReactFlowInstance }}>
      {children}
    </ReactFlowContext.Provider>
  );
};

export const useReactFlowContext = (): ReactFlowContextValue => {
  const context = useContext(ReactFlowContext);
  if (context == null) {
    throw new Error('useReactFlowContext must be used within a ReactFlowProvider');
  }
  return context;
};

/** Alias used across the app (not reactflow's hook). */
export const useReactFlow = useReactFlowContext;
