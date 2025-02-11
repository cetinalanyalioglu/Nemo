import React, { useState, useCallback } from 'react';
import { NodeProvider } from './components/NodeContext';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import './App.css';
import { ReactFlowProvider } from './context/ReactFlowContext';

// Ana uygulama mantığını içeren bileşen
function AppContent() {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);  // Başlangıçta kapalı
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  const onNodeSelect = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setIsPropertiesPanelOpen(!!nodeId);  // nodeId varsa aç, yoksa kapat
  }, []);

  return (
    <div className="app">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <div className={`canvas-container ${!isSidebarOpen ? 'sidebar-closed' : ''} ${isPropertiesPanelOpen ? 'properties-open' : ''}`}>
        <Canvas
          onNodeSelect={onNodeSelect}
          updateNodes={setNodes}
          updateEdges={setEdges}
        />
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