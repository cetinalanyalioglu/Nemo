import React from 'react';
import {
  IoChevronBackCircleOutline,
  IoConstructOutline,
  IoChevronDown,
  IoCheckbox,
  IoSquareOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import '../styles/properties-panel.css';
import { useAppState } from '../context/AppStateContext';
import { useGraphStore } from '../store/graphStore';
import { selectSolverIndicesReady } from '../store/graph-selectors';

const TOOLS_CONNECTIVITY_GROUP = '__tools_connectivity__';

const ToolsPane = React.memo(() => {
  const regenerateSolverIndices = useGraphStore((s) => s.regenerateSolverIndices);
  const solverIndicesReady = useGraphStore(selectSolverIndicesReady);
  const {
    appearance: { showSolverIndices },
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  return (
    <div className={`sidebar tools-pane ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="panel-icon-wrapper">
          <IoConstructOutline className="panel-icon" />
          <span className="panel-title">TOOLS</span>
        </div>
        <IoChevronBackCircleOutline
          className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
          onClick={() => actions.sidebar.toggle()}
        />
      </div>

      <div
        className={`elements-group ${collapsedGroups[TOOLS_CONNECTIVITY_GROUP] ? 'collapsed' : ''}`}
      >
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(TOOLS_CONNECTIVITY_GROUP)}
        >
          <div className="group-header-content">
            <span>CONNECTIVITY</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div
          className={`group-content ${collapsedGroups[TOOLS_CONNECTIVITY_GROUP] ? 'collapsed' : ''}`}
        >
          <div className="parameter-row">
            <div className="boolean-parameter-row">
              <label className="parameter-label">Show indices</label>
              <button
                type="button"
                className={`checkbox-wrapper ${showSolverIndices ? 'checked' : ''} ${!solverIndicesReady ? 'disabled' : ''}`}
                onClick={
                  solverIndicesReady ? actions.appearance.toggleShowSolverIndices : undefined
                }
                disabled={!solverIndicesReady}
                aria-pressed={showSolverIndices}
                aria-label="Show solver indices on canvas"
                title={
                  solverIndicesReady
                    ? 'Display solver indices on nodes and edges'
                    : 'Run Renumber first to assign solver indices'
                }
              >
                {showSolverIndices ? <IoCheckbox /> : <IoSquareOutline />}
              </button>
            </div>
          </div>
          <div className="document-pane-file-actions">
            <button
              type="button"
              className="document-pane-file-button"
              onClick={regenerateSolverIndices}
              title="Assign sequential indices to nodes and edges to minimize solver bandwidth"
            >
              <IoConstructOutline className="document-pane-file-button-icon" />
              <span>Renumber</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ToolsPane.displayName = 'ToolsPane';

export default ToolsPane;
