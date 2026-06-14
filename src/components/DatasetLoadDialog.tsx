import { useEffect, useState } from 'react';
import { IoCheckbox, IoSquareOutline } from 'react-icons/io5';
import { useDataStore } from '../store/dataStore';
import '../styles/dataset-load-dialog.css';

/**
 * Modal shown after loading a case file that embeds datasets. Lets the user
 * choose which embedded datasets to import (with select/deselect all), mirroring
 * the "Include data on save" tick-list. Renders nothing when no choice is
 * pending.
 */
const DatasetLoadDialog = () => {
  const pending = useDataStore((s) => s.pendingDatasets);
  const resolveDatasetChoice = useDataStore((s) => s.resolveDatasetChoice);
  const cancelDatasetChoice = useDataStore((s) => s.cancelDatasetChoice);

  const [selected, setSelected] = useState<boolean[]>([]);

  // Reset the selection (default: all checked) whenever a new choice appears.
  useEffect(() => {
    if (pending) setSelected(pending.map(() => true));
  }, [pending]);

  if (!pending) return null;

  const allChecked = selected.length > 0 && selected.every(Boolean);
  const checkedCount = selected.filter(Boolean).length;

  const toggle = (index: number) =>
    setSelected((prev) => prev.map((v, i) => (i === index ? !v : v)));
  const toggleAll = () => setSelected(pending.map(() => !allChecked));

  const onImport = () => {
    const chosen = pending.filter((_, i) => selected[i]);
    resolveDatasetChoice(chosen);
  };

  return (
    <div className="dataset-load-overlay" role="dialog" aria-modal="true">
      <div className="dataset-load-dialog">
        <div className="dataset-load-header">
          <h2 className="dataset-load-title">Load data with case</h2>
          <p className="dataset-load-subtitle">
            This file includes {pending.length} dataset{pending.length === 1 ? '' : 's'}. Choose
            which to import.
          </p>
        </div>

        <div className="dataset-load-actions-row">
          <button type="button" className="dataset-load-toggle-all" onClick={toggleAll}>
            {allChecked ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        <ul className="dataset-load-list">
          {pending.map((dataset, index) => (
            <li key={`${dataset.id}-${index}`} className="dataset-load-row">
              <button
                type="button"
                className={`dataset-load-check ${selected[index] ? 'checked' : ''}`}
                onClick={() => toggle(index)}
                aria-pressed={!!selected[index]}
                aria-label={`${selected[index] ? 'Exclude' : 'Include'} ${dataset.name}`}
              >
                {selected[index] ? <IoCheckbox /> : <IoSquareOutline />}
              </button>
              <span className="dataset-load-name" title={dataset.name}>
                {dataset.name}
              </span>
              <span className="dataset-load-count">
                {dataset.items.length} item{dataset.items.length === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>

        <div className="dataset-load-buttons">
          <button type="button" className="dataset-load-button" onClick={cancelDatasetChoice}>
            Skip
          </button>
          <button
            type="button"
            className="dataset-load-button dataset-load-button-primary"
            onClick={onImport}
          >
            {checkedCount > 0 ? `Import ${checkedCount}` : 'Import none'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DatasetLoadDialog;
