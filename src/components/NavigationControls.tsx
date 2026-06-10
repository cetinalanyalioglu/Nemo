import React from 'react';
import { useAppState } from '../context/AppStateContext';
import {
  IoDocumentTextOutline,
  IoLibrary,
  IoCubeOutline,
  IoStatsChartOutline,
  IoConstructOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
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

      <button
        type="button"
        onClick={() => actions.sidebar.selectPane('model')}
        className={`nav-button ${isOpen && activePane === 'model' ? 'active' : ''}`}
        title="Model parameters"
      >
        <IoCubeOutline />
      </button>

      <button
        type="button"
        onClick={() => actions.sidebar.selectPane('data')}
        className={`nav-button ${isOpen && activePane === 'data' ? 'active' : ''}`}
        title="Data"
      >
        <IoStatsChartOutline />
      </button>

      <button
        type="button"
        onClick={() => actions.sidebar.selectPane('tools')}
        className={`nav-button ${isOpen && activePane === 'tools' ? 'active' : ''}`}
        title="Tools"
      >
        <IoConstructOutline />
      </button>

      <button
        type="button"
        onClick={() => actions.sidebar.selectPane('settings')}
        className={`nav-button ${isOpen && activePane === 'settings' ? 'active' : ''}`}
        title="Settings"
      >
        <IoSettingsOutline />
      </button>
    </div>
  );
});

NavigationControls.displayName = 'NavigationControls';

export default NavigationControls;
