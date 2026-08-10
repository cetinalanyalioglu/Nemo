import React from 'react';
import GraphStoreBridge from './store/GraphStoreBridge';
import { installDiagnosticsBridge } from './utils/diagnostics';
import NodeLibrary from './components/node-library';
import DocumentPane from './components/document-pane';
import ModelPane from './components/model-pane';
import DataPane from './components/data-pane';
import AnnotationsPane from './components/annotations-pane';
import ToolsPane from './components/tools-pane';
import SettingsPane from './components/settings-pane';
import Canvas from './components/Canvas';
import ConsolePane from './components/console-pane';
import WorkspaceLayoutPicker from './components/workspace-layout-picker';
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
import { useSplitResize } from './hooks/use-split-resize';

function AppContent() {
  const { sidebar, workspace, appearance, actions } = useAppState();
  const { layout, splitRatio } = workspace;
  const showCanvas = layout !== 'notebook';
  const showResults = layout !== 'canvas';
  const { splitRef, onDividerPointerDown, onDividerKeyDown } = useSplitResize(
    splitRatio,
    actions.workspace.setSplitRatio
  );

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
          <WorkspaceLayoutPicker />
          {/* Both surfaces stay mounted. React Flow loses its viewport when it is torn
              down, and a notebook cell loses what is half-typed into it, so an
              arrangement that leaves one out hides it rather than replacing it.

              The console pane is a sibling of the split rather than inside it, so it
              spans both panes however they are divided. */}
          <div
            className="workspace-split"
            ref={splitRef}
            style={{ ['--workspace-split-ratio' as string]: splitRatio }}
          >
            <div className="canvas-area" hidden={!showCanvas}>
              <Canvas />
            </div>
            {layout === 'split' && (
              <div
                className="workspace-divider"
                role="separator"
                aria-orientation="vertical"
                aria-label="Share of the width given to the canvas"
                aria-valuenow={Math.round(splitRatio * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                onPointerDown={onDividerPointerDown}
                onKeyDown={onDividerKeyDown}
              />
            )}
            <div className="results-area" hidden={!showResults}>
              <ResultsTab />
            </div>
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
  // Errors are worth capturing however quiet the message log is set: what the log's
  // verbosity decides is what is worth showing, not what is worth knowing.
  React.useEffect(() => {
    installDiagnosticsBridge();
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
