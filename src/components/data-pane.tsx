import React, { useMemo, useRef, useState } from 'react';
import {
  IoChevronBackCircleOutline,
  IoChevronDown,
  IoStatsChartOutline,
  IoCloudUploadOutline,
  IoTrashOutline,
  IoCheckbox,
  IoSquareOutline,
  IoAdd,
  IoRemove,
  IoWarningOutline,
  IoConstructOutline,
  IoCreateOutline,
  IoScanOutline,
  IoFilmOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import '../styles/properties-panel.css';
import '../styles/data-pane.css';
import { useAppState } from '../context/AppStateContext';
import { useDataStore, selectItemCount } from '../store/dataStore';
import { useGraphStore } from '../store/graphStore';
import { selectIndicesReady } from '../store/graph-selectors';
import { COLORMAP_OPTIONS, colormapGradient } from '../utils/colormap';
import MathLabel from './MathLabel';
import { allValues, isFrameValues } from '../types/data';
import type { ColormapId, DataItem, DataTarget, Dataset, ValueNotation } from '../types/data';

const DATA_DATASETS_GROUP = '__data_datasets__';
const DATA_NODE_GROUP = '__data_node__';
const DATA_EDGE_GROUP = '__data_edge__';

/**
 * Renders a dataset-metadata value for display. The UI stays agnostic to what the
 * value means: booleans read as Yes/No, everything else prints as-is.
 */
const formatMetaValue = (value: number | string | boolean): string => {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  return String(value);
};

/** Compact min–max summary for the item overview list. */
const formatRange = (values: number[]): string => {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '—';
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toPrecision(4));
  return `${fmt(min)} … ${fmt(max)}`;
};

type CollapsibleGroupProps = {
  groupKey: string;
  title: string;
  collapsed: boolean;
  onToggle: (key: string) => void;
  children: React.ReactNode;
};

const CollapsibleGroup = ({
  groupKey,
  title,
  collapsed,
  onToggle,
  children,
}: CollapsibleGroupProps) => (
  <div className={`parameter-group ${collapsed ? 'collapsed' : ''}`}>
    <div className="group-header" onClick={() => onToggle(groupKey)}>
      <div className="group-header-content">
        <span>{title}</span>
        <IoChevronDown className="group-collapse-icon" />
      </div>
    </div>
    <div className="group-content">{children}</div>
  </div>
);

type BooleanFieldProps = {
  label: string;
  checked: boolean;
  onToggle: () => void;
};

const BooleanField = ({ label, checked, onToggle }: BooleanFieldProps) => (
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

/** A flat option for the per-target variable selector: an item plus its dataset. */
type ItemOption = { item: DataItem; datasetName: string };

/** Per-target (node/edge) display controls: variable, colormap, and range. */
const TargetDisplayControls = ({ target }: { target: DataTarget }) => {
  const datasets = useDataStore((s) => s.datasets);
  const display = useDataStore((s) => (target === 'node' ? s.nodeDisplay : s.edgeDisplay));
  const setDisplayItem = useDataStore((s) => s.setDisplayItem);
  const setColormap = useDataStore((s) => s.setColormap);
  const setRange = useDataStore((s) => s.setRange);
  const setAutoRange = useDataStore((s) => s.setAutoRange);
  const requestScaleToVisible = useDataStore((s) => s.requestScaleToVisible);
  const toggleContour = useDataStore((s) => s.toggleContour);
  const toggleShowValues = useDataStore((s) => s.toggleShowValues);
  const setPrecision = useDataStore((s) => s.setPrecision);
  const setNotation = useDataStore((s) => s.setNotation);

  // Free selection: any item from any dataset matching this target.
  const options = useMemo<ItemOption[]>(() => {
    const list: ItemOption[] = [];
    for (const dataset of datasets) {
      for (const item of dataset.items) {
        if (item.target === target) list.push({ item, datasetName: dataset.name });
      }
    }
    return list;
  }, [datasets, target]);
  const gradient = useMemo(() => colormapGradient(display.colormap), [display.colormap]);

  const handleMinChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(event.target.value);
    if (!Number.isNaN(parsed)) setRange(target, parsed, display.max);
  };
  const handleMaxChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseFloat(event.target.value);
    if (!Number.isNaN(parsed)) setRange(target, display.min, parsed);
  };

  const idPrefix = `data-${target}`;

  return (
    <>
      <div className="parameter-row">
        <label className="parameter-label" htmlFor={`${idPrefix}-item`}>
          Variable
        </label>
        <div className="parameter-input-container">
          <select
            id={`${idPrefix}-item`}
            className="parameter-select"
            value={display.itemId ?? ''}
            onChange={(e) => setDisplayItem(target, e.target.value || null)}
          >
            <option value="">None</option>
            {options.map(({ item, datasetName }) => (
              <option key={item.id} value={item.id}>
                {datasetName} / {item.name}
              </option>
            ))}
          </select>
          <IoChevronDown className="parameter-select-icon" aria-hidden />
        </div>
        {options.length === 0 && <p className="data-pane-hint">No {target} items loaded.</p>}
      </div>

      <div className="parameter-row">
        <label className="parameter-label" htmlFor={`${idPrefix}-colormap`}>
          Colormap
        </label>
        <div className="parameter-input-container">
          <select
            id={`${idPrefix}-colormap`}
            className="parameter-select"
            value={display.colormap}
            onChange={(e) => setColormap(target, e.target.value as ColormapId)}
          >
            {COLORMAP_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <IoChevronDown className="parameter-select-icon" aria-hidden />
        </div>
        <div className="data-pane-colormap-swatch" style={{ background: gradient }} />
      </div>

      <BooleanField
        label="Show contour"
        checked={display.showContour}
        onToggle={() => toggleContour(target)}
      />

      <BooleanField
        label="Auto range"
        checked={display.auto}
        onToggle={() => setAutoRange(target, !display.auto)}
      />

      <div className="data-pane-range-row">
        <div className="parameter-row">
          <label className="parameter-label" htmlFor={`${idPrefix}-min`}>
            Min
          </label>
          <div className="parameter-input-container">
            <input
              id={`${idPrefix}-min`}
              type="number"
              className="parameter-input data-pane-range-input"
              value={display.min}
              disabled={display.auto}
              onChange={handleMinChange}
            />
          </div>
        </div>
        <div className="parameter-row">
          <label className="parameter-label" htmlFor={`${idPrefix}-max`}>
            Max
          </label>
          <div className="parameter-input-container">
            <input
              id={`${idPrefix}-max`}
              type="number"
              className="parameter-input data-pane-range-input"
              value={display.max}
              disabled={display.auto}
              onChange={handleMaxChange}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        className="document-pane-file-button data-pane-scale-visible"
        onClick={() => requestScaleToVisible(target)}
        disabled={!display.itemId}
        title="Set the colormap range to the min/max of the elements currently in view"
      >
        <IoScanOutline className="document-pane-file-button-icon" />
        <span>Scale to visible</span>
      </button>

      <BooleanField
        label="Show values"
        checked={display.showValues}
        onToggle={() => toggleShowValues(target)}
      />

      <div className="parameter-row">
        <label className="parameter-label" htmlFor={`${idPrefix}-notation`}>
          Notation
        </label>
        <div className="parameter-input-container">
          <select
            id={`${idPrefix}-notation`}
            className="parameter-select"
            value={display.notation}
            disabled={!display.showValues}
            onChange={(e) => setNotation(target, e.target.value as ValueNotation)}
          >
            <option value="fixed">Float</option>
            <option value="scientific">Scientific</option>
          </select>
          <IoChevronDown className="parameter-select-icon" aria-hidden />
        </div>
      </div>

      <div className="parameter-row">
        <label className="parameter-label" htmlFor={`${idPrefix}-precision`}>
          Decimals
        </label>
        <div className="parameter-input-container">
          <input
            id={`${idPrefix}-precision`}
            type="number"
            className="parameter-input"
            value={display.precision}
            min={0}
            max={6}
            step={1}
            disabled={!display.showValues}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              if (!Number.isNaN(parsed)) setPrecision(target, parsed);
            }}
          />
          <div className="number-controls">
            <button
              type="button"
              className="number-control-btn"
              onClick={() => setPrecision(target, display.precision + 1)}
              aria-label="Increase"
            >
              <IoAdd />
            </button>
            <button
              type="button"
              className="number-control-btn"
              onClick={() => setPrecision(target, display.precision - 1)}
              aria-label="Decrease"
            >
              <IoRemove />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/** A single item row. Clicking the name assigns it to its target's display. */
const DataItemRow = ({ item }: { item: DataItem }) => {
  const setDisplayItem = useDataStore((s) => s.setDisplayItem);
  const isActive = useDataStore((s) =>
    item.target === 'node' ? s.nodeDisplay.itemId === item.id : s.edgeDisplay.itemId === item.id
  );
  const perFrame = isFrameValues(item.values);
  const length = perFrame ? (item.values as number[][])[0].length : item.values.length;

  // Clicking an already-active item clears it; otherwise selects it.
  const onSelect = () => setDisplayItem(item.target, isActive ? null : item.id);

  return (
    <li className={`data-pane-item ${isActive ? 'active' : ''}`}>
      <button
        type="button"
        className="data-pane-item-main"
        onClick={onSelect}
        title={isActive ? `Hide ${item.name}` : `Display ${item.name}`}
        aria-pressed={isActive}
      >
        <span className="data-pane-item-name">{item.name}</span>
        <span className={`data-pane-tag data-pane-tag-${item.target}`}>{item.target}</span>
      </button>
      <div className="data-pane-item-meta">
        <span>
          {length} values
          {perFrame ? ` × ${item.values.length} frames` : ''}
        </span>
        <span>
          {formatRange(allValues(item.values))}
          {item.unit ? ` ${item.unit}` : ''}
        </span>
      </div>
    </li>
  );
};

/**
 * A dataset group: a collapsible header (chevron) naming the file plus its
 * scrollable list of items. The name is renamable inline via the edit button.
 */
const DatasetGroup = ({ dataset }: { dataset: Dataset }) => {
  const removeDataset = useDataStore((s) => s.removeDataset);
  const renameDataset = useDataStore((s) => s.renameDataset);
  const {
    sidebar: { collapsedGroups },
    actions,
  } = useAppState();
  const collapsed = !!collapsedGroups[dataset.id];

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(dataset.name);

  const startRename = () => {
    setDraftName(dataset.name);
    setEditing(true);
  };
  const commitRename = () => {
    renameDataset(dataset.id, draftName);
    setEditing(false);
  };
  const cancelRename = () => setEditing(false);

  const frames = dataset.frames;
  const animated = Boolean(frames && frames.values.length > 0);

  return (
    <div
      className={`data-pane-dataset ${collapsed ? 'collapsed' : ''} ${
        animated ? 'data-pane-dataset-animated' : ''
      }`}
    >
      <div className="data-pane-dataset-header">
        <button
          type="button"
          className="data-pane-dataset-toggle"
          onClick={() => actions.sidebar.toggleGroup(dataset.id)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${dataset.name}` : `Collapse ${dataset.name}`}
        >
          <IoChevronDown className="data-pane-dataset-chevron" />
        </button>
        {animated && (
          <IoFilmOutline
            className="data-pane-dataset-animated-badge"
            title="Animated dataset"
            aria-label="Animated dataset"
          />
        )}
        {editing ? (
          <input
            className="data-pane-dataset-rename"
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') cancelRename();
            }}
          />
        ) : (
          <button
            type="button"
            className="data-pane-dataset-name"
            title={dataset.name}
            onClick={() => actions.sidebar.toggleGroup(dataset.id)}
            onDoubleClick={startRename}
          >
            {dataset.name}
          </button>
        )}
        <span className="data-pane-dataset-itemcount">
          {dataset.items.length} item{dataset.items.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className="data-pane-dataset-action"
          onClick={startRename}
          title="Rename dataset"
          aria-label={`Rename ${dataset.name}`}
        >
          <IoCreateOutline />
        </button>
        <button
          type="button"
          className="data-pane-dataset-action data-pane-dataset-remove"
          onClick={() => removeDataset(dataset.id)}
          title="Remove dataset"
          aria-label={`Remove ${dataset.name}`}
        >
          <IoTrashOutline />
        </button>
      </div>
      {!collapsed && animated && frames && (
        <div className="data-pane-frames-summary">
          <div className="data-pane-meta-row">
            <span className="data-pane-meta-label">Frames</span>
            <span className="data-pane-meta-value">{frames.values.length}</span>
          </div>
          <div className="data-pane-meta-row">
            <span className="data-pane-meta-label">Frame variable</span>
            <span className="data-pane-meta-value">
              <MathLabel text={frames.variable} />
            </span>
          </div>
          <div className="data-pane-meta-row">
            <span className="data-pane-meta-label">Range</span>
            <span className="data-pane-meta-value">
              {formatRange(frames.values)}
              {frames.unit ? ` ${frames.unit}` : ''}
            </span>
          </div>
        </div>
      )}
      {!collapsed && (dataset.description || (dataset.info && dataset.info.length > 0)) && (
        <div className="data-pane-dataset-meta">
          {dataset.description && (
            <p className="data-pane-dataset-description">
              <MathLabel text={dataset.description} />
            </p>
          )}
          {dataset.info?.map((entry) => (
            <div key={entry.key} className="data-pane-meta-row">
              <span className="data-pane-meta-label" title={entry.description || undefined}>
                <MathLabel text={entry.label} />
              </span>
              <span className="data-pane-meta-value">
                {formatMetaValue(entry.value)}
                {entry.unit ? ` ${entry.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}
      {!collapsed && (
        <ul className="data-pane-item-list">
          {dataset.items.map((item) => (
            <DataItemRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
};

const DataPane = React.memo(() => {
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();
  const datasets = useDataStore((s) => s.datasets);
  const itemCount = useDataStore(selectItemCount);
  const loadDatasetsFromFile = useDataStore((s) => s.loadDatasetsFromFile);
  const clearDatasets = useDataStore((s) => s.clearDatasets);
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const edgeCount = useGraphStore((s) => s.edges.length);
  const indicesReady = useGraphStore(selectIndicesReady);
  const regenerateIndices = useGraphStore((s) => s.regenerateIndices);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Reject datasets whose lengths don't match the current canvas.
      loadDatasetsFromFile(file, { nodeCount, edgeCount });
      event.target.value = '';
    }
  };

  return (
    <div className={`sidebar data-pane ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="panel-icon-wrapper">
          <IoStatsChartOutline className="panel-icon" />
          <span className="panel-title">DATA</span>
        </div>
        <IoChevronBackCircleOutline
          className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
          onClick={() => actions.sidebar.toggle()}
        />
      </div>

      <CollapsibleGroup
        groupKey={DATA_DATASETS_GROUP}
        title="DATASETS"
        collapsed={!!collapsedGroups[DATA_DATASETS_GROUP]}
        onToggle={actions.sidebar.toggleGroup}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".json"
          className="file-input-hidden"
        />
        <button
          type="button"
          className="document-pane-file-button"
          onClick={() => fileInputRef.current?.click()}
        >
          <IoCloudUploadOutline className="document-pane-file-button-icon" />
          <span>Load dataset…</span>
        </button>

        {datasets.length === 0 ? (
          <p className="data-pane-hint data-pane-hint-block">
            Load a JSON dataset file. A dataset is a named group of items; each item is a list of
            numbers ordered by element index. You can load several datasets and display any item.
          </p>
        ) : (
          <>
            {!indicesReady && (
              <div className="data-pane-index-notice">
                <div className="data-pane-index-notice-text">
                  <IoWarningOutline className="data-pane-index-notice-icon" />
                  <span>
                    Some elements are unnumbered — the canvas and data may not be compatible.
                  </span>
                </div>
                <button
                  type="button"
                  className="document-pane-file-button"
                  onClick={regenerateIndices}
                  title="Assign sequential indices to nodes and edges"
                >
                  <IoConstructOutline className="document-pane-file-button-icon" />
                  <span>Renumber</span>
                </button>
              </div>
            )}

            <div className="data-pane-dataset-toolbar">
              <span className="data-pane-dataset-count">
                {itemCount} item{itemCount === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                className="data-pane-clear-button"
                onClick={clearDatasets}
                title="Remove all datasets"
              >
                Clear all
              </button>
            </div>
            <p className="data-pane-graph-counts">
              Graph: {nodeCount} node{nodeCount === 1 ? '' : 's'} · {edgeCount} edge
              {edgeCount === 1 ? '' : 's'}
            </p>
            <div className="data-pane-dataset-list">
              {datasets.map((dataset) => (
                <DatasetGroup key={dataset.id} dataset={dataset} />
              ))}
            </div>
          </>
        )}
      </CollapsibleGroup>

      <CollapsibleGroup
        groupKey={DATA_NODE_GROUP}
        title="NODE DATA"
        collapsed={!!collapsedGroups[DATA_NODE_GROUP]}
        onToggle={actions.sidebar.toggleGroup}
      >
        <TargetDisplayControls target="node" />
      </CollapsibleGroup>

      <CollapsibleGroup
        groupKey={DATA_EDGE_GROUP}
        title="EDGE DATA"
        collapsed={!!collapsedGroups[DATA_EDGE_GROUP]}
        onToggle={actions.sidebar.toggleGroup}
      >
        <TargetDisplayControls target="edge" />
      </CollapsibleGroup>
    </div>
  );
});

DataPane.displayName = 'DataPane';

export default DataPane;
