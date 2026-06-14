import { useMemo } from 'react';
import { create } from 'zustand';
import { colorForValue } from '../utils/colormap';
import type {
  ColormapId,
  DataDisplayConfig,
  DataFilePayload,
  DataItem,
  DataItemFileEntry,
  DataTarget,
  Dataset,
  ValueNotation,
} from '../types/data';

const DEFAULT_COLORMAP: ColormapId = 'viridis';

const makeDefaultDisplay = (): DataDisplayConfig => ({
  itemId: null,
  colormap: DEFAULT_COLORMAP,
  min: 0,
  max: 1,
  auto: true,
  showValues: false,
  precision: 2,
  notation: 'fixed',
});

/** Computes a [min, max] range over an item's finite values. */
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

let idCounter = 0;
const generateId = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
};

/** Validates and normalizes a raw file entry into a DataItem, or throws. */
const parseItemEntry = (entry: unknown, index: number): DataItem => {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`Item #${index + 1} is not an object`);
  }
  const raw = entry as Partial<DataItemFileEntry>;
  if (raw.target !== 'node' && raw.target !== 'edge') {
    throw new Error(`Item #${index + 1} has invalid "target" (expected "node" or "edge")`);
  }
  if (!Array.isArray(raw.values) || raw.values.some((v) => typeof v !== 'number')) {
    throw new Error(`Item #${index + 1} has invalid "values" (expected an array of numbers)`);
  }
  const name =
    typeof raw.name === 'string' && raw.name.trim().length > 0
      ? raw.name.trim()
      : `${raw.target} data ${index + 1}`;

  return {
    id: generateId('item'),
    name,
    target: raw.target,
    unit: typeof raw.unit === 'string' ? raw.unit : undefined,
    values: raw.values as number[],
  };
};

/** Strips a file extension to derive a default dataset name from a filename. */
const stripExtension = (fileName: string): string => fileName.replace(/\.[^./\\]+$/, '');

/**
 * Returns a human-readable message describing the first item in a dataset whose
 * value count doesn't match the canvas element count for its target, or null
 * when every item matches.
 */
const findCountMismatch = (
  dataset: Dataset,
  expected: { nodeCount: number; edgeCount: number }
): string | null => {
  for (const item of dataset.items) {
    const want = item.target === 'node' ? expected.nodeCount : expected.edgeCount;
    const noun = item.target === 'node' ? 'node' : 'edge';
    if (item.values.length !== want) {
      return (
        `Dataset rejected: item "${item.name}" has ${item.values.length} ${noun} ` +
        `value${item.values.length === 1 ? '' : 's'}, but the canvas has ${want} ` +
        `${noun}${want === 1 ? '' : 's'}. Data must match the canvas element count.`
      );
    }
  }
  return null;
};

/** Builds a Dataset group from a parsed file payload. */
const buildDatasetFromPayload = (payload: DataFilePayload, fallbackName: string): Dataset => {
  const entries = payload.items ?? payload.datasets;
  if (!Array.isArray(entries)) {
    throw new Error('Invalid data file: expected an "items" array');
  }
  const items = entries.map((entry, index) => parseItemEntry(entry, index));
  if (items.length === 0) {
    throw new Error('Data file contains no items');
  }
  const name =
    typeof payload.name === 'string' && payload.name.trim().length > 0
      ? payload.name.trim()
      : fallbackName;
  return { id: generateId('ds'), name, items, includeInSave: true };
};

interface DataStore {
  datasets: Dataset[];
  /** Bumped on every successful load; observed by the canvas freeze bridge. */
  loadCount: number;
  nodeDisplay: DataDisplayConfig;
  edgeDisplay: DataDisplayConfig;
  showContour: boolean;

  /**
   * Datasets embedded in a just-loaded case file, awaiting the user's choice of
   * which to import. Null when no choice is pending.
   */
  pendingDatasets: Dataset[] | null;

  loadDatasetsFromFile: (file: File, expected?: ExpectedCounts) => void;
  /** Restores datasets embedded in a saved case file. */
  loadDatasetsFromObject: (datasets: Dataset[]) => void;
  /** Opens the load-time selection dialog for embedded datasets. */
  presentDatasetChoice: (datasets: Dataset[]) => void;
  /** Imports the chosen subset of pending datasets and closes the dialog. */
  resolveDatasetChoice: (chosen: Dataset[]) => void;
  /** Dismisses the dialog without importing anything. */
  cancelDatasetChoice: () => void;
  removeDataset: (id: string) => void;
  renameDataset: (id: string, name: string) => void;
  toggleDatasetSave: (id: string) => void;
  setAllDatasetsSave: (include: boolean) => void;
  clearDatasets: () => void;
  setDisplayItem: (target: DataTarget, itemId: string | null) => void;
  setColormap: (target: DataTarget, colormap: ColormapId) => void;
  setRange: (target: DataTarget, min: number, max: number) => void;
  setAutoRange: (target: DataTarget, auto: boolean) => void;
  toggleContour: () => void;
  toggleShowValues: (target: DataTarget) => void;
  setPrecision: (target: DataTarget, precision: number) => void;
  setNotation: (target: DataTarget, notation: ValueNotation) => void;
}

/** Expected element counts used to validate a dataset on load (task: reject mismatched data). */
export interface ExpectedCounts {
  nodeCount: number;
  edgeCount: number;
}

const displayKey = (target: DataTarget): 'nodeDisplay' | 'edgeDisplay' =>
  target === 'node' ? 'nodeDisplay' : 'edgeDisplay';

/** Finds an item (and its parent dataset) by item id across all datasets. */
const findItem = (
  datasets: Dataset[],
  itemId: string | null | undefined
): { dataset: Dataset; item: DataItem } | undefined => {
  if (!itemId) return undefined;
  for (const dataset of datasets) {
    const item = dataset.items.find((i) => i.id === itemId);
    if (item) return { dataset, item };
  }
  return undefined;
};

/** Clears any display selection whose item is no longer present. */
const clearStaleDisplays = (state: DataStore, datasets: Dataset[]): Partial<DataStore> => {
  const patch: Partial<DataStore> = { datasets };
  if (state.nodeDisplay.itemId && !findItem(datasets, state.nodeDisplay.itemId)) {
    patch.nodeDisplay = { ...state.nodeDisplay, itemId: null };
  }
  if (state.edgeDisplay.itemId && !findItem(datasets, state.edgeDisplay.itemId)) {
    patch.edgeDisplay = { ...state.edgeDisplay, itemId: null };
  }
  return patch;
};

export const useDataStore = create<DataStore>((set, get) => ({
  datasets: [],
  loadCount: 0,
  nodeDisplay: makeDefaultDisplay(),
  edgeDisplay: makeDefaultDisplay(),
  showContour: true,
  pendingDatasets: null,

  loadDatasetsFromFile: (file, expected) => {
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      try {
        const raw = event.target?.result;
        if (typeof raw !== 'string') {
          throw new Error('Invalid file contents');
        }
        const parsed = JSON.parse(raw) as DataFilePayload;
        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Invalid data file');
        }
        const dataset = buildDatasetFromPayload(parsed, stripExtension(file.name));
        // Reject datasets whose item lengths don't match the canvas element
        // counts: data maps to elements by index, so a length mismatch can't be
        // interpreted correctly.
        if (expected) {
          const mismatch = findCountMismatch(dataset, expected);
          if (mismatch) {
            throw new Error(mismatch);
          }
        }
        // Append: loading a file adds a dataset and keeps existing selections.
        set((s) => ({ datasets: [...s.datasets, dataset], loadCount: s.loadCount + 1 }));
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

  loadDatasetsFromObject: (datasets) => {
    if (!Array.isArray(datasets) || datasets.length === 0) return;
    // Regenerate ids so embedded datasets never collide with anything loaded
    // in this session, and re-derive item ids the displays reference.
    const cloned: Dataset[] = datasets.map((dataset) => ({
      id: generateId('ds'),
      name: dataset.name,
      includeInSave: dataset.includeInSave ?? true,
      items: (dataset.items ?? []).map((item) => ({
        id: generateId('item'),
        name: item.name,
        target: item.target,
        unit: item.unit,
        values: item.values,
      })),
    }));
    set((s) => ({ datasets: [...s.datasets, ...cloned], loadCount: s.loadCount + 1 }));
  },

  presentDatasetChoice: (datasets) => {
    if (!Array.isArray(datasets) || datasets.length === 0) {
      set({ pendingDatasets: null });
      return;
    }
    set({ pendingDatasets: datasets });
  },

  resolveDatasetChoice: (chosen) => {
    if (chosen.length > 0) {
      get().loadDatasetsFromObject(chosen);
    }
    set({ pendingDatasets: null });
  },

  cancelDatasetChoice: () => set({ pendingDatasets: null }),

  removeDataset: (id) => {
    set((s) => {
      const datasets = s.datasets.filter((d) => d.id !== id);
      return clearStaleDisplays(s, datasets);
    });
  },

  renameDataset: (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => ({
      datasets: s.datasets.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
    }));
  },

  toggleDatasetSave: (id) => {
    set((s) => ({
      datasets: s.datasets.map((d) =>
        d.id === id ? { ...d, includeInSave: !d.includeInSave } : d
      ),
    }));
  },

  setAllDatasetsSave: (include) => {
    set((s) => ({ datasets: s.datasets.map((d) => ({ ...d, includeInSave: include })) }));
  },

  clearDatasets: () => {
    set((s) => ({
      datasets: [],
      pendingDatasets: null,
      nodeDisplay: { ...s.nodeDisplay, itemId: null },
      edgeDisplay: { ...s.edgeDisplay, itemId: null },
    }));
  },

  setDisplayItem: (target, itemId) => {
    set((s) => {
      const key = displayKey(target);
      const current = s[key];
      const found = findItem(s.datasets, itemId);
      const range = current.auto && found ? computeRange(found.item.values) : null;
      return {
        [key]: {
          ...current,
          itemId,
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
      const found = findItem(s.datasets, current.itemId);
      const range = auto && found ? computeRange(found.item.values) : null;
      return { [key]: { ...current, auto, ...(range ?? {}) } } as Partial<DataStore>;
    });
  },

  toggleContour: () => set((s) => ({ showContour: !s.showContour })),

  toggleShowValues: (target) => {
    set((s) => {
      const key = displayKey(target);
      return { [key]: { ...s[key], showValues: !s[key].showValues } } as Partial<DataStore>;
    });
  },

  setPrecision: (target, precision) => {
    set((s) => {
      const key = displayKey(target);
      const clamped = Math.max(0, Math.min(6, Math.round(precision)));
      return { [key]: { ...s[key], precision: clamped } } as Partial<DataStore>;
    });
  },

  setNotation: (target, notation) => {
    set((s) => {
      const key = displayKey(target);
      return { [key]: { ...s[key], notation } } as Partial<DataStore>;
    });
  },
}));

/** Total number of items across all loaded datasets. */
export const selectItemCount = (state: DataStore): number =>
  state.datasets.reduce((sum, d) => sum + d.items.length, 0);

/**
 * Resolves the item currently displayed for a target, if any. Returns the item
 * object straight from the store so the reference is stable across renders when
 * the selection is unchanged (required by zustand's snapshot equality check).
 */
export const selectActiveItem = (state: DataStore, target: DataTarget): DataItem | undefined => {
  const display = target === 'node' ? state.nodeDisplay : state.edgeDisplay;
  return findItem(state.datasets, display.itemId)?.item;
};

/**
 * Resolves the parent dataset of the item currently displayed for a target.
 * Like {@link selectActiveItem}, returns the stored object directly so the
 * reference stays stable for unchanged selections.
 */
export const selectActiveDataset = (state: DataStore, target: DataTarget): Dataset | undefined => {
  const display = target === 'node' ? state.nodeDisplay : state.edgeDisplay;
  return findItem(state.datasets, display.itemId)?.dataset;
};

/** Finds an item (and its dataset) by id; exported for component use. */
export const findItemById = (
  state: DataStore,
  itemId: string | null | undefined
): { dataset: Dataset; item: DataItem } | undefined => findItem(state.datasets, itemId);

/** Formats a numeric value for an on-canvas label, with optional unit. */
export const formatDataValue = (
  value: number,
  precision: number,
  notation: ValueNotation,
  unit?: string
): string => {
  if (!Number.isFinite(value)) return '—';
  const text =
    notation === 'scientific' ? value.toExponential(precision) : value.toFixed(precision);
  return unit ? `${text} ${unit}` : text;
};

export interface ElementDataView {
  /** CSS color for this element, or null when there is no value/item. */
  color: string | null;
  /** Raw value for this element, or undefined when out of range/absent. */
  value: number | undefined;
  unit: string | undefined;
}

/**
 * Hook returning the colormap color and value for a single element (node or
 * edge) at a given generated index. Subscribes to the small per-target display
 * config and the active item; the color is memoized so unrelated store updates
 * don't recompute it.
 */
export const useElementDataView = (
  target: DataTarget,
  index: number | undefined
): ElementDataView => {
  const display = useDataStore((s) => (target === 'node' ? s.nodeDisplay : s.edgeDisplay));
  const datasets = useDataStore((s) => s.datasets);
  const item = useMemo(() => findItem(datasets, display.itemId)?.item, [datasets, display.itemId]);

  return useMemo(() => {
    if (!item || typeof index !== 'number' || index < 0 || index >= item.values.length) {
      return { color: null, value: undefined, unit: item?.unit };
    }
    const value = item.values[index];
    return {
      color: colorForValue(display.colormap, value, display.min, display.max),
      value,
      unit: item.unit,
    };
  }, [item, index, display.colormap, display.min, display.max]);
};
