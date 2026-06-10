import React, { useMemo, useRef } from 'react';
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
  IoCheckmarkCircle,
  IoWarningOutline,
  IoConstructOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import '../styles/properties-panel.css';
import '../styles/data-pane.css';
import { useAppState } from '../context/AppStateContext';
import { useDataStore } from '../store/dataStore';
import { useGraphStore } from '../store/graphStore';
import { selectIndicesReady } from '../store/graph-selectors';
import { COLORMAP_OPTIONS, colormapGradient } from '../utils/colormap';
import type { ColormapId, DataTarget, Dataset } from '../types/data';

const DATA_DATASETS_GROUP = '__data_datasets__';
const DATA_NODE_GROUP = '__data_node__';
const DATA_EDGE_GROUP = '__data_edge__';
const DATA_DISPLAY_GROUP = '__data_display__';

/** Compact min–max summary for the dataset overview list. */
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

/** Per-target (node/edge) display controls: dataset, colormap, and range. */
const TargetDisplayControls = ({ target }: { target: DataTarget }) => {
  const datasets = useDataStore((s) => s.datasets);
  const display = useDataStore((s) => (target === 'node' ? s.nodeDisplay : s.edgeDisplay));
  const setDisplayDataset = useDataStore((s) => s.setDisplayDataset);
  const setColormap = useDataStore((s) => s.setColormap);
  const setRange = useDataStore((s) => s.setRange);
  const setAutoRange = useDataStore((s) => s.setAutoRange);

  const options = useMemo(() => datasets.filter((d) => d.target === target), [datasets, target]);
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
        <label className="parameter-label" htmlFor={`${idPrefix}-dataset`}>
          Dataset
        </label>
        <div className="parameter-input-container">
          <select
            id={`${idPrefix}-dataset`}
            className="parameter-select"
            value={display.datasetId ?? ''}
            onChange={(e) => setDisplayDataset(target, e.target.value || null)}
          >
            <option value="">None</option>
            {options.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <IoChevronDown className="parameter-select-icon" aria-hidden />
        </div>
        {options.length === 0 && <p className="data-pane-hint">No {target} datasets loaded.</p>}
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
    </>
  );
};

const DatasetRow = ({ dataset, expectedCount }: { dataset: Dataset; expectedCount: number }) => {
  const removeDataset = useDataStore((s) => s.removeDataset);
  const noun = dataset.target === 'node' ? 'nodes' : 'edges';
  const length = dataset.values.length;
  const matches = length === expectedCount;
  return (
    <li className="data-pane-dataset">
      <div className="data-pane-dataset-main">
        <span className="data-pane-dataset-name" title={dataset.name}>
          {dataset.name}
        </span>
        <span className={`data-pane-tag data-pane-tag-${dataset.target}`}>{dataset.target}</span>
      </div>
      <div className="data-pane-dataset-meta">
        <span>{length} values</span>
        <span>
          {formatRange(dataset.values)}
          {dataset.unit ? ` ${dataset.unit}` : ''}
        </span>
      </div>
      {expectedCount > 0 &&
        (matches ? (
          <div className="data-pane-match ok">
            <IoCheckmarkCircle />
            <span>
              matches {expectedCount} {noun}
            </span>
          </div>
        ) : (
          <div
            className="data-pane-match warn"
            title={`${length} values, graph has ${expectedCount} ${noun}`}
          >
            <IoWarningOutline />
            <span>
              graph has {expectedCount} {noun}
            </span>
          </div>
        ))}
      <button
        type="button"
        className="data-pane-dataset-remove"
        onClick={() => removeDataset(dataset.id)}
        title="Remove dataset"
        aria-label={`Remove ${dataset.name}`}
      >
        <IoTrashOutline />
      </button>
    </li>
  );
};

const DataPane = React.memo(() => {
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();
  const datasets = useDataStore((s) => s.datasets);
  const loadDatasetsFromFile = useDataStore((s) => s.loadDatasetsFromFile);
  const clearDatasets = useDataStore((s) => s.clearDatasets);
  const showContour = useDataStore((s) => s.showContour);
  const toggleContour = useDataStore((s) => s.toggleContour);
  const showValueLabels = useDataStore((s) => s.showValueLabels);
  const toggleValueLabels = useDataStore((s) => s.toggleValueLabels);
  const valueLabelPrecision = useDataStore((s) => s.valueLabelPrecision);
  const setValueLabelPrecision = useDataStore((s) => s.setValueLabelPrecision);
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const edgeCount = useGraphStore((s) => s.edges.length);
  const indicesReady = useGraphStore(selectIndicesReady);
  const regenerateIndices = useGraphStore((s) => s.regenerateIndices);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      loadDatasetsFromFile(file);
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
          <span>Load data…</span>
        </button>

        {datasets.length === 0 ? (
          <p className="data-pane-hint data-pane-hint-block">
            Load a JSON file of datasets. Each dataset is a list of numbers ordered by element
            index.
          </p>
        ) : (
          <>
            {!indicesReady && (
              <div className="data-pane-index-notice">
                <div className="data-pane-index-notice-text">
                  <IoWarningOutline className="data-pane-index-notice-icon" />
                  <span>
                    Indices aren’t assigned, so element data won’t appear yet. Values map to
                    nodes/edges by their generated index.
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
                {datasets.length} dataset{datasets.length === 1 ? '' : 's'}
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
            <ul className="data-pane-dataset-list">
              {datasets.map((dataset) => (
                <DatasetRow
                  key={dataset.id}
                  dataset={dataset}
                  expectedCount={dataset.target === 'node' ? nodeCount : edgeCount}
                />
              ))}
            </ul>
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

      <CollapsibleGroup
        groupKey={DATA_DISPLAY_GROUP}
        title="DISPLAY"
        collapsed={!!collapsedGroups[DATA_DISPLAY_GROUP]}
        onToggle={actions.sidebar.toggleGroup}
      >
        <BooleanField label="Show contour" checked={showContour} onToggle={toggleContour} />
        <BooleanField label="Show values" checked={showValueLabels} onToggle={toggleValueLabels} />
        <div className="parameter-row">
          <label className="parameter-label" htmlFor="data-precision">
            Decimals
          </label>
          <div className="parameter-input-container">
            <input
              id="data-precision"
              type="number"
              className="parameter-input"
              value={valueLabelPrecision}
              min={0}
              max={6}
              step={1}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                if (!Number.isNaN(parsed)) setValueLabelPrecision(parsed);
              }}
            />
            <div className="number-controls">
              <button
                type="button"
                className="number-control-btn"
                onClick={() => setValueLabelPrecision(valueLabelPrecision + 1)}
                aria-label="Increase"
              >
                <IoAdd />
              </button>
              <button
                type="button"
                className="number-control-btn"
                onClick={() => setValueLabelPrecision(valueLabelPrecision - 1)}
                aria-label="Decrease"
              >
                <IoRemove />
              </button>
            </div>
          </div>
        </div>
      </CollapsibleGroup>
    </div>
  );
});

DataPane.displayName = 'DataPane';

export default DataPane;
