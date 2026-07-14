import { useMemo } from 'react';
import { create } from 'zustand';
import { colorForValue, normalize } from '../utils/colormap';
import { logger } from '../utils/logger';
import { allValues, isAnimatedDataset, isFrameValues, valuesAtFrame } from '../types/data';
import type {
  ColormapId,
  DataDisplayConfig,
  DataFilePayload,
  DataItem,
  DataItemFileEntry,
  DataTarget,
  DataValues,
  Dataset,
  DatasetFrames,
  ValueNotation,
} from '../types/data';

const DEFAULT_COLORMAP: ColormapId = 'viridis';

/** Frame advance rate at speed 1 (frames per second). */
export const PLAYBACK_BASE_FPS = 10;

/** Selectable playback speed multipliers. */
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

const makeDefaultDisplay = (): DataDisplayConfig => ({
  itemId: null,
  colormap: DEFAULT_COLORMAP,
  min: 0,
  max: 1,
  auto: true,
  showContour: true,
  showValues: false,
  precision: 2,
  notation: 'fixed',
});

/** Allowed range (px) of the edge-thickness scale controller. */
export const EDGE_THICKNESS_SCALE_MIN = 1;
export const EDGE_THICKNESS_SCALE_MAX = 40;
const DEFAULT_EDGE_THICKNESS_SCALE = 6;
/** The thinnest edges are this fraction of `scale` (at the low end of the range). */
const EDGE_THICKNESS_MIN_FACTOR = 0.15;

/**
 * Edge-thickness mapping: scales each edge's stroke width by a chosen edge
 * variable. Independent of the colormap contour, so an edge can be colored by
 * one variable and sized by another. Width runs linearly from
 * `EDGE_THICKNESS_MIN_FACTOR · scale` (at the variable's minimum) to `scale`
 * (at its maximum).
 */
export interface EdgeThicknessConfig {
  /** Whether edge stroke width is driven by data. */
  enabled: boolean;
  /** Id of the edge item whose value sets the width, or null when none. */
  itemId: string | null;
  /** Stroke width (px) at the top of the variable's value range. */
  scale: number;
}

const makeDefaultEdgeThickness = (): EdgeThicknessConfig => ({
  enabled: false,
  itemId: null,
  scale: DEFAULT_EDGE_THICKNESS_SCALE,
});

/** Computes a [min, max] range over an item's finite values (all frames). */
const computeRange = (itemValues: DataValues): { min: number; max: number } => {
  const values = allValues(itemValues);
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

/** Whether `values` is a flat array of numbers. */
const isNumberRow = (values: unknown): values is number[] =>
  Array.isArray(values) && values.every((v) => typeof v === 'number');

/** Validates raw item values: a flat series, or rectangular per-frame rows. */
const validateItemValues = (values: unknown, label: string): DataValues => {
  if (isNumberRow(values)) return values;
  if (
    Array.isArray(values) &&
    values.length > 0 &&
    values.every((row) => isNumberRow(row) && row.length === (values[0] as number[]).length)
  ) {
    return values as number[][];
  }
  throw new Error(
    `${label} has invalid "values" (expected an array of numbers, or equal-length rows of numbers)`
  );
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
  const values = validateItemValues(raw.values, `Item #${index + 1}`);
  const name =
    typeof raw.name === 'string' && raw.name.trim().length > 0
      ? raw.name.trim()
      : `${raw.target} data ${index + 1}`;

  return {
    id: generateId('item'),
    name,
    target: raw.target,
    unit: typeof raw.unit === 'string' ? raw.unit : undefined,
    values,
  };
};

/** Validates a raw `frames` axis declaration, or throws. */
const parseFrames = (raw: unknown): DatasetFrames => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid "frames" (expected an object with "variable" and "values")');
  }
  const frames = raw as Partial<DatasetFrames>;
  if (typeof frames.variable !== 'string' || frames.variable.trim().length === 0) {
    throw new Error('Invalid "frames": missing frame "variable" name');
  }
  if (!isNumberRow(frames.values) || frames.values.length === 0) {
    throw new Error('Invalid "frames": "values" must be a non-empty array of numbers');
  }
  return {
    variable: frames.variable.trim(),
    unit: typeof frames.unit === 'string' ? frames.unit : undefined,
    values: frames.values,
  };
};

/**
 * Checks the frame consistency of a dataset: per-frame items need a frame axis,
 * and their row count must match it. Returns an error message or null. A flat
 * item inside an animated dataset is allowed (it is frame-independent).
 */
const findFrameMismatch = (dataset: Dataset): string | null => {
  const frameCount = dataset.frames?.values.length ?? 0;
  for (const item of dataset.items) {
    if (!isFrameValues(item.values)) continue;
    if (frameCount === 0) {
      return `Dataset rejected: item "${item.name}" holds per-frame rows but the dataset declares no "frames" axis.`;
    }
    if (item.values.length !== frameCount) {
      return (
        `Dataset rejected: item "${item.name}" has ${item.values.length} frame` +
        `${item.values.length === 1 ? '' : 's'}, but the "frames" axis has ${frameCount}.`
      );
    }
  }
  return null;
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
    // For a per-frame item every row must match; rows are rectangular by
    // construction, so checking the first row suffices.
    const got = isFrameValues(item.values) ? item.values[0].length : item.values.length;
    if (got !== want) {
      return (
        `Dataset rejected: item "${item.name}" has ${got} ${noun} ` +
        `value${got === 1 ? '' : 's'}, but the canvas has ${want} ` +
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
  const frames = payload.frames !== undefined ? parseFrames(payload.frames) : undefined;
  const dataset: Dataset = { id: generateId('ds'), name, items, includeInSave: true, frames };
  const frameMismatch = findFrameMismatch(dataset);
  if (frameMismatch) {
    throw new Error(frameMismatch);
  }
  return dataset;
};

/**
 * Playback state for the active animated dataset. A single global cursor: the
 * frame index applies to whichever animated dataset the node/edge displays
 * reference (per-item resolution clamps to each item's own frame count).
 */
export interface PlaybackState {
  /** Current frame index (0-based). */
  frameIndex: number;
  isPlaying: boolean;
  /** Speed multiplier over {@link PLAYBACK_BASE_FPS}. */
  speed: number;
  /** Whether playback wraps at the last frame. */
  loop: boolean;
}

const makeDefaultPlayback = (): PlaybackState => ({
  frameIndex: 0,
  isPlaying: false,
  speed: 1,
  loop: true,
});

interface DataStore {
  datasets: Dataset[];
  /** Bumped on every successful load; observed by the canvas freeze bridge. */
  loadCount: number;
  nodeDisplay: DataDisplayConfig;
  edgeDisplay: DataDisplayConfig;
  edgeThickness: EdgeThicknessConfig;
  playback: PlaybackState;

  /**
   * Datasets embedded in a just-loaded case file, awaiting the user's choice of
   * which to import. Null when no choice is pending.
   */
  pendingDatasets: Dataset[] | null;

  /**
   * A pending "scale to visible" request: the target to rescale and a sequence
   * number that increments on every request so the canvas bridge re-runs even
   * for repeated requests on the same target. Null when none is pending.
   */
  scaleRequest: { target: DataTarget; seq: number } | null;

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
  /**
   * Requests the colormap range for a target be rescaled to the elements
   * currently inside the canvas viewport. Bumped here; fulfilled by the canvas
   * bridge, which alone knows which elements are on screen (see
   * {@link ScaleToVisibleBridge}).
   */
  requestScaleToVisible: (target: DataTarget) => void;
  toggleContour: (target: DataTarget) => void;
  toggleShowValues: (target: DataTarget) => void;
  setPrecision: (target: DataTarget, precision: number) => void;
  setNotation: (target: DataTarget, notation: ValueNotation) => void;

  /** Toggles whether edge stroke width is scaled by the thickness variable. */
  toggleEdgeThickness: () => void;
  /** Selects the edge variable that drives stroke width (null clears it). */
  setEdgeThicknessItem: (itemId: string | null) => void;
  /** Sets the stroke width (px) at the top of the variable's range (clamped). */
  setEdgeThicknessScale: (scale: number) => void;

  /** Jumps to a frame of the active animated dataset (clamped). */
  setFrame: (frameIndex: number) => void;
  /** Steps the frame cursor by `delta`, wrapping around the frame count. */
  stepFrame: (delta: number) => void;
  /** Advances one frame during playback; pauses at the end unless looping. */
  advanceFrame: () => void;
  startPlayback: () => void;
  pausePlayback: () => void;
  /** Stops playback and rewinds to the first frame. */
  stopPlayback: () => void;
  setPlaybackSpeed: (speed: number) => void;
  togglePlaybackLoop: () => void;
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

/**
 * Resolves the animated dataset the displays currently reference, if any: the
 * dataset of the displayed node item when that dataset is animated, else the
 * dataset of the displayed edge item. Drives the canvas player and the frame
 * resolution of the element views.
 */
const findActiveAnimation = (
  datasets: Dataset[],
  nodeDisplay: DataDisplayConfig,
  edgeDisplay: DataDisplayConfig
): Dataset | undefined => {
  for (const display of [nodeDisplay, edgeDisplay]) {
    const dataset = findItem(datasets, display.itemId)?.dataset;
    if (dataset && isAnimatedDataset(dataset)) return dataset;
  }
  return undefined;
};

/** Clamps `frameIndex` to a dataset's frame count. */
const clampFrame = (dataset: Dataset | undefined, frameIndex: number): number => {
  const count = dataset?.frames?.values.length ?? 0;
  if (count === 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(frameIndex)));
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
  if (state.edgeThickness.itemId && !findItem(datasets, state.edgeThickness.itemId)) {
    patch.edgeThickness = { ...state.edgeThickness, itemId: null };
  }
  // Rewind and stop playback when no animated dataset is referenced anymore.
  const node = patch.nodeDisplay ?? state.nodeDisplay;
  const edge = patch.edgeDisplay ?? state.edgeDisplay;
  if (!findActiveAnimation(datasets, node, edge)) {
    patch.playback = { ...state.playback, frameIndex: 0, isPlaying: false };
  }
  return patch;
};

export const useDataStore = create<DataStore>((set, get) => ({
  datasets: [],
  loadCount: 0,
  nodeDisplay: makeDefaultDisplay(),
  edgeDisplay: makeDefaultDisplay(),
  edgeThickness: makeDefaultEdgeThickness(),
  playback: makeDefaultPlayback(),
  pendingDatasets: null,
  scaleRequest: null,

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
        logger.success(
          `Loaded dataset "${dataset.name}" with ${dataset.items.length} ` +
            `item${dataset.items.length === 1 ? '' : 's'}.`
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to load data file "${file.name}": ${message}`);
        alert('Error loading data file: ' + message);
      }
    };
    reader.onerror = () => {
      logger.error(`Failed to read data file "${file.name}".`);
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
      // Carry self-describing metadata and the frame axis through so they
      // survive a UI re-save.
      description: dataset.description,
      info: dataset.info,
      frames: dataset.frames,
      items: (dataset.items ?? []).map((item) => ({
        id: generateId('item'),
        name: item.name,
        target: item.target,
        unit: item.unit,
        values: item.values,
      })),
    }));
    set((s) => ({ datasets: [...s.datasets, ...cloned], loadCount: s.loadCount + 1 }));
    logger.info(
      `Imported ${cloned.length} dataset${cloned.length === 1 ? '' : 's'} from saved case.`
    );
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
      edgeThickness: { ...s.edgeThickness, itemId: null },
    }));
  },

  setDisplayItem: (target, itemId) => {
    set((s) => {
      const key = displayKey(target);
      const current = s[key];
      const found = findItem(s.datasets, itemId);
      const range = current.auto && found ? computeRange(found.item.values) : null;
      const display = { ...current, itemId, ...(range ?? {}) };
      const patch = { [key]: display } as Partial<DataStore>;
      // Rewind the frame cursor when the selection moves to a different
      // animated dataset (or away from animation entirely).
      const node = target === 'node' ? display : s.nodeDisplay;
      const edge = target === 'edge' ? display : s.edgeDisplay;
      const prevAnim = findActiveAnimation(s.datasets, s.nodeDisplay, s.edgeDisplay);
      const nextAnim = findActiveAnimation(s.datasets, node, edge);
      if (!nextAnim) {
        patch.playback = { ...s.playback, frameIndex: 0, isPlaying: false };
      } else if (nextAnim.id !== prevAnim?.id) {
        patch.playback = { ...s.playback, frameIndex: 0 };
      }
      return patch;
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

  requestScaleToVisible: (target) => {
    set((s) => ({ scaleRequest: { target, seq: (s.scaleRequest?.seq ?? 0) + 1 } }));
  },

  toggleContour: (target) => {
    set((s) => {
      const key = displayKey(target);
      return { [key]: { ...s[key], showContour: !s[key].showContour } } as Partial<DataStore>;
    });
  },

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

  toggleEdgeThickness: () => {
    set((s) => ({ edgeThickness: { ...s.edgeThickness, enabled: !s.edgeThickness.enabled } }));
  },

  setEdgeThicknessItem: (itemId) => {
    set((s) => ({ edgeThickness: { ...s.edgeThickness, itemId } }));
  },

  setEdgeThicknessScale: (scale) => {
    if (!Number.isFinite(scale)) return;
    const clamped = Math.max(EDGE_THICKNESS_SCALE_MIN, Math.min(EDGE_THICKNESS_SCALE_MAX, scale));
    set((s) => ({ edgeThickness: { ...s.edgeThickness, scale: clamped } }));
  },

  setFrame: (frameIndex) => {
    set((s) => {
      const anim = findActiveAnimation(s.datasets, s.nodeDisplay, s.edgeDisplay);
      if (!anim) return {};
      return { playback: { ...s.playback, frameIndex: clampFrame(anim, frameIndex) } };
    });
  },

  stepFrame: (delta) => {
    set((s) => {
      const anim = findActiveAnimation(s.datasets, s.nodeDisplay, s.edgeDisplay);
      const count = anim?.frames?.values.length ?? 0;
      if (count === 0) return {};
      const next = (((s.playback.frameIndex + delta) % count) + count) % count;
      return { playback: { ...s.playback, frameIndex: next } };
    });
  },

  advanceFrame: () => {
    set((s) => {
      if (!s.playback.isPlaying) return {};
      const anim = findActiveAnimation(s.datasets, s.nodeDisplay, s.edgeDisplay);
      const count = anim?.frames?.values.length ?? 0;
      if (count === 0) return { playback: { ...s.playback, isPlaying: false } };
      const next = s.playback.frameIndex + 1;
      if (next >= count) {
        return s.playback.loop
          ? { playback: { ...s.playback, frameIndex: 0 } }
          : { playback: { ...s.playback, frameIndex: count - 1, isPlaying: false } };
      }
      return { playback: { ...s.playback, frameIndex: next } };
    });
  },

  startPlayback: () => {
    set((s) => {
      const anim = findActiveAnimation(s.datasets, s.nodeDisplay, s.edgeDisplay);
      const count = anim?.frames?.values.length ?? 0;
      if (count === 0) return {};
      // Restart from the top when play is hit on the final frame of a
      // non-looping run; otherwise resume in place.
      const frameIndex =
        s.playback.frameIndex >= count - 1 && !s.playback.loop ? 0 : s.playback.frameIndex;
      return { playback: { ...s.playback, isPlaying: true, frameIndex } };
    });
  },

  pausePlayback: () => {
    set((s) => ({ playback: { ...s.playback, isPlaying: false } }));
  },

  stopPlayback: () => {
    set((s) => ({ playback: { ...s.playback, isPlaying: false, frameIndex: 0 } }));
  },

  setPlaybackSpeed: (speed) => {
    if (!Number.isFinite(speed) || speed <= 0) return;
    set((s) => ({ playback: { ...s.playback, speed } }));
  },

  togglePlaybackLoop: () => {
    set((s) => ({ playback: { ...s.playback, loop: !s.playback.loop } }));
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

/**
 * Resolves the animated dataset the displays currently reference, if any (the
 * one the canvas player controls). Returns the stored object directly so the
 * reference stays stable for unchanged selections.
 */
export const selectActiveAnimation = (state: DataStore): Dataset | undefined =>
  findActiveAnimation(state.datasets, state.nodeDisplay, state.edgeDisplay);

/**
 * The series an item exposes at the store's current frame: the matching row of
 * a per-frame item, or the flat series of a static one.
 */
export const currentFrameValues = (state: DataStore, item: DataItem): number[] =>
  valuesAtFrame(item.values, state.playback.frameIndex);

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
  // Subscribe to the frame cursor only when this target's item is per-frame, so
  // elements bound to static items don't re-render on every playback tick.
  const frameIndex = useDataStore((s) =>
    item && isFrameValues(item.values) ? s.playback.frameIndex : 0
  );

  return useMemo(() => {
    const values = item ? valuesAtFrame(item.values, frameIndex) : undefined;
    if (!item || !values || typeof index !== 'number' || index < 0 || index >= values.length) {
      return { color: null, value: undefined, unit: item?.unit };
    }
    const value = values[index];
    return {
      color: colorForValue(display.colormap, value, display.min, display.max),
      value,
      unit: item.unit,
    };
  }, [item, index, frameIndex, display.colormap, display.min, display.max]);
};

/**
 * Hook returning the data-driven stroke width (px) for one edge at a given
 * index, or null when thickness mapping is off or no value is available (so the
 * caller falls back to the default `--edge-width`). The width scales linearly
 * from `EDGE_THICKNESS_MIN_FACTOR · scale` at the variable's minimum to `scale`
 * at its maximum, with the range taken over all of the variable's values.
 */
export const useEdgeThicknessWidth = (index: number | undefined): number | null => {
  const config = useDataStore((s) => s.edgeThickness);
  const datasets = useDataStore((s) => s.datasets);
  const item = useMemo(() => findItem(datasets, config.itemId)?.item, [datasets, config.itemId]);
  // Subscribe to the frame cursor only for a per-frame thickness variable.
  const frameIndex = useDataStore((s) =>
    item && isFrameValues(item.values) ? s.playback.frameIndex : 0
  );

  return useMemo(() => {
    if (!config.enabled || !item || typeof index !== 'number') return null;
    const values = valuesAtFrame(item.values, frameIndex);
    if (index < 0 || index >= values.length) return null;
    const value = values[index];
    if (!Number.isFinite(value)) return null;
    const { min, max } = computeRange(item.values);
    const t = normalize(value, min, max);
    return config.scale * (EDGE_THICKNESS_MIN_FACTOR + (1 - EDGE_THICKNESS_MIN_FACTOR) * t);
  }, [config.enabled, config.scale, item, index, frameIndex]);
};
