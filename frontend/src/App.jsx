import React from 'react';
import { NodeProvider } from './context/NodeContext';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import './styles/app.css';
import { ReactFlowProvider } from './context/ReactFlowContext';

// Main application logic component
function AppContent() {
  return (
    <div className="app">
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
        <AppContent />
      </NodeProvider>
    </ReactFlowProvider>
  );
}

export default App;