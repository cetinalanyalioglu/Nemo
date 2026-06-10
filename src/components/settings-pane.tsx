import React, { useCallback } from 'react';
import {
  IoChevronBackCircleOutline,
  IoChevronDown,
  IoSettingsOutline,
  IoAdd,
  IoRemove,
  IoCheckbox,
  IoSquareOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import '../styles/properties-panel.css';
import { useAppState } from '../context/AppStateContext';
import { THEME_OPTIONS } from '../types/theme';
import type { ThemeId } from '../types/theme';
import type { EdgePathStyle } from '../context/AppStateContext';

const SETTINGS_APPEARANCE_GROUP = '__settings_appearance__';
const SETTINGS_LAYOUT_GROUP = '__settings_layout__';

const EDGE_PATH_OPTIONS: { value: EdgePathStyle; label: string }[] = [
  { value: 'bezier', label: 'Bezier' },
  { value: 'simplebezier', label: 'Simple Bezier' },
  { value: 'smoothstep', label: 'Smooth Step' },
  { value: 'straight', label: 'Straight' },
];

const LAYOUT_SEP_MIN = 20;
const LAYOUT_SEP_MAX = 400;
const LAYOUT_SEP_STEP = 10;

const clampSep = (value: number) => Math.min(LAYOUT_SEP_MAX, Math.max(LAYOUT_SEP_MIN, value));

type SettingsNumberFieldProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

const SettingsNumberField = ({ id, label, value, onChange }: SettingsNumberFieldProps) => {
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(event.target.value, 10);
    if (!isNaN(parsed)) {
      onChange(clampSep(parsed));
    }
  };

  const increment = () => onChange(clampSep(value + LAYOUT_SEP_STEP));
  const decrement = () => onChange(clampSep(value - LAYOUT_SEP_STEP));

  return (
    <div className="parameter-row">
      <label className="parameter-label" htmlFor={id}>
        {label}
      </label>
      <div className="parameter-input-container">
        <input
          id={id}
          type="number"
          className="parameter-input"
          value={value}
          min={LAYOUT_SEP_MIN}
          max={LAYOUT_SEP_MAX}
          step={LAYOUT_SEP_STEP}
          onChange={handleInputChange}
        />
        <div className="number-controls">
          <button
            type="button"
            className="number-control-btn"
            onClick={increment}
            aria-label="Increase"
          >
            <IoAdd />
          </button>
          <button
            type="button"
            className="number-control-btn"
            onClick={decrement}
            aria-label="Decrease"
          >
            <IoRemove />
          </button>
        </div>
        <span className="parameter-unit">px</span>
      </div>
    </div>
  );
};

type SettingsSelectFieldProps = {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

type SettingsBooleanFieldProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

const SettingsBooleanField = ({ label, checked, onToggle }: SettingsBooleanFieldProps) => (
  <div className="parameter-row">
    <div className="boolean-parameter-row">
      <label className="parameter-label">{label}</label>
      <button
        type="button"
        className={`checkbox-wrapper ${checked ? 'checked' : ''}`}
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={label}
      >
        {checked ? <IoCheckbox /> : <IoSquareOutline />}
      </button>
    </div>
  </div>
);

const SettingsSelectField = ({ id, label, value, options, onChange }: SettingsSelectFieldProps) => (
  <div className="parameter-row">
    <label className="parameter-label" htmlFor={id}>
      {label}
    </label>
    <div className="parameter-input-container">
      <select
        id={id}
        className="parameter-select"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <IoChevronDown className="parameter-select-icon" aria-hidden />
    </div>
  </div>
);

const SettingsPane = React.memo(() => {
  const {
    appearance: { theme, showEdgeBadges },
    layout: { edgePathStyle, nodeSep, rankSep, showMinimap },
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  const handleThemeChange = useCallback(
    (value: string) => actions.appearance.setTheme(value as ThemeId),
    [actions.appearance]
  );

  const handleEdgePathStyleChange = useCallback(
    (value: string) => actions.layout.setEdgePathStyle(value as EdgePathStyle),
    [actions.layout]
  );

  const handleNodeSepChange = useCallback(
    (value: number) => actions.layout.setNodeSep(value),
    [actions.layout]
  );

  const handleRankSepChange = useCallback(
    (value: number) => actions.layout.setRankSep(value),
    [actions.layout]
  );

  return (
    <div className={`sidebar settings-pane ${isOpen ? 'open' : ''}`}>
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
        className={`parameter-group ${collapsedGroups[SETTINGS_APPEARANCE_GROUP] ? 'collapsed' : ''}`}
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
        <div className="group-content">
          <SettingsSelectField
            id="theme-select"
            label="Theme"
            value={theme}
            options={THEME_OPTIONS}
            onChange={handleThemeChange}
          />
          <SettingsBooleanField
            label="Edge badges"
            checked={showEdgeBadges}
            onToggle={actions.appearance.toggleEdgeBadges}
          />
        </div>
      </div>

      <div
        className={`parameter-group ${collapsedGroups[SETTINGS_LAYOUT_GROUP] ? 'collapsed' : ''}`}
      >
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(SETTINGS_LAYOUT_GROUP)}
        >
          <div className="group-header-content">
            <span>LAYOUT</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div className="group-content">
          <SettingsSelectField
            id="edge-path-style-select"
            label="Edge style"
            value={edgePathStyle}
            options={EDGE_PATH_OPTIONS}
            onChange={handleEdgePathStyleChange}
          />
          <SettingsNumberField
            id="node-sep-input"
            label="Vertical spacing"
            value={nodeSep}
            onChange={handleNodeSepChange}
          />
          <SettingsNumberField
            id="rank-sep-input"
            label="Horizontal spacing"
            value={rankSep}
            onChange={handleRankSepChange}
          />
          <SettingsBooleanField
            label="Minimap"
            checked={showMinimap}
            onToggle={actions.layout.toggleMinimap}
          />
        </div>
      </div>
    </div>
  );
});

SettingsPane.displayName = 'SettingsPane';

export default SettingsPane;
