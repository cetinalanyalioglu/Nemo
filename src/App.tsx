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
import WorkspaceTabs from './components/workspace-tabs';
import ResultsTab from './components/notebook/ResultsTab';
import { redrawPinnedFigures } from './python/redraw-figures';
import PropertiesPanel from './components/PropertiesPanel';
import DatasetLoadDialog from './components/DatasetLoadDialog';
import NavigationControls from './components/NavigationControls';
import GlyphGallery from './components/GlyphGallery';
import './styles/app.css';
import { ReactFlowProvider } from './context/ReactFlowContext';
import { AppStateProvider, useAppState } from './context/AppStateContext';
import { ModelProvider } from './context/ModelContext';

function AppContent() {
  const { sidebar, workspace, appearance } = useAppState();
  const workspaceTab = workspace.activeTab;

  // A pinned figure is a picture, so it does not follow a theme change on its own. It
  // is drawn again from the figure it was made from, which the annotation kept.
  //
  // On the next frame, not on this effect. A figure is drawn in whatever colours the
  // document is carrying when it is drawn, and the attribute that changes those is set
  // by an effect in the provider above -- which React runs *after* this one, since a
  // child's effects run before its parent's. Waiting for the frame waits for the theme.
  const theme = appearance.theme;
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const frame = requestAnimationFrame(() => void redrawPinnedFigures());
    return () => cancelAnimationFrame(frame);
  }, [theme]);

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
          <WorkspaceTabs />
          {/* Both surfaces stay mounted. React Flow loses its viewport when it is torn
              down, and a notebook cell loses what is half-typed into it, so switching
              tabs hides one rather than replacing it. */}
          <div className="canvas-area" hidden={workspaceTab !== 'canvas'}>
            <Canvas />
          </div>
          <div className="results-area" hidden={workspaceTab !== 'results'}>
            <ResultsTab />
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
