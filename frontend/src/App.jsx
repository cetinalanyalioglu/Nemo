import React, { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import { NodeProvider } from './components/NodeContext';
import './App.css';
import { elementInfo } from './components/nodes/nodeTypes';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [nodeStates, setNodeStates] = useState({});
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [nodeCounters, setNodeCounters] = useState({}); // Her tip için sayaç

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
          ...prev[nodeId].parameters,
          [paramName]: value
        }
      }
    }));
  }, []);

  const getNextNodeId = (type) => {
    const currentCount = nodeCounters[type] || 0;
    const nextCount = currentCount + 1;
    
    setNodeCounters(prev => ({
      ...prev,
      [type]: nextCount
    }));

    return `${type}${nextCount}`;
  };

  const onNodeAdd = useCallback((nodes) => {
    nodes.forEach(node => {
      if (node.type === 'add') {
        const nodeType = node.item.type;
        const nodeId = node.item.id;
        
        const defaultParams = elementInfo[nodeType]?.parameters;

        if (!defaultParams) {
          console.error(`ElementInfo for nodeType "${nodeType}" bulunamadı.`);
          return;
        }

        setNodeStates(prev => ({
          ...prev,
          [nodeId]: {
            parameters: Object.keys(defaultParams).reduce((acc, key) => {
              acc[key] = defaultParams[key].defaultValue;
              return acc;
            }, {}),
          }
        }));
      }
    });
  }, []);

  return (
    <div className="app">
      <NodeProvider value={{ nodeStates, updateNodeParameter }}>
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
      </NodeProvider>
    </div>
  );
}

export default App;