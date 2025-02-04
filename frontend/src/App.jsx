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
  const [nodeCounters, setNodeCounters] = useState({}); // Her tip için sayaç

  const onNodeSelect = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setIsPropertiesPanelOpen(!!nodeId);
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
        const nodeId = getNextNodeId(nodeType);
        const defaultParams = require(`./components/nodeTypes/FlowNetwork/${nodeType}`).elementInfo.parameters;
        
        setNodeStates(prev => ({
          ...prev,
          [nodeId]: {
            parameters: {
              ...Object.entries(defaultParams).reduce((acc, [key, value]) => {
                acc[key] = value.defaultValue;
                return acc;
              }, {}),
              label: nodeId // label'ı ID ile aynı yap
            }
          }
        }));

        // Node'un ID'sini güncelle
        node.item.id = nodeId;
      }
    });
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

  return (
    <NodeProvider nodeStates={nodeStates} updateNodeParameter={updateNodeParameter}>
      <div className="app">
        <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
        <div 
          className="canvas-container"
          style={{ 
            marginLeft: isSidebarOpen ? '300px' : '0'
          }}
        >
          <Canvas onNodeSelect={onNodeSelect} onNodeAdd={onNodeAdd} />
        </div>
        <div className={`properties-panel-container ${isPropertiesPanelOpen ? 'open' : ''}`}>
          <PropertiesPanel selectedNodeId={selectedNodeId} />
        </div>
      </div>
    </NodeProvider>
  );
}

export default App;