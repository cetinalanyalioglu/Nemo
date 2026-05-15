import React, { useRef } from 'react';
import { useNodeContext } from '../context/NodeContext';
import { useAppState } from '../context/AppStateContext';
import { FaSave, FaFolderOpen } from 'react-icons/fa';
import { IoDocumentTextOutline, IoLibrary } from 'react-icons/io5';
import '../styles/navigation-controls.css';

const NavigationControls = React.memo(() => {
  const { saveToFile, loadFromFile } = useNodeContext();

  const {
    sidebar: { isOpen, activePane },
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

  return (
    <div className="navigation-controls">
      <button
        type="button"
        onClick={() => actions.sidebar.selectPane('document')}
        className={`nav-button ${isOpen && activePane === 'document' ? 'active' : ''}`}
        title="Document pane"
      >
        <IoDocumentTextOutline />
      </button>

      <button
        type="button"
        onClick={() => actions.sidebar.selectPane('library')}
        className={`nav-button ${isOpen && activePane === 'library' ? 'active' : ''}`}
        title="Node library"
      >
        <IoLibrary />
      </button>

      <button type="button" onClick={saveToFile} className="nav-button" title="Save canvas">
        <FaSave />
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json"
        style={{ display: 'none' }}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="nav-button"
        title="Load canvas"
      >
        <FaFolderOpen />
      </button>
    </div>
  );
});

NavigationControls.displayName = 'NavigationControls';

export default NavigationControls;
