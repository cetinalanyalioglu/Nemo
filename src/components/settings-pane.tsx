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
import SidebarShell from './sidebar-shell';
import '../styles/properties-panel.css';
import { useAppState } from '../context/AppStateContext';
import { useConsoleStore } from '../store/consoleStore';
import { useGraphStore } from '../store/graphStore';
import { selectIndicesReady } from '../store/graph-selectors';
import { CONSOLE_VERBOSITY_OPTIONS, type ConsoleVerbosity } from '../types/console';
import { THEME_OPTIONS } from '../types/theme';
import type { ThemeId } from '../types/theme';
import type { EdgePathStyle } from '../context/AppStateContext';
import type { LayoutDirection, LayoutEngine } from '../utils/layoutUtils';

const SETTINGS_APPEARANCE_GROUP = '__settings_appearance__';
const SETTINGS_MESSAGES_GROUP = '__settings_messages__';
const SETTINGS_LAYOUT_GROUP = '__settings_layout__';
const SETTINGS_ROTATION_GROUP = '__settings_rotation__';
const SETTINGS_EXPORT_GROUP = '__settings_export__';
const SETTINGS_SAVE_GROUP = '__settings_save__';

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

const LAYOUT_SEP_MIN = 10;
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
  /** Greys the checkbox and blocks the toggle; pair with `title` to say why. */
  disabled?: boolean;
  title?: string;
};

const SettingsBooleanField = ({
  label,
  checked,
  onToggle,
  disabled = false,
  title,
}: SettingsBooleanFieldProps) => (
  <div className="parameter-row">
    <div className="boolean-parameter-row">
      <label className="parameter-label">{label}</label>
      <button
        type="button"
        className={`checkbox-wrapper ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={disabled ? undefined : onToggle}
        disabled={disabled}
        aria-pressed={checked}
        aria-label={label}
        title={title}
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
    appearance: { theme, showEdgeBadges, showPortNumbers, showElementNames, showIndices },
    layout: { edgePathStyle, layoutEngine, layoutDirection, nodeSep, rankSep, showMinimap },
    rotation: { snap: rotationSnap, increment: rotationIncrement },
    export: { monochrome },
    save,
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  // Indices only exist once the user has run Renumber (Tools > Connectivity),
  // so the toggle stays inert until then rather than switching on nothing.
  const indicesReady = useGraphStore(selectIndicesReady);

  const verbosity = useConsoleStore((s) => s.verbosity);
  const setVerbosity = useConsoleStore((s) => s.setVerbosity);

  const handleVerbosityChange = useCallback(
    (value: string) => setVerbosity(value as ConsoleVerbosity),
    [setVerbosity]
  );

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
    <SidebarShell className="settings-pane">
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
            label="Element names"
            checked={showElementNames}
            onToggle={actions.appearance.toggleElementNames}
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
          <SettingsBooleanField
            label="Indices"
            checked={showIndices}
            onToggle={actions.appearance.toggleShowIndices}
            disabled={!indicesReady}
            title={
              indicesReady
                ? 'Display indices on nodes and edges'
                : 'Run Renumber (Tools) first to assign indices'
            }
          />
        </div>
      </div>

      <div
        className={`parameter-group ${collapsedGroups[SETTINGS_MESSAGES_GROUP] ? 'collapsed' : ''}`}
      >
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(SETTINGS_MESSAGES_GROUP)}
        >
          <div className="group-header-content">
            <span>MESSAGES</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div className="group-content">
          <SettingsSelectField
            id="console-verbosity-select"
            label="Detail"
            value={verbosity}
            options={CONSOLE_VERBOSITY_OPTIONS}
            onChange={handleVerbosityChange}
          />
          <p className="settings-note">
            How much the message log records. It applies to messages from here on; what is already
            listed stays, and everything reaches the browser&rsquo;s own console regardless.
          </p>
        </div>
      </div>

      <div
        className={`parameter-group ${collapsedGroups[SETTINGS_EXPORT_GROUP] ? 'collapsed' : ''}`}
      >
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(SETTINGS_EXPORT_GROUP)}
        >
          <div className="group-header-content">
            <span>EXPORT</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div className="group-content">
          <SettingsBooleanField
            label="Black & white"
            checked={monochrome}
            onToggle={actions.export.toggleMonochrome}
            title="Export SVG/PNG/PDF as true black-and-white line art instead of the theme colours"
          />
        </div>
      </div>

      <div className={`parameter-group ${collapsedGroups[SETTINGS_SAVE_GROUP] ? 'collapsed' : ''}`}>
        <div
          className="group-header"
          onClick={() => actions.sidebar.toggleGroup(SETTINGS_SAVE_GROUP)}
        >
          <div className="group-header-content">
            <span>SAVE</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div className="group-content">
          <SettingsBooleanField
            label="Result sets"
            checked={save.results}
            onToggle={() => actions.save.toggle('results')}
            title="Carry the loaded result sets in the case, so a reopened one is coloured without solving again. Which of them is still each set's own switch, in the Data pane."
          />
          <SettingsBooleanField
            label="Figure descriptions"
            checked={save.figures}
            onToggle={() => actions.save.toggle('figures')}
            title="Carry what each pinned figure was drawn from, so it can be drawn again after reopening — for a theme change, and for an export. Without it the picture still travels, fixed in the colours it was pinned in."
          />
          <SettingsBooleanField
            label="Notebook"
            checked={save.notebook}
            onToggle={() => actions.save.toggle('notebook')}
            title="Carry the Results tab's cells. Their source only; outputs belong in a .ipynb export."
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
    </SidebarShell>
  );
});

SettingsPane.displayName = 'SettingsPane';

export default SettingsPane;
