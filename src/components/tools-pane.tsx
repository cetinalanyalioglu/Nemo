import React, { useCallback } from 'react';
import {
  IoChevronBackCircleOutline,
  IoConstructOutline,
  IoChevronDown,
  IoShieldCheckmarkOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import SidebarShell from './sidebar-shell';
import '../styles/properties-panel.css';
import { useAppState } from '../context/AppStateContext';
import { useGraphStore } from '../store/graphStore';
import { useConsoleStore } from '../store/consoleStore';
import { checkNetworkValidity, collectHighlightTargets } from '../utils/network-validity';

const TOOLS_CONNECTIVITY_GROUP = '__tools_connectivity__';

const ToolsPane = React.memo(() => {
  const regenerateIndices = useGraphStore((s) => s.regenerateIndices);
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  const handleCheckValidity = useCallback(() => {
    const {
      nodes,
      edges,
      nodeStates,
      edgeStates,
      model,
      modelParameters,
      setHighlightedNodes,
      setHighlightedEdges,
    } = useGraphStore.getState();
    const issues = checkNetworkValidity({
      nodes,
      edges,
      nodeStates,
      edgeStates,
      model,
      modelParameters,
    });
    const append = useConsoleStore.getState().append;

    // Surface the results: open the console so they're visible.
    actions.consolePane.setIsOpen(true);

    // Highlight the offending nodes and edges on the canvas (deduped). The
    // highlight clears as soon as the user selects anything.
    const { nodeIds, edgeIds } = collectHighlightTargets(issues);
    setHighlightedNodes(nodeIds);
    setHighlightedEdges(edgeIds);

    if (nodes.length === 0) {
      append('info', 'Network validity: canvas is empty.');
      return;
    }
    if (issues.length === 0) {
      append(
        'success',
        'Network validity: OK — no disconnected elements, open ports, or missing inputs.'
      );
      return;
    }
    const errorCount = issues.filter((issue) => issue.severity === 'error').length;
    const summary = `Network validity: ${issues.length} issue${issues.length === 1 ? '' : 's'} found${
      errorCount > 0 ? ` (${errorCount} error${errorCount === 1 ? '' : 's'})` : ''
    }.`;
    append(errorCount > 0 ? 'error' : 'warn', summary);
    issues.forEach((issue) =>
      append(issue.severity === 'error' ? 'error' : 'warn', `• ${issue.message}`)
    );
  }, [actions.consolePane]);

  return (
    <SidebarShell className="tools-pane">
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
    </SidebarShell>
  );
});

ToolsPane.displayName = 'ToolsPane';

export default ToolsPane;
