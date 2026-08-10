import React from 'react';
import { BsLayoutSplit } from 'react-icons/bs';
import { IoDocumentTextOutline, IoGitNetworkOutline } from 'react-icons/io5';
import { useAppState } from '../context/AppStateContext';
import { useNotebookStore } from '../store/notebookStore';
import { WORKSPACE_LAYOUT_OPTIONS, type WorkspaceLayout } from '../types/console';

/**
 * How the big surface is arranged: the network, the notebook about it, or both.
 *
 * Three named arrangements rather than panes that can be split anywhere, because the
 * choice is made once and then left. The console pane stays docked below all three, so
 * the prompt is always there — what changes is what is being looked at.
 */

const ICONS: Record<WorkspaceLayout, React.ReactNode> = {
  canvas: <IoGitNetworkOutline aria-hidden />,
  split: <BsLayoutSplit aria-hidden />,
  notebook: <IoDocumentTextOutline aria-hidden />,
};

const WorkspaceLayoutPicker = React.memo(() => {
  const {
    workspace: { layout },
    actions,
  } = useAppState();
  // A dot rather than a count: how many cells are unsaved is not a useful number, but
  // whether the notebook has been touched since it was written out is. Shown only while
  // the notebook is out of sight, since it is the reminder for work left behind.
  const dirty = useNotebookStore((s) => s.dirty);
  const hidden = layout === 'canvas';

  return (
    <div className="workspace-layouts" role="radiogroup" aria-label="Workspace layout">
      {WORKSPACE_LAYOUT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={layout === option.value}
          className={`workspace-layout ${layout === option.value ? 'active' : ''}`}
          onClick={() => actions.workspace.selectLayout(option.value)}
        >
          {ICONS[option.value]}
          <span>{option.label}</span>
          {option.value === 'notebook' && hidden && dirty && (
            <span className="workspace-layout-dot" title="This notebook has unsaved changes" />
          )}
        </button>
      ))}
    </div>
  );
});

WorkspaceLayoutPicker.displayName = 'WorkspaceLayoutPicker';

export default WorkspaceLayoutPicker;
