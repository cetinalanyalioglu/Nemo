import React, { useCallback } from 'react';
import {
  IoChevronBackCircleOutline,
  IoConstructOutline,
  IoChevronDown,
  IoCheckbox,
  IoSquareOutline,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import '../styles/properties-panel.css';
import { useAppState } from '../context/AppStateContext';
import { useGraphStore } from '../store/graphStore';
import { useConsoleStore } from '../store/consoleStore';
import { selectIndicesReady } from '../store/graph-selectors';
import { checkNetworkValidity } from '../utils/network-validity';

const TOOLS_CONNECTIVITY_GROUP = '__tools_connectivity__';

const ToolsPane = React.memo(() => {
  const regenerateIndices = useGraphStore((s) => s.regenerateIndices);
  const indicesReady = useGraphStore(selectIndicesReady);
  const {
    appearance: { showIndices },
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  const handleCheckValidity = useCallback(() => {
    const { nodes, edges, nodeStates, model } = useGraphStore.getState();
    const issues = checkNetworkValidity({ nodes, edges, nodeStates, model });
    const append = useConsoleStore.getState().append;

    // Surface the results: open the console so they're visible.
    actions.consolePane.setIsOpen(true);

    if (nodes.length === 0) {
      append('info', 'Network validity: canvas is empty.');
      return;
    }
    if (issues.length === 0) {
      append('success', 'Network validity: OK — no disconnected elements or open ports.');
      return;
    }
    append(
      'warn',
      `Network validity: ${issues.length} issue${issues.length === 1 ? '' : 's'} found.`
    );
    issues.forEach((issue) => append('warn', `• ${issue.message}`));
  }, [actions.consolePane]);

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
                className={`checkbox-wrapper ${showIndices ? 'checked' : ''} ${!indicesReady ? 'disabled' : ''}`}
                onClick={indicesReady ? actions.appearance.toggleShowIndices : undefined}
                disabled={!indicesReady}
                aria-pressed={showIndices}
                aria-label="Show indices on canvas"
                title={
                  indicesReady
                    ? 'Display indices on nodes and edges'
                    : 'Run Renumber first to assign indices'
                }
              >
                {showIndices ? <IoCheckbox /> : <IoSquareOutline />}
              </button>
            </div>
          </div>
          <div className="document-pane-file-actions">
            <button
              type="button"
              className="document-pane-file-button"
              onClick={regenerateIndices}
              title="Assign sequential indices to nodes and edges to minimize bandwidth"
            >
              <IoConstructOutline className="document-pane-file-button-icon" />
              <span>Renumber</span>
            </button>
            <button
              type="button"
              className="document-pane-file-button"
              onClick={handleCheckValidity}
              title="Check for disconnected elements and unconnected ports; results go to the console"
            >
              <IoShieldCheckmarkOutline className="document-pane-file-button-icon" />
              <span>Check validity</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

ToolsPane.displayName = 'ToolsPane';

export default ToolsPane;
