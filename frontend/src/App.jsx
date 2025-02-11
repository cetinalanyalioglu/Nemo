import React, { useState, useCallback, useEffect } from 'react';
import { NodeProvider, useNodeContext } from './components/NodeContext';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import './App.css';
import { ReactFlowProvider } from './context/ReactFlowContext';

// Ana uygulama mantığını içeren bileşen
function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const { selectedNodeId } = useNodeContext();

  // Update properties panel visibility when selected node changes
  useEffect(() => {
    setIsPropertiesPanelOpen(!!selectedNodeId);
  }, [selectedNodeId]);

  return (
    <div className="app">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <div className={`canvas-container ${!isSidebarOpen ? 'sidebar-closed' : ''} ${isPropertiesPanelOpen ? 'properties-open' : ''}`}>
        <Canvas />
      </div>
      <div className={`properties-panel-container ${isPropertiesPanelOpen ? 'open' : ''}`}>
        <PropertiesPanel selectedNodeId={selectedNodeId} />
      </div>
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