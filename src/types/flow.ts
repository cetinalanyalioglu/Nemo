import type { ComponentType } from 'react';
import type { IconType } from 'react-icons';
import type { Edge, XYPosition } from 'reactflow';
import type { Dataset } from './data';
import type { SaveFileAnnotation } from './annotations';

/** Runtime parameter bag for nodes and edges */
export type ParameterValues = Record<string, unknown>;

export interface NodeRuntimeState {
  parameters: ParameterValues;
}

export interface EdgeRuntimeState {
  parameters: ParameterValues;
}

export interface EditingState {
  isEditing: boolean;
  tempLabel: string;
}

export type ParameterChangeHandlerResult = { isValid: boolean; reason?: string };

export type ParameterChangeHandler = (
  nodeId: string,
  paramName: string,
  value: unknown,
  oldValue: unknown,
  tempNodeStates: Record<string, NodeRuntimeState>,
  edges: Edge[],
  edgeStates: Record<string, EdgeRuntimeState>
) => ParameterChangeHandlerResult;

/** Parameter metadata used by the properties panel and node definitions */
export type ParameterInfo = Record<string, unknown> & {
  label?: string;
  type?: string;
  category?: string;
  editable?: boolean;
  visible?: boolean;
  /**
   * When true, the parameter has no usable default: it is created unset (the
   * model default is never seeded), the properties panel flags it while empty,
   * and `checkNetworkValidity` reports an error until the user supplies a value.
   */
  required?: boolean;
  /**
   * Opt-in: the parameter accepts one value per branch as well as a single one.
   * A numeric field so marked takes a comma-separated list ("0.2, 0.6, 1") and
   * stores it as an array, so a value written per port survives editing; every
   * entry is range-checked like a lone value. Off by default, so an ordinary
   * numeric parameter still refuses anything but one number.
   */
  perBranch?: boolean;
  visibleIf?: VisibilityCondition;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  description?: string;
  /**
   * Opt-in: show an info icon next to the label that reveals `description`.
   * The icon is hidden unless this is explicitly set, so an authored
   * description does not surface in the UI on its own.
   */
  displayInfoTag?: boolean;
  /**
   * How `description` is surfaced when the info icon is clicked (only relevant
   * when `displayInfoTag` is set). `popover` (the default) shows a small
   * anchored card with the text typeset via KaTeX; `modal` opens a centered
   * dialog that renders the description as Markdown (richer content like images).
   */
  infoStyle?: 'popover' | 'modal';
  key?: string;
  /** Choices for a `select` (dropdown) parameter. `label` defaults to `value`. */
  options?: Array<{ value: string; label?: string; description?: string }>;
};

export type VisibilityCondition =
  | {
      parameter?: string;
      /**
       * Which parameter bag `parameter` is resolved against. `self` (the default)
       * reads the element's own parameters; `model` reads the model-level
       * parameters, letting a node/edge parameter react to a global parameter.
       */
      scope?: 'self' | 'model';
      equals?: unknown;
      greaterThan?: number;
      lessThan?: number;
      oneOf?: unknown[];
    }
  | { and?: VisibilityCondition[] }
  | { or?: VisibilityCondition[] };

export interface ElementInfoEntry {
  type?: string;
  displayName?: string;
  category?: string;
  parameters: Record<string, ParameterInfo>;
  ports: { target: string[]; source: string[] };
  dynamicPorts?: boolean;
  icon?: ComponentType<{ className?: string }>;
  onParameterChange?: Record<string | '*', ParameterChangeHandler>;
}

export interface EdgeInfoEntry {
  type?: string;
  displayName?: string;
  category?: string;
  parameters: Record<string, ParameterInfo>;
}

/** Ports a node exposes, keyed by direction. */
export type NodePorts = { target: string[]; source: string[] };

/** Which edge of a node a port renders on. Purely presentational. */
export type PortSide = 'left' | 'right' | 'top' | 'bottom';

/**
 * Frame an element is drawn in. `rect` is the default boxed node (HTML, ports on
 * the four edges); `circle` is a round SVG frame with a border, a centred glyph
 * and radial ports; `box` is a rectangular SVG frame with a gray interior, a
 * schematic glyph and triangle ports on its edges. Purely presentational.
 */
export type NodeShape = 'rect' | 'circle' | 'box' | 'rail';

/**
 * Per-*instance* manual angular overrides for a circular element's perimeter
 * ports, in degrees (math convention, 0° = right, 90° = up). Keyed by the port's
 * positional suffix and stored in the node's UI data, so they round-trip through
 * save/load and history and take precedence over the automatic distribution.
 */
export type PortAngles = Record<string, number>;

/**
 * Per-node override mapping a port's positional number (the handle-id suffix) to
 * the edge it renders on. Presentation-only: it never changes a port's number,
 * direction (target/source), handle id, or connectivity — only where the handle
 * is drawn. Absent entries fall back to the default (targets left, sources
 * right). Stored in the node's UI data, never in the solver-facing model.
 */
export type PortPlacements = Record<string, PortSide>;

/**
 * Per-*instance* manual placement of a rail element's (mixer/splitter) ports: the
 * side the port renders on plus a normalized offset [0,1] along it. Keyed by the
 * port's positional suffix and stored in the node's UI data, so it round-trips
 * through save/load and history and takes precedence over the automatic stack.
 * The rail analog of {@link PortAngles}; presentation-only, never in the model.
 */
export type RailPortAnchor = { side: PortSide; offset: number };
export type RailPortAnchors = Record<string, RailPortAnchor>;

/**
 * Describes how the number of ports on one side of a node is derived from a
 * parameter, enabling data-driven dynamic-port elements.
 */
export interface DynamicPortSide {
  /** Parameter whose value determines the port count for this side. */
  countParameter?: string;
  /** Fallback count used when the parameter is unset. */
  default?: number;
  /** Minimum allowed count. */
  min?: number;
}

export interface DynamicPortConfig {
  target?: DynamicPortSide;
  source?: DynamicPortSide;
}

/** Runtime configuration for a single node type within a model. */
export interface NodeConfigEntry {
  customParameters: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
  ports: NodePorts;
  icon: IconType;
  displayName: string;
  category: string;
  /** Frame the element is drawn in. Defaults to `rect`. */
  shape: NodeShape;
  /**
   * Frames the user may switch this element between, per instance (a UI-only choice stored on
   * the node's `data`; the solver model is identical). When set, the properties panel shows a
   * shape selector. The junction, for example, may render as a `rail` or a `circle`.
   */
  shapeOptions?: NodeShape[];
  /** For `circle`/`box` shapes: registry key of the glyph drawn inside the frame. */
  glyph?: string;
  /**
   * For `circle` shapes: multiplier on the centred glyph's size, so each element
   * type can size its glyph to look right in the circle (e.g. a tall glyph vs a
   * wide one). Defaults to 1.
   */
  glyphScale?: number;
  /**
   * For `box` shapes: gray whitespace around the glyph as a fraction of the
   * glyph's own width/height, on each side. Aspect-preserving. `glyphInsetX` may
   * be 0 or negative to run the passage under the side borders to the ports.
   * Both default to 0.
   */
  glyphInsetX?: number;
  glyphInsetY?: number;
  /** When true, the element's ports cannot be repositioned by the user. */
  lockPorts?: boolean;
  /** When true, the element shows the corner resize grip. Defaults to false. */
  resizable?: boolean;
  dynamicPorts: boolean;
  dynamicPortConfig?: DynamicPortConfig;
  /**
   * Whitelist of node types the source may connect to. When omitted or empty,
   * see `disallowedConnections` or fall back to no restriction.
   */
  allowedConnections?: string[];
  /**
   * Blacklist of node types the source may not connect to. Applies only when
   * `allowedConnections` is omitted or empty.
   */
  disallowedConnections?: string[];
}

/** Runtime configuration for a single edge type within a model. */
export interface EdgeConfigEntry {
  customParameters: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
  displayName: string;
  category: string;
}

/** Raw node definition as authored in a model YAML file. */
export interface ModelNodeDefinition {
  displayName: string;
  category: string;
  icon?: string;
  /** Frame the element is drawn in (`rect` | `circle`). Defaults to `rect`. */
  shape?: NodeShape;
  /** Frames the user may switch this element between per instance (UI-only). */
  shapeOptions?: NodeShape[];
  /** For `circle`/`box` shapes: registry key of the glyph drawn inside the frame. */
  glyph?: string;
  /** For `circle` shapes: multiplier on the centred glyph's size. Defaults to 1. */
  glyphScale?: number;
  /** For `box` shapes: gray whitespace around the glyph (fraction of glyph size). */
  glyphInsetX?: number;
  glyphInsetY?: number;
  /** When true, the element's ports cannot be repositioned by the user. */
  lockPorts?: boolean;
  /** When true, the element shows the corner resize grip. Defaults to false. */
  resizable?: boolean;
  dynamicPorts?: boolean;
  dynamicPortConfig?: DynamicPortConfig;
  ports?: NodePorts;
  /**
   * Whitelist of node type ids this element may connect to as the source.
   * Omit or leave empty to skip whitelist mode. Unknown entries fail model load.
   */
  allowedConnections?: string[];
  /**
   * Blacklist of node type ids this element may not connect to as the source.
   * Used when `allowedConnections` is omitted or empty. Unknown entries fail
   * model load.
   */
  disallowedConnections?: string[];
  parameters?: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
}

/** Raw edge definition as authored in a model YAML file. */
export interface ModelEdgeDefinition {
  displayName: string;
  category: string;
  parameters?: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
}

/** A complete model definition parsed from a YAML file. */
export interface ModelDefinition {
  id: string;
  name: string;
  description?: string;
  /**
   * When true, node labels must be unique across the canvas: label edits that
   * collide are rejected and generated labels are disambiguated on add.
   * Defaults to false when omitted.
   */
  forceUniqueNodeLabels?: boolean;
  /**
   * Optional name of a bundled model theme (see types/model-theme.ts). Names a
   * stylesheet the app ships; never carries colour values. Omitted or unknown
   * names fall back to the default theme pair.
   */
  theme?: string;
  /** Model-wide parameters defined in the model YAML file. */
  parameters?: Record<string, Partial<ParameterInfo> & Record<string, unknown>>;
  /**
   * Optional per-category display precedence for parameter sections. Categories
   * listed here sort first, in ascending precedence order (lower appears
   * earlier); any category not listed falls back to alphabetical order. When
   * omitted, all parameter sections sort alphabetically.
   */
  categoryPrecedence?: Record<string, number>;
  /**
   * How the Python console reaches this model's solver, if it has one. Omitted
   * where the model is a drawing only; the console then offers the canvas with
   * nothing to compute it with.
   */
  solver?: ModelSolverDefinition;
  nodes: Record<string, ModelNodeDefinition>;
  edges: Record<string, ModelEdgeDefinition>;
}

/**
 * A model's solver, as the model file declares it.
 *
 * This is what keeps the app free of any particular solver. It knows that a model may
 * name packages, and some Python to reach them by; it knows nothing about what either
 * does. The console calls the adapter's functions, and the adapter is the only place a
 * solver's own names appear.
 */
export interface ModelSolverDefinition {
  /**
   * Packages installed into the console's interpreter, in order. Each is resolved
   * against the app's base, so `wheels/thing.whl` is the usual form; an absolute
   * URL is taken as written.
   */
  packages?: string[];
  /**
   * Python run once when the interpreter starts, adapting the case document to this
   * solver. It is expected to define:
   *
   * - `build(doc)` — a case document in, whatever the solver models it as out;
   * - `results(model, **kwargs)` — that back out as a case document to draw;
   * - `describe()` — optional; one line naming the solver, for the status line.
   */
  adapter?: string;
  /**
   * A second name for `nemo.build()`, suiting what this model models.
   *
   * `build` says what the call does and is always there; a model that works on networks
   * would rather write `nemo.network()`, and one that works on circuits `nemo.circuit()`.
   * Naming it here is what keeps that convenience without the app having to know any of
   * those words. The name carries the adapter's own `build()` documentation, so
   * `help(nemo.network)` describes that model's networks.
   *
   * Must be a Python identifier, and not one of the names the module already answers to.
   * Omitted where `build` reads well enough on its own.
   */
  handle?: string;
  /**
   * A short worked example, shown on an empty prompt and an empty notebook.
   *
   * It belongs to the model because what a first line looks like depends entirely on
   * what the model's solver is: `net.solve()` means nothing to a model that solves
   * nothing. A model that offers none gets the generic lines about reading the canvas,
   * which are true of every model.
   */
  example?: string;
}

/**
 * What a saved case carries beyond the drawing itself.
 *
 * The network, its layout and the annotations are the drawing and always travel. These
 * three are the things a case *can* carry, each of which is useful to someone and heavy
 * to someone else, so each is a choice:
 *
 * - `results` — the result sets loaded on the canvas, so a reopened case is coloured
 *   without solving again. The per-dataset switch in the Data pane still decides which
 *   of them; this decides whether any go at all.
 * - `figures` — the description behind each pinned figure, which is what lets it be
 *   drawn again after reopening: for a theme change, and for an export. Without it the
 *   picture still travels and still exports, but it is fixed in the colours it was
 *   pinned in. A swept figure's description can be a few hundred kilobytes.
 * - `notebook` — the Results tab's source cells. Never its outputs, which belong in a
 *   `.ipynb` export.
 */
export interface SaveContents {
  results: boolean;
  figures: boolean;
  notebook: boolean;
}

/** Everything, which is what a case carries unless told otherwise. */
export const SAVE_CONTENTS_DEFAULTS: SaveContents = {
  results: true,
  figures: true,
  notebook: true,
};

/** Entry in the model manifest used to populate the model selector. */
export interface ModelSummary {
  id: string;
  name: string;
  file: string;
  description?: string;
}

/**
 * A node as stored in the `model` section of the save file. Holds only data
 * required to reconstruct the simulation model (identity, type and the runtime
 * parameter bag), deliberately excluding presentation concerns.
 */
export interface SaveFileModelNode {
  id: string;
  type: string;
  attributes: ParameterValues;
}

/**
 * An edge as stored in the `model` section of the save file. Connection
 * topology plus the runtime parameter bag; no presentation concerns.
 */
export interface SaveFileModelEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  attributes: ParameterValues;
}

/** A node's presentation data, stored separately from its model data. */
export interface SaveFileUiNode {
  id: string;
  position: XYPosition;
  data?: Record<string, unknown>;
}

/**
 * Full save file payload. Model data (the simulation graph) and UI data
 * (presentation) are kept in separate sections, while together they contain
 * everything required for a complete restore.
 */
export interface SaveFilePayload {
  version: string;
  timestamp?: string;
  /** Case-level metadata (e.g. the title shown at the top of the canvas). */
  meta?: {
    title?: string;
  };
  model: {
    /** Id of the model definition (node/edge library) this document targets. */
    id?: string;
    /** Model-wide attributes. Reserved for future use. */
    globalAttributes: Record<string, unknown>;
    nodes: SaveFileModelNode[];
    edges: SaveFileModelEdge[];
  };
  uiAttributes: {
    nodes: SaveFileUiNode[];
  };
  uiState: {
    counters: {
      nodeCounters: Record<string, number>;
      totalNodeCounters: Record<string, number>;
    };
  };
  /**
   * Canvas annotations (notes on the presentation layer). Entirely separate from
   * the model section: annotations are not part of the simulation graph.
   */
  annotations?: SaveFileAnnotation[];
  /** Optional embedded result datasets saved alongside the case. */
  data?: {
    datasets: Dataset[];
  };
  /**
   * The Results-tab notebook, as source cells only. Outputs are the bulk of a notebook
   * and are not a description of the network, so they are left for a `.ipynb` export.
   */
  notebook?: { cells: unknown[] };
}
