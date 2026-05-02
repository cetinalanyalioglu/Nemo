import React from 'react';
import { NodeProvider } from './context/NodeContext';
import NodeLibrary from './components/node-library';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import NavigationControls from './components/NavigationControls';
import './styles/app.css';
import { ReactFlowProvider } from './context/ReactFlowContext';
import { AppStateProvider } from './context/AppStateContext';

function AppContent() {
  return (
    <div className="app">
      <NavigationControls />
      <NodeLibrary />
      <div className="canvas-container">
        <Canvas />
      </div>
      <PropertiesPanel />
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <NodeProvider>
        <AppStateProvider>
          <AppContent />
        </AppStateProvider>
      </NodeProvider>
    </ReactFlowProvider>
  );
}

export default App;
