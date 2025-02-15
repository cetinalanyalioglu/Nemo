import React from 'react';
import { NodeProvider } from './context/NodeContext';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import NavigationControls from './components/NavigationControls';
import './styles/app.css';
import { ReactFlowProvider } from './context/ReactFlowContext';
import { AppStateProvider } from './context/AppStateContext';

// Main application logic component
function AppContent() {
  return (
    <div className="app">
      <NavigationControls />
      <Sidebar />
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