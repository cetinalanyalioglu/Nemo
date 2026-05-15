import React from 'react';
import {
  IoChevronBackCircleOutline,
  IoDocumentTextOutline,
  IoChevronDown,
  IoDocumentOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { useAppState } from '../context/AppStateContext';

const DOCUMENT_PLACEHOLDER_GROUP = '__document_placeholder__';

const DOCUMENT_INTRO_COPY =
  'This workspace is reserved for document-level tooling. Topology save and load, metadata, or release notes might live here in a future build. For now, this paragraph is placeholder copy so layout and typography can be reviewed alongside the canvas.';

const DocumentPane = React.memo(() => {
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="panel-icon-wrapper">
          <IoDocumentTextOutline className="panel-icon" />
          <span className="panel-title">DOCUMENT</span>
        </div>
        <IoChevronBackCircleOutline
          className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
          onClick={() => actions.sidebar.toggle()}
        />
      </div>

      <div className="action-icons">
        <button type="button" className="action-button" title="Document actions (placeholder)">
          <IoDocumentOutline className="action-icon" />
        </button>
      </div>

      <div
        className={`elements-group ${collapsedGroups[DOCUMENT_PLACEHOLDER_GROUP] ? 'collapsed' : ''}`}
      >
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(DOCUMENT_PLACEHOLDER_GROUP)}
        >
          <div className="group-header-content">
            <span>PLACEMENT AREA</span>
            <IoChevronDown
              className="group-collapse-icon"
              style={{
                transform: collapsedGroups[DOCUMENT_PLACEHOLDER_GROUP]
                  ? 'rotate(-90deg)'
                  : 'rotate(0deg)',
              }}
            />
          </div>
        </div>
        <div
          className={`group-content ${collapsedGroups[DOCUMENT_PLACEHOLDER_GROUP] ? 'collapsed' : ''}`}
        >
          <p className="document-pane-placeholder">{DOCUMENT_INTRO_COPY}</p>
          <p className="document-pane-placeholder">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante.
          </p>
        </div>
      </div>
    </div>
  );
});

DocumentPane.displayName = 'DocumentPane';

export default DocumentPane;
