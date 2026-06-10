/**
 * Types for loaded element data (results produced by external network-analysis
 * software). A dataset is a flat series of numbers ordered by the sequential
 * index this app assigns to each node/edge: `values[i]` belongs to the element
 * whose generated index is `i`.
 */

/** Whether a dataset colors nodes or edges. */
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

/** A single loaded dataset. */
export interface Dataset {
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

/**
 * The shape of a dataset as authored in a JSON data file. Mirrors {@link Dataset}
 * without the runtime-assigned `id`.
 */
export interface DatasetFileEntry {
  name: string;
  target: DataTarget;
  unit?: string;
  values: number[];
}

/** Top-level JSON data file structure. */
export interface DataFilePayload {
  datasets: DatasetFileEntry[];
}

/**
 * Display configuration for one target (nodes or edges): which dataset is shown,
 * the colormap, and the value range mapped to the colormap's [0, 1] domain.
 */
export interface DataDisplayConfig {
  /** Id of the dataset currently displayed, or null when none is selected. */
  datasetId: string | null;
  colormap: ColormapId;
  /** Value mapped to the low end of the colormap. */
  min: number;
  /** Value mapped to the high end of the colormap. */
  max: number;
  /** When true, `min`/`max` track the selected dataset's value range. */
  auto: boolean;
}
