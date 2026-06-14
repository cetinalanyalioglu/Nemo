/**
 * Types for loaded element data (results produced by external network-analysis
 * software).
 *
 * A loaded file is a **dataset** — a named group of **items**. Each item is a
 * flat series of numbers ordered by the sequential index this app assigns to
 * each node/edge: `values[i]` belongs to the element whose generated index is
 * `i`. Multiple datasets can be loaded at once and any item from any dataset can
 * be assigned to the node or edge display independently.
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
  /** Values ordered by element index; `values[i]` -> element with index `i`. */
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
}

/**
 * The shape of a single item as authored in a JSON data file. Mirrors
 * {@link DataItem} without the runtime-assigned `id`.
 */
export interface DataItemFileEntry {
  name: string;
  target: DataTarget;
  unit?: string;
  values: number[];
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
