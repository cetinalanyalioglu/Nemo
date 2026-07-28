import React from 'react';
import { IoDocumentTextOutline, IoGitNetworkOutline } from 'react-icons/io5';
import { useAppState } from '../context/AppStateContext';
import { useNotebookStore } from '../store/notebookStore';
import type { WorkspaceTab } from '../types/console';

/**
 * The two things the big surface can be: the network, or the notebook about it.
 *
 * The console pane stays docked below whichever is showing, so the prompt is always
 * there — what switches is what is being looked at, not what can be typed into.
 */

const TABS: { id: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
  { id: 'canvas', label: 'Canvas', icon: <IoGitNetworkOutline aria-hidden /> },
  { id: 'results', label: 'Results', icon: <IoDocumentTextOutline aria-hidden /> },
];

const WorkspaceTabs = React.memo(() => {
  const {
    workspace: { activeTab },
    actions,
  } = useAppState();
  // A dot rather than a count: how many cells are unsaved is not a useful number, but
  // whether the notebook has been touched since it was written out is.
  const dirty = useNotebookStore((s) => s.dirty);

  return (
    <div className="workspace-tabs" role="tablist" aria-label="Workspace">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`workspace-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => actions.workspace.selectTab(tab.id)}
        >
          {tab.icon}
          <span>{tab.label}</span>
          {tab.id === 'results' && dirty && (
            <span className="workspace-tab-dot" title="This notebook has unsaved changes" />
          )}
        </button>
      ))}
    </div>
  );
});

WorkspaceTabs.displayName = 'WorkspaceTabs';

export default WorkspaceTabs;
