import { memo } from 'react';
import { Panel } from 'reactflow';
import '../styles/data-legend.css';
import { useDataStore, selectActiveItem, selectActiveDataset } from '../store/dataStore';
import { colormapGradient } from '../utils/colormap';
import type { DataDisplayConfig, DataItem, DataTarget, Dataset } from '../types/data';

/** Formats a range bound compactly for the legend ticks. */
const formatTick = (value: number): string => {
  if (!Number.isFinite(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return value.toPrecision(3);
};

type LegendItemProps = {
  target: DataTarget;
  dataset: Dataset;
  item: DataItem;
  display: DataDisplayConfig;
};

const LegendItem = ({ target, dataset, item, display }: LegendItemProps) => {
  const mid = (display.min + display.max) / 2;
  const label = `${dataset.name} / ${item.name}`;
  return (
    <div className="data-legend-item">
      <div className="data-legend-title">
        <span className={`data-legend-tag data-legend-tag-${target}`}>{target}</span>
        <span className="data-legend-name" title={label}>
          {label}
          {item.unit ? ` (${item.unit})` : ''}
        </span>
      </div>
      <div className="data-legend-bar" style={{ background: colormapGradient(display.colormap) }} />
      <div className="data-legend-ticks">
        <span>{formatTick(display.min)}</span>
        <span>{formatTick(mid)}</span>
        <span>{formatTick(display.max)}</span>
      </div>
    </div>
  );
};

/**
 * Canvas overlay showing a compact legend for each active data display (node
 * and/or edge): colormap gradient with min/mid/max ticks. Rendered inside
 * ReactFlow via a top-right Panel so it stays clear of the bottom-right minimap.
 */
const DataLegend = memo(() => {
  const nodeDisplay = useDataStore((s) => s.nodeDisplay);
  const edgeDisplay = useDataStore((s) => s.edgeDisplay);
  // Select the item and its dataset separately: each returns a stored object
  // (stable reference) so zustand doesn't see a new snapshot every render.
  const nodeItem = useDataStore((s) => selectActiveItem(s, 'node'));
  const nodeDataset = useDataStore((s) => selectActiveDataset(s, 'node'));
  const edgeItem = useDataStore((s) => selectActiveItem(s, 'edge'));
  const edgeDataset = useDataStore((s) => selectActiveDataset(s, 'edge'));

  // The legend explains the colormap contour, so each target appears only when
  // its own contour is enabled and an item is selected.
  const showNode = nodeDisplay.showContour && !!nodeItem && !!nodeDataset;
  const showEdge = edgeDisplay.showContour && !!edgeItem && !!edgeDataset;
  if (!showNode && !showEdge) return null;

  return (
    <Panel position="top-right" className="data-legend">
      {showNode && (
        <LegendItem target="node" dataset={nodeDataset!} item={nodeItem!} display={nodeDisplay} />
      )}
      {showEdge && (
        <LegendItem target="edge" dataset={edgeDataset!} item={edgeItem!} display={edgeDisplay} />
      )}
    </Panel>
  );
});

DataLegend.displayName = 'DataLegend';

export default DataLegend;
