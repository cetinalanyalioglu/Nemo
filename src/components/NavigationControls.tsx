import React from 'react';
import { useAppState } from '../context/AppStateContext';
import { IoDocumentTextOutline, IoLibrary } from 'react-icons/io5';
import '../styles/navigation-controls.css';

const NavigationControls = React.memo(() => {
  const {
    sidebar: { isOpen, activePane },
    actions,
  } = useAppState();

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
    </div>
  );
});

NavigationControls.displayName = 'NavigationControls';

export default NavigationControls;
