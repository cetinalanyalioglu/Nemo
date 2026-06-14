import { useMemo } from 'react';
import { create } from 'zustand';
import { colorForValue } from '../utils/colormap';
import type {
  ColormapId,
  DataDisplayConfig,
  DataFilePayload,
  DataTarget,
  Dataset,
  DatasetFileEntry,
} from '../types/data';

const DEFAULT_COLORMAP: ColormapId = 'viridis';

const makeDefaultDisplay = (): DataDisplayConfig => ({
  datasetId: null,
  colormap: DEFAULT_COLORMAP,
  min: 0,
  max: 1,
  auto: true,
});

/** Computes a [min, max] range over a dataset's finite values. */
const computeRange = (values: number[]): { min: number; max: number } => {
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (min === max) {
    // Degenerate range: pad so the colormap still spans a visible interval.
    return { min, max: min + 1 };
  }
  return { min, max };
};

let datasetCounter = 0;
const generateDatasetId = (): string => {
  datasetCounter += 1;
  return `ds-${Date.now().toString(36)}-${datasetCounter}`;
};

/** Validates and normalizes a raw file entry into a Dataset, or throws. */
const parseDatasetEntry = (entry: unknown, index: number): Dataset => {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Dataset #${index + 1} is not an object`);
  }
  const raw = entry as Partial<DatasetFileEntry>;
  if (raw.target !== 'node' && raw.target !== 'edge') {
    throw new Error(`Dataset #${index + 1} has invalid "target" (expected "node" or "edge")`);
  }
  if (!Array.isArray(raw.values) || raw.values.some((v) => typeof v !== 'number')) {
    throw new Error(`Dataset #${index + 1} has invalid "values" (expected an array of numbers)`);
  }
  const name =
    typeof raw.name === 'string' && raw.name.trim().length > 0
      ? raw.name.trim()
      : `${raw.target} data ${index + 1}`;

  return {
    id: generateDatasetId(),
    name,
    target: raw.target,
    unit: typeof raw.unit === 'string' ? raw.unit : undefined,
    values: raw.values as number[],
  };
};

interface DataStore {
  datasets: Dataset[];
  nodeDisplay: DataDisplayConfig;
  edgeDisplay: DataDisplayConfig;
  showContour: boolean;
  showValueLabels: boolean;
  valueLabelPrecision: number;

  loadDatasetsFromFile: (file: File) => void;
  removeDataset: (id: string) => void;
  clearDatasets: () => void;
  setDisplayDataset: (target: DataTarget, datasetId: string | null) => void;
  setColormap: (target: DataTarget, colormap: ColormapId) => void;
  setRange: (target: DataTarget, min: number, max: number) => void;
  setAutoRange: (target: DataTarget, auto: boolean) => void;
  toggleContour: () => void;
  toggleValueLabels: () => void;
  setValueLabelPrecision: (precision: number) => void;
}

const displayKey = (target: DataTarget): 'nodeDisplay' | 'edgeDisplay' =>
  target === 'node' ? 'nodeDisplay' : 'edgeDisplay';

export const useDataStore = create<DataStore>((set, get) => ({
  datasets: [],
  nodeDisplay: makeDefaultDisplay(),
  edgeDisplay: makeDefaultDisplay(),
  showContour: true,
  showValueLabels: false,
  valueLabelPrecision: 2,

  loadDatasetsFromFile: (file) => {
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const raw = event.target?.result;
        if (typeof raw !== 'string') {
          throw new Error('Invalid file contents');
        }
        const parsed = JSON.parse(raw) as DataFilePayload;
        if (!parsed || !Array.isArray(parsed.datasets)) {
          throw new Error('Invalid data file: expected a top-level "datasets" array');
        }
        const newDatasets = parsed.datasets.map((entry, index) => parseDatasetEntry(entry, index));
        if (newDatasets.length === 0) {
          throw new Error('Data file contains no datasets');
        }
        // Replace any previously loaded datasets. Dataset ids are regenerated per
        // load, so the existing display selections can no longer match — reset them.
        set((s) => ({
          datasets: newDatasets,
          nodeDisplay: { ...s.nodeDisplay, datasetId: null },
          edgeDisplay: { ...s.edgeDisplay, datasetId: null },
        }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error loading data file:', error);
        alert('Error loading data file: ' + message);
      }
    };
    reader.onerror = () => {
      console.error('Error reading data file');
      alert('Error reading data file');
    };
    reader.readAsText(file);
  },

  removeDataset: (id) => {
    set((s) => {
      const datasets = s.datasets.filter((d) => d.id !== id);
      const patch: Partial<DataStore> = { datasets };
      if (s.nodeDisplay.datasetId === id) {
        patch.nodeDisplay = { ...s.nodeDisplay, datasetId: null };
      }
      if (s.edgeDisplay.datasetId === id) {
        patch.edgeDisplay = { ...s.edgeDisplay, datasetId: null };
      }
      return patch;
    });
  },

  clearDatasets: () => {
    set((s) => ({
      datasets: [],
      nodeDisplay: { ...s.nodeDisplay, datasetId: null },
      edgeDisplay: { ...s.edgeDisplay, datasetId: null },
    }));
  },

  setDisplayDataset: (target, datasetId) => {
    set((s) => {
      const key = displayKey(target);
      const current = s[key];
      const dataset = datasetId ? s.datasets.find((d) => d.id === datasetId) : undefined;
      const range = current.auto && dataset ? computeRange(dataset.values) : null;
      return {
        [key]: {
          ...current,
          datasetId,
          ...(range ?? {}),
        },
      } as Partial<DataStore>;
    });
  },

  setColormap: (target, colormap) => {
    set((s) => {
      const key = displayKey(target);
      return { [key]: { ...s[key], colormap } } as Partial<DataStore>;
    });
  },

  setRange: (target, min, max) => {
    set((s) => {
      const key = displayKey(target);
      return { [key]: { ...s[key], min, max, auto: false } } as Partial<DataStore>;
    });
  },

  setAutoRange: (target, auto) => {
    set((s) => {
      const key = displayKey(target);
      const current = s[key];
      const dataset = current.datasetId
        ? s.datasets.find((d) => d.id === current.datasetId)
        : undefined;
      const range = auto && dataset ? computeRange(dataset.values) : null;
      return { [key]: { ...current, auto, ...(range ?? {}) } } as Partial<DataStore>;
    });
  },

  toggleContour: () => set((s) => ({ showContour: !s.showContour })),

  toggleValueLabels: () => set((s) => ({ showValueLabels: !s.showValueLabels })),

  setValueLabelPrecision: (precision) =>
    set({ valueLabelPrecision: Math.max(0, Math.min(6, Math.round(precision))) }),
}));

/** Resolves the dataset currently displayed for a target, if any. */
export const selectActiveDataset = (state: DataStore, target: DataTarget): Dataset | undefined => {
  const display = target === 'node' ? state.nodeDisplay : state.edgeDisplay;
  if (!display.datasetId) return undefined;
  return state.datasets.find((d) => d.id === display.datasetId);
};

/** Formats a numeric value for an on-canvas label, with optional unit. */
export const formatDataValue = (value: number, precision: number, unit?: string): string => {
  if (!Number.isFinite(value)) return '—';
  const text = value.toFixed(precision);
  return unit ? `${text} ${unit}` : text;
};

export interface ElementDataView {
  /** CSS color for this element, or null when there is no value/dataset. */
  color: string | null;
  /** Raw value for this element, or undefined when out of range/absent. */
  value: number | undefined;
  unit: string | undefined;
}

/**
 * Hook returning the colormap color and value for a single element (node or
 * edge) at a given generated index. Subscribes to the small per-target display
 * config and the active dataset; the color is memoized so unrelated store
 * updates don't recompute it.
 */
export const useElementDataView = (
  target: DataTarget,
  index: number | undefined
): ElementDataView => {
  const display = useDataStore((s) => (target === 'node' ? s.nodeDisplay : s.edgeDisplay));
  const dataset = useDataStore((s) =>
    display.datasetId ? s.datasets.find((d) => d.id === display.datasetId) : undefined
  );

  return useMemo(() => {
    if (!dataset || typeof index !== 'number' || index < 0 || index >= dataset.values.length) {
      return { color: null, value: undefined, unit: dataset?.unit };
    }
    const value = dataset.values[index];
    return {
      color: colorForValue(display.colormap, value, display.min, display.max),
      value,
      unit: dataset.unit,
    };
  }, [dataset, index, display.colormap, display.min, display.max]);
};
