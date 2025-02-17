import React, { useRef } from 'react';
import { useNodeContext } from '../context/NodeContext';
import { useAppState } from '../context/AppStateContext';
import { FaBars, FaSave, FaFolderOpen } from 'react-icons/fa';
import { BsGrid } from 'react-icons/bs';
import '../styles/navigation-controls.css';

/**
 * NavigationControls component provides file operations and sidebar toggle functionality.
 * Includes buttons for:
 * - Toggling the sidebar visibility
 * - Saving the current canvas state to a file
 * - Loading a previously saved canvas state
 *
 * @returns {React.Component} Navigation controls bar
 */
const NavigationControls = () => {
  // Get file operation functions from context
  const { saveToFile, loadFromFile } = useNodeContext();

  // Get UI states from AppState context
  const {
    sidebar: { isOpen },
    grid: { snapToGrid },
    actions,
  } = useAppState();

  // Reference to hidden file input for opening files
  const fileInputRef = useRef(null);

  /**
   * Handles file selection from the file dialog
   * Loads the selected file and resets the input for reuse
   *
   * @param {Event} event File input change event
   */
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      loadFromFile(file);
      // Reset file input so the same file can be selected again
      event.target.value = '';
    }
  };

  return (
    <div className="navigation-controls">
      {/* Show sidebar toggle only when sidebar is closed */}
      {!isOpen && (
        <button
          onClick={actions.sidebar.toggle}
          className="nav-button"
          title="Open the element library"
        >
          <FaBars />
        </button>
      )}

      {/* Save canvas state button */}
      <button onClick={saveToFile} className="nav-button" title="Save canvas">
        <FaSave />
      </button>

      {/* Hidden file input for loading files */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".json"
        style={{ display: 'none' }}
      />

      {/* Load canvas state button */}
      <button
        onClick={() => fileInputRef.current.click()}
        className="nav-button"
        title="Load canvas"
      >
        <FaFolderOpen />
      </button>

      <button
        className={`nav-button ${snapToGrid ? 'active' : ''}`}
        onClick={actions.grid.toggleSnap}
        title="Toggle snapping to grid lines"
      >
        <BsGrid />
      </button>
    </div>
  );
};

export default NavigationControls;
