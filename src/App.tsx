import React from 'react';
import GraphStoreBridge from './store/GraphStoreBridge';
import { installDiagnosticsBridge } from './utils/diagnostics';
import { isDebugMode } from './utils/debug';
import NodeLibrary from './components/node-library';
import DocumentPane from './components/document-pane';
import ModelPane from './components/model-pane';
import ToolsPane from './components/tools-pane';
import SettingsPane from './components/settings-pane';
import Canvas from './components/Canvas';
import ConsolePane from './components/console-pane';
import PropertiesPanel from './components/PropertiesPanel';
import NavigationControls from './components/NavigationControls';
import './styles/app.css';
import { ReactFlowProvider } from './context/ReactFlowContext';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { ModelProvider } from './context/ModelContext';

function AppContent() {
  const { sidebar } = useAppState();

  const renderPane = () => {
    if (sidebar.activePane === 'library') return <NodeLibrary />;
    if (sidebar.activePane === 'model') return <ModelPane />;
    if (sidebar.activePane === 'tools') return <ToolsPane />;
    if (sidebar.activePane === 'settings') return <SettingsPane />;
    return <DocumentPane />;
  };

  return (
    <div className="app">
      <NavigationControls />
      {renderPane()}
      <div className="canvas-container">
        <div className="canvas-workspace">
          <div className="canvas-area">
            <Canvas />
          </div>
          <ConsolePane />
        </div>
      </div>
      <PropertiesPanel />
    </div>
  );
}

function App() {
  React.useEffect(() => {
    if (isDebugMode()) {
      installDiagnosticsBridge();
    }
  }, []);

  return (
    <ReactFlowProvider>
      <ModelProvider>
        <AppStateProvider>
          <GraphStoreBridge />
          <AppContent />
        </AppStateProvider>
      </ModelProvider>
    </ReactFlowProvider>
  );
}

export default App;
