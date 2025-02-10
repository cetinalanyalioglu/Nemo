import React, { useState, useCallback } from 'react';
import { NodeProvider, useNodeContext } from './components/NodeContext';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import './App.css';
import exportTopology from './utils/exportTopology';
import { ReactFlowProvider } from './context/ReactFlowContext';
import { useReactFlow } from './context/ReactFlowContext';
import addNode from './utils/addNode';
import { addNodes } from './utils/addNode';

// Ana uygulama mantığını içeren bileşen
function AppContent() {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);  // Başlangıçta kapalı
  const [nodeCounts, setNodeCounts] = useState({}); // Her tip için sayaç
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const { registerNode, nodeStates } = useNodeContext();
  const { reactFlowInstance } = useReactFlow();

  const onNodeSelect = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    setIsPropertiesPanelOpen(!!nodeId);  // nodeId varsa aç, yoksa kapat
  }, []);

  const onNodeAdd = useCallback((node) => {
    registerNode(node);
  }, [registerNode]);

  const getNextNodeId = useCallback((type) => {

    // Increment the current counter value
    const nextCount = (nodeCounts[type] || 0) + 1;

    // Update the counter
    setNodeCounts(prev => ({
      ...prev,
      [type]: nextCount
    }));

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

  const onSave = useCallback(() => {
    if (!reactFlowInstance) {
      console.error('ReactFlow instance not found');
      return;
    }
    const flow = reactFlowInstance.toObject();
    console.log(JSON.stringify(flow));
  }, [reactFlowInstance]);

  const onRestore = useCallback(() => {
    // Create file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    // Handle file selection
    input.onchange = (e) => {
      const file = e.target.files[0];
      const reader = new FileReader();

      const restore = async (data) => {
        addNodes(
          data.nodes.map(node => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node.data,
            parameters: node.parameters
          })),
          {
            getNextNodeId,
            reactFlowInstance,
            onNodeAdd,
            onNodeSelect,
            updateCounter: (nodeType) => {
              console.log(`"${nodeType}" tipi için sayaç güncellendi.`);
            }
          }
        );
      }

      reader.onload = (event) => {
        try {
          const flow = JSON.parse(event.target.result);
          // Log IDs of all nodes in the imported flow
          if (flow.nodes && Array.isArray(flow.nodes)) {
            console.log('Imported node IDs:');
            flow.nodes.forEach(node => {
              console.log(`Node ID: ${node.id}, Type: ${node.type}`);
            });
            restore(flow);
          }
          // if (reactFlowInstance) {
          //   reactFlowInstance.setNodes(flow.nodes || []);
          //   reactFlowInstance.setEdges(flow.edges || []);
          // }
        } catch (error) {
          console.error('Error parsing JSON file:', error);
        }
      };

      reader.readAsText(file);
    };

    // Trigger file selection dialog
    input.click();
  }, [reactFlowInstance]); // Added missing dependency array and semicolon

  return (
    <div className="app">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onExport={onRestore}
      />
      <div className={`canvas-container ${!isSidebarOpen ? 'sidebar-closed' : ''} ${isPropertiesPanelOpen ? 'properties-open' : ''}`}>
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