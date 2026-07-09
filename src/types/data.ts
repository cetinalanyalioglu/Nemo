/**
 * Types for loaded element data (results produced by external network-analysis
 * software).
 *
 * A loaded file is a **dataset** — a named group of **items**. Each item is a
 * flat series of numbers ordered by the sequential index this app assigns to
 * each node/edge: `values[i]` belongs to the element whose generated index is
 * `i`. Multiple datasets can be loaded at once and any item from any dataset can
 * be assigned to the node or edge display independently.
 *
 * A dataset may additionally carry a **frame axis** ({@link DatasetFrames}): a
 * named frame variable with one value per frame. Its items then hold one value
 * row per frame (`values[k][i]` -> element `i` at frame `k`) and the canvas
 * offers playback over the frames. The frame variable is self-describing (name
 * and unit come from the data), so the model never leaks into the code.
 */

/** Whether an item colors nodes or edges. */
export type DataTarget = 'node' | 'edge';

/** Identifier of a built-in colormap. */
export type ColormapId =
  | 'viridis'
  | 'plasma'
  | 'inferno'
  | 'magma'
  | 'cividis'
  | 'coolwarm'
  | 'grayscale';

/**
 * An item's values: a flat series ordered by element index (`values[i]` ->
 * element with index `i`), or — inside an animated dataset — one such row per
 * frame (`values[k][i]` -> element `i` at frame `k`).
 */
export type DataValues = number[] | number[][];

/** Whether an item's values hold per-frame rows rather than a flat series. */
export const isFrameValues = (values: DataValues): values is number[][] =>
  values.length > 0 && Array.isArray(values[0]);

/**
 * The series an item exposes at a given frame: the matching row of a per-frame
 * item (clamped to the last row), or the flat series of a static item, which is
 * frame-independent.
 */
export const valuesAtFrame = (values: DataValues, frameIndex: number): number[] => {
  if (!isFrameValues(values)) return values;
  const clamped = Math.max(0, Math.min(values.length - 1, frameIndex));
  return values[clamped];
};

/** Every value of an item, frames flattened (for range computation). */
export const allValues = (values: DataValues): number[] =>
  isFrameValues(values) ? values.flat() : values;

/** A single loaded data item (one node or edge variable). */
export interface DataItem {
  /** Stable id assigned on load (not present in the source file). */
  id: string;
  /** Display name from the source file. */
  name: string;
  /** Whether the values map to nodes or edges. */
  target: DataTarget;
  /** Optional unit string shown in the pane and legend. */
  unit?: string;
  /** Values ordered by element index; per-frame rows in an animated dataset. */
  values: DataValues;
}

/**
 * One self-describing metadata field attached to a dataset. The UI renders these
 * generically as `label : value unit` (with `description` as a hover tooltip), so
 * it never needs to know what any `key` means — model-specific knowledge stays in
 * the data file, never in the code.
 */
export interface DatasetMetaEntry {
  /** Stable machine key (not displayed; lets the UI track entries). */
  key: string;
  /** Human-readable label shown in the pane. */
  label: string;
  /** The value (number, boolean, or string). */
  value: number | string | boolean;
  /** Optional unit shown after the value. */
  unit?: string;
  /** Optional longer note, surfaced as a tooltip. */
  description?: string;
}

/**
 * The frame axis of an animated dataset: a named frame variable (phase, a swept
 * frequency, a parameter, ...) with one value per frame. Like dataset metadata,
 * the variable is self-describing — the UI displays whatever name/unit the data
 * declares and never interprets it.
 */
export interface DatasetFrames {
  /** Display name of the frame variable (e.g. "Phase", "Frequency"). */
  variable: string;
  /** Optional unit shown next to the frame value in the player. */
  unit?: string;
  /** The frame variable's value at each frame, in playback order. */
  values: number[];
}

/** A loaded dataset: the named group of items present in one file. */
export interface Dataset {
  /** Stable id assigned on load. */
  id: string;
  /** Display name (from the file's `name`, else the filename). */
  name: string;
  /** The items (node/edge variables) belonging to this dataset. */
  items: DataItem[];
  /** Whether this dataset is embedded when the case is saved. */
  includeInSave: boolean;
  /** Optional free-form description (may contain inline `$...$` math). */
  description?: string;
  /** Optional self-describing metadata entries, rendered read-only. */
  info?: DatasetMetaEntry[];
  /** Present on an animated dataset: the frame axis its per-frame items follow. */
  frames?: DatasetFrames;
}

/** Whether a dataset is animated (carries a frame axis). */
export const isAnimatedDataset = (dataset: Dataset): boolean =>
  Boolean(dataset.frames && dataset.frames.values.length > 0);

/**
 * The shape of a single item as authored in a JSON data file. Mirrors
 * {@link DataItem} without the runtime-assigned `id`.
 */
export interface DataItemFileEntry {
  name: string;
  target: DataTarget;
  unit?: string;
  values: DataValues;
}

/**
 * Top-level JSON data file structure. The current shape names the dataset and
 * lists its `items`; the legacy shape (a top-level `datasets` array of item
 * entries) is still accepted on load for backward compatibility.
 */
export interface DataFilePayload {
  /** Optional dataset name; falls back to the filename when absent. */
  name?: string;
  /** Items in this dataset (current shape). */
  items?: DataItemFileEntry[];
  /** Legacy alias for `items`. */
  datasets?: DataItemFileEntry[];
  /** Present when the file holds an animated dataset. */
  frames?: DatasetFrames;
}

/** Numeric notation used when printing value labels on the canvas. */
export type ValueNotation = 'fixed' | 'scientific';

/**
 * Display configuration for one target (nodes or edges): which item is shown,
 * the colormap, the value range mapped to the colormap's [0, 1] domain, and how
 * (and whether) numeric value labels are printed for that target.
 */
export interface DataDisplayConfig {
  /** Id of the item currently displayed, or null when none is selected. */
  itemId: string | null;
  colormap: ColormapId;
  /** Value mapped to the low end of the colormap. */
  min: number;
  /** Value mapped to the high end of the colormap. */
  max: number;
  /** When true, `min`/`max` track the selected item's value range. */
  auto: boolean;
  /** Whether the colormap contour is drawn for this target. */
  showContour: boolean;
  /** Whether numeric value labels are printed for this target. */
  showValues: boolean;
  /** Decimal places used for value labels. */
  precision: number;
  /** Notation (fixed vs scientific) used for value labels. */
  notation: ValueNotation;
}
