import React, { useState, useCallback } from 'react';
import { NodeProvider, useNodeContext } from './components/NodeContext';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import './App.css';
import exportTopology from './utils/exportTopology';

// Ana uygulama mantığını içeren bileşen
function AppContent() {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);  // Başlangıçta kapalı
  const [nodeCounts, setNodeCounts] = useState({}); // Her tip için sayaç
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const { addNodes, nodeStates } = useNodeContext();

  const onNodeSelect = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setIsPropertiesPanelOpen(!!nodeId);  // nodeId varsa aç, yoksa kapat
  }, []);

  const onNodeAdd = useCallback((nodes) => {
    addNodes(nodes);
  }, [addNodes]);

  const getNextNodeId = useCallback((type) => {
    // Mevcut sayacı al ve 1 artır
    const nextCount = (nodeCounts[type] || 0) + 1;
    
    // Sayacı güncelle
    setNodeCounts(prev => ({
      ...prev,
      [type]: nextCount
    }));

    console.log(nextCount);

    // Timestamp yerine sayaç kullanalım
    return `${type}_${nextCount}`;
  }, [nodeCounts]);

  const handleExport = useCallback(() => {
    const dataStr = exportTopology({ nodes, edges, nodeStates });
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "topology.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [nodes, edges, nodeStates]);

  return (
    <div className="app">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onExport={handleExport}
      />
      <div className={`canvas-container ${!isSidebarOpen ? 'sidebar-closed' : ''}`}>
        <Canvas 
          onNodeSelect={onNodeSelect} 
          onNodeAdd={onNodeAdd} 
          getNextNodeId={getNextNodeId}
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

// NodeProvider ile sarılmış ana uygulama bileşeni
function App() {
  return (
    <NodeProvider>
      <AppContent />
    </NodeProvider>
  );
}

export default App;