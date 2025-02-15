import React, { useState } from 'react';
import { NodeProvider } from './context/NodeContext';
import Sidebar from './components/Sidebar';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import NavigationControls from './components/NavigationControls';
import './styles/app.css';
import { ReactFlowProvider } from './context/ReactFlowContext';

// Main application logic component
function AppContent() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="app">
      <NavigationControls 
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={() => setIsSidebarOpen(true)}
      />
      <Sidebar 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen}
      />
      <div className="canvas-container">
        <Canvas />
      </div>
      <PropertiesPanel />
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