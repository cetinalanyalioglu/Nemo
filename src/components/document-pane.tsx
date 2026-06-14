import React, { useRef } from 'react';
import {
  IoChevronBackCircleOutline,
  IoDocumentTextOutline,
  IoChevronDown,
  IoDocumentOutline,
  IoFolderOpenOutline,
  IoSaveOutline,
  IoCheckbox,
  IoSquareOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { useAppState } from '../context/AppStateContext';
import { useGraphStore } from '../store/graphStore';
import { useDataStore } from '../store/dataStore';

const DOCUMENT_FILE_GROUP = '__document_file__';

const DocumentPane = React.memo(() => {
  const saveToFile = useGraphStore((s) => s.saveToFile);
  const loadFromFile = useGraphStore((s) => s.loadFromFile);
  const reset = useGraphStore((s) => s.reset);
  const clearDatasets = useDataStore((s) => s.clearDatasets);
  const datasets = useDataStore((s) => s.datasets);
  const toggleDatasetSave = useDataStore((s) => s.toggleDatasetSave);
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const datasetCount = datasets.length;
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Loading a new canvas invalidates any datasets bound to the old one, so
      // clear them just like the "New" button does.
      clearDatasets();
      loadFromFile(file);
      event.target.value = '';
    }
  };

  const handleNew = () => {
    if (nodeCount > 0 || datasetCount > 0) {
      const confirmed = window.confirm(
        'Start a new document? This will clear the current canvas and any loaded data.'
      );
      if (!confirmed) return;
    }
    reset();
    clearDatasets();
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
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div className={`group-content ${collapsedGroups[DOCUMENT_FILE_GROUP] ? 'collapsed' : ''}`}>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".yaml,.yml"
            className="file-input-hidden"
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

          {datasetCount > 0 && (
            <div className="document-pane-save-data">
              <div className="document-pane-save-data-title">Include data on save</div>
              <ul className="document-pane-save-data-list">
                {datasets.map((dataset) => (
                  <li key={dataset.id} className="document-pane-save-data-row">
                    <button
                      type="button"
                      className={`document-pane-save-check ${dataset.includeInSave ? 'checked' : ''}`}
                      onClick={() => toggleDatasetSave(dataset.id)}
                      aria-pressed={dataset.includeInSave}
                      aria-label={`${dataset.includeInSave ? 'Exclude' : 'Include'} ${dataset.name}`}
                    >
                      {dataset.includeInSave ? <IoCheckbox /> : <IoSquareOutline />}
                    </button>
                    <span className="document-pane-save-data-name" title={dataset.name}>
                      {dataset.name}
                    </span>
                    <span className="document-pane-save-data-count">
                      {dataset.items.length} item{dataset.items.length === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

DocumentPane.displayName = 'DocumentPane';

export default DocumentPane;
