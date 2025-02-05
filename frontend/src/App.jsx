import React, { useState, useCallback } from 'react';
import { NodeProvider, useNodeContext } from './components/NodeContext';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import './App.css';

// Ana uygulama mantığını içeren bileşen
function AppContent() {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const { addNodes } = useNodeContext();

  const onNodeSelect = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setIsPropertiesPanelOpen(true);
  }, []);

  const onNodeAdd = useCallback((nodes) => {
    addNodes(nodes);
  }, [addNodes]);

  const getNextNodeId = (type) => {
    return `${type}_${Date.now()}`;
  };

  return (
    <div className="app">
      <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      <div className={`canvas-container ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
        <Canvas 
          onNodeSelect={onNodeSelect} 
          onNodeAdd={onNodeAdd} 
          getNextNodeId={getNextNodeId}
        />
      </div>
      <div className={`properties-panel-container ${isPropertiesPanelOpen ? 'open' : ''}`}>
        <PropertiesPanel selectedNodeId={selectedNodeId} />
      </div>
    </div>
  );
}

// NodeProvider ile sarılmış ana uygulama bileşeni
function App() {
  return (
    <NodeProvider>
      <AppContent />
    </NodeProvider>
  );
}

export default App;