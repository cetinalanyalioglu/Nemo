import type { XYPosition } from 'reactflow';

/**
 * Canvas annotations: free-floating notes that live on their own presentation
 * layer, entirely outside the solver model. They share the canvas (pan, zoom,
 * drag, undo) with the network but are excluded from the model section of save
 * files, from index generation and from validity checks; a locked canvas still
 * allows adding, editing and deleting them.
 *
 * `kind` is `text` today; the schema deliberately leaves room for future kinds
 * (shapes, imported images) under the same `annotations` save-file section.
 */

/** Reserved React Flow node type for annotation nodes. */
export const ANNOTATION_NODE_TYPE = 'annotation';

/** What an annotation shows: a Markdown text note or an uploaded image. */
export type AnnotationKind = 'text' | 'image';

/**
 * Where the annotation sits relative to the model layer: `front` draws over the
 * network, `back` behind it (e.g. a background image or a region label).
 */
export type AnnotationLayer = 'front' | 'back';

/**
 * Node `zIndex` for each annotation layer; model elements sit at 0. React Flow
 * elevates a selected node by +1000, so `back` is deeper than -1000: a
 * back-layer annotation stays behind the model even while selected, making the
 * layer toggle take effect instantly.
 */
export const ANNOTATION_LAYER_Z: Record<AnnotationLayer, number> = { front: 1, back: -1500 };

export type AnnotationAlign = 'left' | 'center' | 'right';

/** Named font choices offered by the annotation toolbar, resolved via
    {@link ANNOTATION_FONT_STACKS}. */
export type AnnotationFont = 'default' | 'serif' | 'mono' | 'hand';

/**
 * Visual style of a text annotation. Every field is optional: unset fields fall
 * back to {@link ANNOTATION_STYLE_DEFAULTS} (or the theme, for colors), and only
 * explicitly-set fields are persisted, so save files stay minimal.
 */
export interface AnnotationStyle {
  fontFamily?: AnnotationFont;
  /** Font size in px (at zoom 1). */
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: AnnotationAlign;
  /** Text color (any CSS color). Unset inherits the theme text color. */
  color?: string;
  /** Background color. Unset renders transparent. */
  background?: string;
  /** When true, draws a subtle rounded border around the note. */
  border?: boolean;
  /** Fixed width in px; unset sizes to the content (up to a max width). */
  width?: number;
  /** Fixed height in px (`text` kind); unset sizes to the content. */
  height?: number;
}

/** Runtime payload stored in an annotation node's `data.annotation`. */
export interface AnnotationData {
  /** What the annotation shows. Defaults to `text` when absent. */
  kind?: AnnotationKind;
  /** Markdown source of the note (`text` kind). */
  text: string;
  style: AnnotationStyle;
  /** Image content as a data URI (`image` kind). */
  src?: string;
  /** Stacking relative to the model layer. Defaults to `front`. */
  layer?: AnnotationLayer;
}

/** Defaults applied wherever a style field is unset. */
export const ANNOTATION_STYLE_DEFAULTS = {
  fontFamily: 'default' as AnnotationFont,
  fontSize: 14,
  bold: false,
  italic: false,
  align: 'left' as AnnotationAlign,
  border: false,
};

/** CSS font stacks behind the named font choices. */
export const ANNOTATION_FONT_STACKS: Record<AnnotationFont, string> = {
  default: 'inherit',
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, 'Cascadia Code', Consolas, 'Courier New', monospace",
  hand: "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive",
};

/** An annotation as stored in the save file's top-level `annotations` section. */
export interface SaveFileAnnotation {
  id: string;
  kind: AnnotationKind;
  position: XYPosition;
  /** Markdown source of the note (`text` kind). */
  text?: string;
  /** Image content as a data URI (`image` kind). */
  src?: string;
  /** Stacking relative to the model layer; omitted when `front` (the default). */
  layer?: AnnotationLayer;
  /** Only explicitly-set style fields; omitted entirely when all are default. */
  style?: AnnotationStyle;
}
