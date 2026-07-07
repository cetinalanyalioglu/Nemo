import React from 'react';
import GraphStoreBridge from './store/GraphStoreBridge';
import { installDiagnosticsBridge } from './utils/diagnostics';
import { isDebugMode } from './utils/debug';
import NodeLibrary from './components/node-library';
import DocumentPane from './components/document-pane';
import ModelPane from './components/model-pane';
import DataPane from './components/data-pane';
import AnnotationsPane from './components/annotations-pane';
import ToolsPane from './components/tools-pane';
import SettingsPane from './components/settings-pane';
import Canvas from './components/Canvas';
import ConsolePane from './components/console-pane';
import PropertiesPanel from './components/PropertiesPanel';
import DatasetLoadDialog from './components/DatasetLoadDialog';
import NavigationControls from './components/NavigationControls';
import GlyphGallery from './components/GlyphGallery';
import './styles/app.css';
import { ReactFlowProvider } from './context/ReactFlowContext';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { ModelProvider } from './context/ModelContext';

function AppContent() {
  const { sidebar } = useAppState();

  const renderPane = () => {
    if (sidebar.activePane === 'library') return <NodeLibrary />;
    if (sidebar.activePane === 'model') return <ModelPane />;
    if (sidebar.activePane === 'data') return <DataPane />;
    if (sidebar.activePane === 'annotations') return <AnnotationsPane />;
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
      <DatasetLoadDialog />
    </div>
  );
}

function App() {
  React.useEffect(() => {
    if (isDebugMode()) {
      installDiagnosticsBridge();
    }
  }, []);

  // Dev-only design-review sheet for the glyph set (light + dark, all sizes).
  if (new URLSearchParams(window.location.search).has('glyphs')) {
    return <GlyphGallery />;
  }

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
