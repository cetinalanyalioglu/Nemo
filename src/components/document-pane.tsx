import React, { useRef } from 'react';
import {
  IoChevronBackCircleOutline,
  IoDocumentTextOutline,
  IoChevronDown,
  IoDocumentOutline,
  IoFolderOpenOutline,
  IoSaveOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { useAppState } from '../context/AppStateContext';
import { useNodeContext } from '../context/NodeContext';

const DOCUMENT_FILE_GROUP = '__document_file__';

const DocumentPane = React.memo(() => {
  const { saveToFile, loadFromFile, reset, nodes } = useNodeContext();
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadFromFile(file);
      event.target.value = '';
    }
  };

  const handleNew = () => {
    if (nodes.length > 0) {
      const confirmed = window.confirm('Start a new document? This will clear the current canvas.');
      if (!confirmed) return;
    }
    reset();
  };

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

      <div className={`elements-group ${collapsedGroups[DOCUMENT_FILE_GROUP] ? 'collapsed' : ''}`}>
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(DOCUMENT_FILE_GROUP)}
        >
          <div className="group-header-content">
            <span>FILE</span>
            <IoChevronDown
              className="group-collapse-icon"
              style={{
                transform: collapsedGroups[DOCUMENT_FILE_GROUP] ? 'rotate(-90deg)' : 'rotate(0deg)',
              }}
            />
          </div>
        </div>
        <div className={`group-content ${collapsedGroups[DOCUMENT_FILE_GROUP] ? 'collapsed' : ''}`}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".yaml,.yml"
            style={{ display: 'none' }}
          />
          <div className="document-pane-file-actions">
            <button type="button" className="document-pane-file-button" onClick={handleNew}>
              <IoDocumentOutline className="document-pane-file-button-icon" />
              <span>New</span>
            </button>
            <button type="button" className="document-pane-file-button" onClick={saveToFile}>
              <IoSaveOutline className="document-pane-file-button-icon" />
              <span>Save</span>
            </button>
            <button
              type="button"
              className="document-pane-file-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <IoFolderOpenOutline className="document-pane-file-button-icon" />
              <span>Load</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

DocumentPane.displayName = 'DocumentPane';

export default DocumentPane;
