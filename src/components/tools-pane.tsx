import React from 'react';
import { IoChevronBackCircleOutline, IoConstructOutline, IoChevronDown } from 'react-icons/io5';
import '../styles/sidebar.css';
import { useAppState } from '../context/AppStateContext';
import { useGraphStore } from '../store/graphStore';

const TOOLS_CONNECTIVITY_GROUP = '__tools_connectivity__';

const ToolsPane = React.memo(() => {
  const regenerateSolverIndices = useGraphStore((s) => s.regenerateSolverIndices);
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
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
            <IoChevronDown
              className="group-collapse-icon"
              style={{
                transform: collapsedGroups[TOOLS_CONNECTIVITY_GROUP]
                  ? 'rotate(-90deg)'
                  : 'rotate(0deg)',
              }}
            />
          </div>
        </div>
        <div
          className={`group-content ${collapsedGroups[TOOLS_CONNECTIVITY_GROUP] ? 'collapsed' : ''}`}
        >
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
