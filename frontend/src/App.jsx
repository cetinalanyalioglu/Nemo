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

  // useCallback ile fonksiyonu memorize edelim
  const onNodeSelect = useCallback((nodeId) => {
    console.log('App - onNodeSelect called with:', nodeId);
    setSelectedNodeId(nodeId);
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

  // Yeni node eklendiğinde nodeStates'i güncelle
  const onNodesChange = useCallback((nodes) => {
    nodes.forEach(node => {
      if (node.type === 'add') {
        const nodeType = node.item.type;
        // elementInfo'dan varsayılan parametreleri al
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

  // Her render'da mevcut state'i görelim
  console.log('App rendering, selectedNodeId:', selectedNodeId);

  return (
    <NodeProvider nodeStates={nodeStates} updateNodeParameter={updateNodeParameter}>
      <div className="app" style={{ display: 'flex', width: '100vw', height: '100vh' }}>
        <Sidebar isOpen={isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
        <Canvas onNodeSelect={onNodeSelect} onNodesChange={onNodesChange} />
        <div style={{ 
          width: '300px', 
          borderLeft: '2px solid red',
          background: 'white'
        }}>
          {selectedNodeId ? (
            <PropertiesPanel selectedNodeId={selectedNodeId} />
          ) : (
            <div className="properties-panel">
              <div className="no-element">No element selected (ID: {selectedNodeId})</div>
            </div>
          )}
        </div>
      </div>
    </NodeProvider>
  );
}

export default App;