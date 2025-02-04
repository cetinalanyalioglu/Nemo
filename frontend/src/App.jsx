import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import './App.css';

function App() {
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const handleNodeSelect = (nodeId) => {
    setSelectedNodeId(nodeId);
  };

  return (
    <div className="app">
      <Sidebar />
      <Canvas onNodeSelect={handleNodeSelect} />
      <PropertiesPanel selectedNodeId={selectedNodeId} />
    </div>
  );
}

export default App;