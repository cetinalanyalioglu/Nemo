import React, { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import { NodeProvider } from './components/NodeContext';
import './App.css';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [nodeStates, setNodeStates] = useState({});
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);

  const onNodeSelect = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setIsPropertiesPanelOpen(!!nodeId);
  }, []);

  const updateNodeParameter = useCallback((nodeId, paramName, value) => {
    setNodeStates(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        parameters: {
          ...(prev[nodeId]?.parameters || {}),
          [paramName]: value
        }
      }
    }));
  }, []);

  const onNodeAdd = useCallback((nodes) => {
    nodes.forEach(node => {
      if (node.type === 'add') {
        const nodeType = node.item.type;
        const defaultParams = require(`./components/nodeTypes/FlowNetwork/${nodeType}`).elementInfo.parameters;
        
        setNodeStates(prev => ({
          ...prev,
          [node.item.id]: {
            parameters: Object.entries(defaultParams).reduce((acc, [key, value]) => {
              acc[key] = value.defaultValue;
              return acc;
            }, {})
          }
        }));
      }
    });
  }, []);

  return (
    <NodeProvider nodeStates={nodeStates} updateNodeParameter={updateNodeParameter}>
      <div className="app" style={{ display: 'flex', width: '100vw', height: '100vh' }}>
        <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
        <Canvas onNodeSelect={onNodeSelect} onNodeAdd={onNodeAdd} />
        <div className={`properties-panel-container ${isPropertiesPanelOpen ? 'open' : ''}`}>
          <PropertiesPanel selectedNodeId={selectedNodeId} />
        </div>
      </div>
    </NodeProvider>
  );
}

export default App;