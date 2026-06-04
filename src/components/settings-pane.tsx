import React from 'react';
import { IoChevronBackCircleOutline, IoChevronDown, IoSettingsOutline } from 'react-icons/io5';
import '../styles/sidebar.css';
import { useAppState } from '../context/AppStateContext';
import { THEME_OPTIONS } from '../types/theme';
import type { ThemeId } from '../types/theme';

const SETTINGS_APPEARANCE_GROUP = '__settings_appearance__';

const SettingsPane = React.memo(() => {
  const {
    appearance: { theme },
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  const handleThemeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    actions.appearance.setTheme(event.target.value as ThemeId);
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="panel-icon-wrapper">
          <IoSettingsOutline className="panel-icon" />
          <span className="panel-title">SETTINGS</span>
        </div>
        <IoChevronBackCircleOutline
          className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
          onClick={() => actions.sidebar.toggle()}
        />
      </div>

      <div
        className={`elements-group ${collapsedGroups[SETTINGS_APPEARANCE_GROUP] ? 'collapsed' : ''}`}
      >
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(SETTINGS_APPEARANCE_GROUP)}
        >
          <div className="group-header-content">
            <span>APPEARANCE</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div
          className={`group-content ${collapsedGroups[SETTINGS_APPEARANCE_GROUP] ? 'collapsed' : ''}`}
        >
          <div className="model-selector settings-theme-selector">
            <label className="model-selector-label" htmlFor="theme-select">
              THEME
            </label>
            <div className="model-select-wrapper">
              <select
                id="theme-select"
                className="model-select"
                value={theme}
                onChange={handleThemeChange}
              >
                {THEME_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <IoChevronDown className="model-select-icon" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

SettingsPane.displayName = 'SettingsPane';

export default SettingsPane;
