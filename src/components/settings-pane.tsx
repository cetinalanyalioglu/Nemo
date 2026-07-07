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
import type { LayoutDirection, LayoutEngine } from '../utils/layoutUtils';

const SETTINGS_APPEARANCE_GROUP = '__settings_appearance__';
const SETTINGS_LAYOUT_GROUP = '__settings_layout__';
const SETTINGS_ROTATION_GROUP = '__settings_rotation__';

const ROTATION_INCREMENT_MIN = 1;
const ROTATION_INCREMENT_MAX = 90;
const ROTATION_INCREMENT_STEP = 5;

const EDGE_PATH_OPTIONS: { value: EdgePathStyle; label: string }[] = [
  { value: 'bezier', label: 'Bezier' },
  { value: 'simplebezier', label: 'Simple Bezier' },
  { value: 'smoothstep', label: 'Smooth Step' },
  { value: 'straight', label: 'Straight' },
];

const LAYOUT_ENGINE_OPTIONS: { value: LayoutEngine; label: string }[] = [
  { value: 'elk', label: 'ELK (port-aware)' },
  { value: 'dagre', label: 'Dagre' },
];

const LAYOUT_DIRECTION_OPTIONS: { value: LayoutDirection; label: string }[] = [
  { value: 'RIGHT', label: 'Left to right' },
  { value: 'DOWN', label: 'Top to bottom' },
  { value: 'LEFT', label: 'Right to left' },
  { value: 'UP', label: 'Bottom to top' },
];

const LAYOUT_SEP_MIN = 20;
const LAYOUT_SEP_MAX = 400;
const LAYOUT_SEP_STEP = 10;

type SettingsNumberFieldProps = {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
};

const SettingsNumberField = ({
  id,
  label,
  value,
  onChange,
  min = LAYOUT_SEP_MIN,
  max = LAYOUT_SEP_MAX,
  step = LAYOUT_SEP_STEP,
  unit = 'px',
}: SettingsNumberFieldProps) => {
  const clamp = (candidate: number) => Math.min(max, Math.max(min, candidate));

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseInt(event.target.value, 10);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  const increment = () => onChange(clamp(value + step));
  const decrement = () => onChange(clamp(value - step));

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
          min={min}
          max={max}
          step={step}
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
        <span className="parameter-unit">{unit}</span>
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
    appearance: { theme, showEdgeBadges, showPortNumbers },
    layout: { edgePathStyle, layoutEngine, layoutDirection, nodeSep, rankSep, showMinimap },
    rotation: { snap: rotationSnap, increment: rotationIncrement },
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

  const handleLayoutEngineChange = useCallback(
    (value: string) => actions.layout.setLayoutEngine(value as LayoutEngine),
    [actions.layout]
  );

  const handleLayoutDirectionChange = useCallback(
    (value: string) => actions.layout.setLayoutDirection(value as LayoutDirection),
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

  const handleRotationIncrementChange = useCallback(
    (value: number) => actions.rotation.updateIncrement(value),
    [actions.rotation]
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
          <SettingsBooleanField
            label="Port numbers"
            checked={showPortNumbers}
            onToggle={actions.appearance.togglePortNumbers}
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
          <SettingsSelectField
            id="layout-engine-select"
            label="Layout engine"
            value={layoutEngine}
            options={LAYOUT_ENGINE_OPTIONS}
            onChange={handleLayoutEngineChange}
          />
          <SettingsSelectField
            id="layout-direction-select"
            label="Flow direction"
            value={layoutDirection}
            options={LAYOUT_DIRECTION_OPTIONS}
            onChange={handleLayoutDirectionChange}
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

      <div
        className={`parameter-group ${collapsedGroups[SETTINGS_ROTATION_GROUP] ? 'collapsed' : ''}`}
      >
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(SETTINGS_ROTATION_GROUP)}
        >
          <div className="group-header-content">
            <span>ROTATION</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div className="group-content">
          <SettingsBooleanField
            label="Angle snapping"
            checked={rotationSnap}
            onToggle={actions.rotation.toggleSnap}
          />
          {rotationSnap && (
            <SettingsNumberField
              id="rotation-increment-input"
              label="Snap increment"
              value={rotationIncrement}
              onChange={handleRotationIncrementChange}
              min={ROTATION_INCREMENT_MIN}
              max={ROTATION_INCREMENT_MAX}
              step={ROTATION_INCREMENT_STEP}
              unit="°"
            />
          )}
        </div>
      </div>
    </div>
  );
});

SettingsPane.displayName = 'SettingsPane';

export default SettingsPane;
