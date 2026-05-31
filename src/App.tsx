import React from 'react';
import { NodeProvider } from './context/NodeContext';
import NodeLibrary from './components/node-library';
import DocumentPane from './components/document-pane';
import Canvas from './components/Canvas';
import PropertiesPanel from './components/PropertiesPanel';
import NavigationControls from './components/NavigationControls';
import './styles/app.css';
import { ReactFlowProvider } from './context/ReactFlowContext';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { ModelProvider } from './context/ModelContext';

function AppContent() {
  const { sidebar } = useAppState();

  return (
    <div className="app">
      <NavigationControls />
      {sidebar.activePane === 'library' ? <NodeLibrary /> : <DocumentPane />}
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
      <ModelProvider>
        <NodeProvider>
          <AppStateProvider>
            <AppContent />
          </AppStateProvider>
        </NodeProvider>
      </ModelProvider>
    </ReactFlowProvider>
  );
}

export default App;
