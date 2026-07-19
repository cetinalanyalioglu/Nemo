import React, { useEffect, useRef, useState } from 'react';
import { NodeToolbar, Position, useReactFlow } from 'reactflow';
import type { NodeProps } from 'reactflow';
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatAlignLeft,
  MdFormatAlignCenter,
  MdFormatAlignRight,
  MdFormatColorReset,
  MdFlipToBack,
  MdFlipToFront,
} from 'react-icons/md';
import { IoAdd, IoRemove, IoSquareOutline, IoTrashOutline } from 'react-icons/io5';
import '../../styles/annotations.css';
import { useRotationState } from '../../context/AppStateContext';
import { useGraphStore } from '../../store/graphStore';
import MarkdownContent from '../MarkdownContent';
import { ANNOTATION_FONT_STACKS, ANNOTATION_STYLE_DEFAULTS } from '../../types/annotations';
import type {
  AnnotationData,
  AnnotationFont,
  AnnotationLayer,
  AnnotationStyle,
} from '../../types/annotations';

/** Font choices offered by the toolbar's family selector. */
const FONT_OPTIONS: Array<{ value: AnnotationFont; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
  { value: 'hand', label: 'Hand' },
];

/** Fallback display width (px) for an image annotation without an explicit one. */
const DEFAULT_IMAGE_WIDTH = 240;

/**
 * `<input type="color">` only accepts `#rrggbb`, but an unstyled note inherits
 * its color from the theme, which `getComputedStyle` reports as `rgb(…)`.
 * Converts so the picker opens on the color the note actually shows instead of
 * a hardcoded gray that matches neither theme.
 */
function rgbToHex(value: string): string | null {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!m) return null;
  const hex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`;
}

/**
 * Stacking of the floating style toolbar. React Flow gives the toolbar the
 * selected node's z-index + 1, which for a back-layer annotation is deeply
 * negative: the toolbar would render behind the pane and stop taking clicks.
 * A fixed positive value keeps it interactive regardless of the note's layer.
 */
const TOOLBAR_Z_INDEX = 1200;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

interface StepperInputProps {
  value: number | undefined;
  /** Base the +/- buttons step from when `value` is unset. */
  fallback: number;
  min: number;
  max: number;
  step: number;
  /** When true, committing an empty field clears the value (back to automatic). */
  allowEmpty?: boolean;
  placeholder?: string;
  title: string;
  onCommit: (value: number | undefined) => void;
}

/**
 * Compact numeric field for the annotation toolbar, mirroring the properties
 * panel's pattern: a plain text input (native number spinners are hidden
 * app-wide and auto-repeat badly inside a re-rendering toolbar) with explicit
 * +/- buttons that step once per click. Typed values commit on blur/Enter.
 */
const StepperInput = ({
  value,
  fallback,
  min,
  max,
  step,
  allowEmpty = false,
  placeholder,
  title,
  onCommit,
}: StepperInputProps) => {
  const [draft, setDraft] = useState<string | null>(null);

  const commitDraft = () => {
    if (draft === null) return;
    const trimmed = draft.trim();
    setDraft(null);
    if (trimmed === '') {
      if (allowEmpty) onCommit(undefined);
      return;
    }
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) onCommit(clamp(parsed, min, max));
  };

  const nudge = (direction: 1 | -1) => {
    setDraft(null);
    onCommit(clamp((value ?? fallback) + direction * step, min, max));
  };

  return (
    <span className="annotation-stepper" title={title}>
      <input
        type="text"
        inputMode="numeric"
        className="annotation-stepper-input"
        value={draft ?? (value !== undefined ? String(value) : '')}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitDraft();
        }}
      />
      <span className="annotation-stepper-controls">
        <button type="button" tabIndex={-1} aria-label="Increase" onClick={() => nudge(1)}>
          <IoAdd />
        </button>
        <button type="button" tabIndex={-1} aria-label="Decrease" onClick={() => nudge(-1)}>
          <IoRemove />
        </button>
      </span>
    </span>
  );
};

/**
 * An annotation on the canvas: presentation-layer only, no ports, no model
 * state. A `text` annotation renders Markdown (double-click opens the inline
 * source editor); an `image` annotation shows an uploaded picture with a corner
 * grip for scaling. Selecting either opens a floating style toolbar, including
 * front/back stacking relative to the model layer.
 */
const AnnotationNode = ({ id, selected, data }: NodeProps) => {
  const annotation = (data?.annotation ?? { text: '', style: {} }) as AnnotationData;
  const kind = annotation.kind ?? 'text';
  const layer = annotation.layer ?? 'front';
  const rotation = annotation.rotation ?? 0;
  const updateAnnotation = useGraphStore((s) => s.updateAnnotation);
  const deleteAnnotation = useGraphStore((s) => s.deleteAnnotation);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const { getZoom } = useReactFlow();
  const { snap: rotationSnap, increment: rotationIncrement } = useRotationState();

  const noteRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // True while the pointer hovers the note with Alt held: the cursor turns into
  // a rotate arrow and a drag rotates instead of moving the node.
  const [rotateIntent, setRotateIntent] = useState(false);

  // A freshly-dropped text note has no text yet; open the editor right away so
  // the user can start typing without an extra double-click.
  const [editing, setEditing] = useState(kind === 'text' && annotation.text === '');
  const [draft, setDraft] = useState(annotation.text);
  // Rendered size captured when the editor opens, so swapping the Markdown for
  // the textarea doesn't change the note's footprint.
  const [editSize, setEditSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (editing) {
      editorRef.current?.focus();
      editorRef.current?.select();
    }
  }, [editing]);

  // Grow the editor to fit its source on every keystroke, so it never scrolls.
  // Reset to `auto` first or scrollHeight can only ever ratchet upwards.
  useEffect(() => {
    const el = editorRef.current;
    if (!editing || !el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [editing, draft]);

  // Tracks the Alt-hover combination that arms rotate-mode (same gesture as the
  // model elements). Key listeners attach only while the pointer is over this
  // note, so a canvas full of annotations doesn't stack window-level handlers.
  useEffect(() => {
    const el = noteRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => setRotateIntent(e.altKey);
    const onEnter = (e: MouseEvent) => {
      setRotateIntent(e.altKey);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
    };
    const onLeave = () => {
      setRotateIntent(false);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  const startEditing = () => {
    if (kind !== 'text') return;
    const el = noteRef.current;
    if (el) setEditSize({ w: el.offsetWidth, h: el.offsetHeight });
    setDraft(annotation.text);
    setEditing(true);
  };

  const commitText = () => {
    setEditing(false);
    setEditSize(null);
    updateAnnotation(id, { text: draft });
  };

  const cancelEditing = () => {
    setEditing(false);
    setEditSize(null);
    setDraft(annotation.text);
  };

  const patchStyle = (style: AnnotationStyle, options?: { recordHistory?: boolean }) => {
    updateAnnotation(id, { style }, options);
  };

  const setLayer = (next: AnnotationLayer) => updateAnnotation(id, { layer: next });

  // Projects a screen-space drag onto the note's local (possibly rotated) axes
  // so resize gestures still track the grip after the note has been rotated.
  const projectDelta = (dx: number, dy: number): { x: number; y: number } => {
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
  };

  // Corner-grip scaling for image annotations: one history record per gesture,
  // width tracked in flow units (screen delta divided by zoom), aspect free.
  const handleImageResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth =
      annotation.style.width ?? noteRef.current?.offsetWidth ?? DEFAULT_IMAGE_WIDTH;
    const zoom = getZoom();
    let hasRecorded = false;
    const onMove = (ev: PointerEvent) => {
      if (!hasRecorded) {
        recordHistory();
        hasRecorded = true;
      }
      const delta = projectDelta(ev.clientX - startX, ev.clientY - startY);
      const width = Math.round(clamp(startWidth + delta.x / zoom, 24, 4000));
      updateAnnotation(id, { style: { width } }, { recordHistory: false });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Edge stretchers of a text note: dragging the right bar sets an explicit
  // width, the bottom bar an explicit height; one history record per gesture.
  const handleStretchStart =
    (axis: 'width' | 'height') => (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const el = noteRef.current;
      if (!el) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const startSize = axis === 'width' ? el.offsetWidth : el.offsetHeight;
      const minSize = axis === 'width' ? 40 : 20;
      const zoom = getZoom();
      let hasRecorded = false;
      const onMove = (ev: PointerEvent) => {
        if (!hasRecorded) {
          recordHistory();
          hasRecorded = true;
        }
        const delta = projectDelta(ev.clientX - startX, ev.clientY - startY);
        const along = axis === 'width' ? delta.x : delta.y;
        const size = Math.round(clamp(startSize + along / zoom, minSize, 4000));
        updateAnnotation(id, { style: { [axis]: size } }, { recordHistory: false });
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

  // Alt-drag anywhere on the note rotates it about its centre, mirroring the
  // model elements' gesture (including the snap settings, with Shift inverting
  // the choice for the duration of the drag).
  const handleRotateStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = noteRef.current?.getBoundingClientRect();
    if (!rect) return;
    // The centre is invariant under the rotation itself, so the pivot captured
    // here stays valid for the whole gesture.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startPointerAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    const startRotation = rotation;
    let hasRecorded = false;
    const onMove = (ev: PointerEvent) => {
      if (!hasRecorded) {
        recordHistory();
        hasRecorded = true;
      }
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let degrees = startRotation + ((angle - startPointerAngle) * 180) / Math.PI;
      const shouldSnap = rotationSnap !== ev.shiftKey;
      if (shouldSnap && rotationIncrement > 0) {
        degrees = Math.round(degrees / rotationIncrement) * rotationIncrement;
      }
      updateAnnotation(id, { rotation: degrees }, { recordHistory: false });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  /** True when the event originated on a child that owns its own gestures. */
  const isGestureExempt = (target: EventTarget | null) =>
    target instanceof Element &&
    !!target.closest('.annotation-stretch, .resize-handle, .annotation-editor');

  // Runs in the capture phase and swallows the event so React Flow doesn't also
  // start a node drag; the stretchers, the image grip, and the editor keep
  // their own gestures.
  const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.altKey || editing || isGestureExempt(e.target)) return;
    handleRotateStart(e);
  };

  // Double-click edits the text; with Alt held it restores the upright
  // orientation instead (both kinds).
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.altKey) {
      e.stopPropagation();
      updateAnnotation(id, { rotation: 0 });
      return;
    }
    startEditing();
  };

  // Double-clicking a stretcher clears its dimension: back to content-sizing in
  // that direction. Swallow the event so it doesn't open the text editor.
  const handleStretchAutoSize = (axis: 'width' | 'height') => (e: React.MouseEvent) => {
    e.stopPropagation();
    updateAnnotation(id, { style: { [axis]: undefined } });
  };

  const style = { ...ANNOTATION_STYLE_DEFAULTS, ...annotation.style };

  // Seed for the text-color picker. An unset color renders as the inherited
  // theme ink, so read it back off the live note rather than guessing; the read
  // happens only while the toolbar is mounted (i.e. the note is selected).
  const inheritedColor =
    (selected && noteRef.current && rgbToHex(getComputedStyle(noteRef.current).color)) || '#6c757d';

  const noteCss: React.CSSProperties =
    kind === 'image'
      ? {
          width: `${annotation.style.width ?? DEFAULT_IMAGE_WIDTH}px`,
          ...(annotation.style.background ? { background: annotation.style.background } : {}),
        }
      : {
          fontFamily: ANNOTATION_FONT_STACKS[style.fontFamily],
          fontSize: `${style.fontSize}px`,
          fontWeight: style.bold ? 600 : 400,
          fontStyle: style.italic ? 'italic' : 'normal',
          textAlign: style.align,
          ...(annotation.style.color ? { color: annotation.style.color } : {}),
          ...(annotation.style.background ? { background: annotation.style.background } : {}),
          // An explicit width overrides the default wrap cap (max-width), which
          // otherwise silently clamps the note past ~420px however far it's dragged.
          ...(annotation.style.width
            ? { width: `${annotation.style.width}px`, maxWidth: 'none' }
            : {}),
          // A fixed height clips overflowing content instead of spilling it.
          ...(annotation.style.height
            ? { height: `${annotation.style.height}px`, overflow: 'hidden' }
            : {}),
          // While editing, hold the width so the wrap point (and so the whole
          // footprint) doesn't jump, but let the height follow the source: the
          // rendered height is only a floor, so a note never shrinks on open and
          // grows only when the raw Markdown genuinely needs more room. Any
          // fixed height set by stretching is released here for the same reason
          // — clipping the text being edited would hide it outright.
          ...(editing && editSize
            ? {
                width: `${editSize.w}px`,
                height: 'auto',
                minHeight: `${editSize.h}px`,
                overflow: 'visible',
              }
            : {}),
        };
  if (rotation) noteCss.transform = `rotate(${rotation}deg)`;

  const noteClasses = [
    'annotation-node',
    kind === 'image' ? 'annotation-node--image' : '',
    style.border ? 'annotation-node--border' : '',
    selected ? 'annotation-node--selected' : '',
    editing ? 'annotation-node--editing' : '',
    rotateIntent && !editing ? 'annotation-node--rotate' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const alignButton = (align: AnnotationStyle['align'], Icon: typeof MdFormatAlignLeft) => (
    <button
      type="button"
      className={`annotation-tool${style.align === align ? ' active' : ''}`}
      title={`Align ${align}`}
      onClick={() => patchStyle({ align })}
    >
      <Icon />
    </button>
  );

  const layerControls = (
    <>
      <button
        type="button"
        className={`annotation-tool${layer === 'front' ? ' active' : ''}`}
        title="Draw above the model layer"
        onClick={() => setLayer('front')}
      >
        <MdFlipToFront />
      </button>
      <button
        type="button"
        className={`annotation-tool${layer === 'back' ? ' active' : ''}`}
        title="Draw behind the model layer"
        onClick={() => setLayer('back')}
      >
        <MdFlipToBack />
      </button>
    </>
  );

  const commonTail = (
    <>
      <button
        type="button"
        className={`annotation-tool${style.border ? ' active' : ''}`}
        title="Border"
        onClick={() => patchStyle({ border: !style.border })}
      >
        <IoSquareOutline />
      </button>
      <span className="annotation-toolbar-divider" />
      <StepperInput
        value={annotation.style.width}
        fallback={kind === 'image' ? (annotation.style.width ?? DEFAULT_IMAGE_WIDTH) : 200}
        min={24}
        max={4000}
        step={10}
        allowEmpty={kind === 'text'}
        placeholder="auto"
        title={kind === 'text' ? 'Width (px); clear for automatic' : 'Width (px)'}
        onCommit={(width) => patchStyle({ width })}
      />
      <span className="annotation-toolbar-divider" />
      <button
        type="button"
        className="annotation-tool annotation-tool-danger"
        title="Delete annotation"
        onClick={() => deleteAnnotation(id)}
      >
        <IoTrashOutline />
      </button>
    </>
  );

  return (
    <>
      {/*
        `nopan`, not `nodrag`. NodeToolbar portals its children into
        `.react-flow__renderer`, so the toolbar is not a descendant of this
        node's wrapper and `nodrag` never applies to it. That renderer div is
        the pan surface, so without `nopan` a drag anywhere on the toolbar --
        its padding, gaps, or dividers -- pans the viewport. Because the note
        is anchored in canvas space it tracks the pointer 1:1, which reads as
        dragging the note itself. The class goes on NodeToolbar so it lands on
        the positioned wrapper and covers the whole hit area.
      */}
      <NodeToolbar
        className="nopan"
        isVisible={selected && !editing}
        position={Position.Top}
        style={{ zIndex: TOOLBAR_Z_INDEX }}
      >
        <div className="annotation-toolbar">
          {kind === 'text' && (
            <>
              <select
                className="annotation-tool annotation-tool-font"
                value={style.fontFamily}
                title="Font"
                onChange={(e) =>
                  updateAnnotation(id, { style: { fontFamily: e.target.value as AnnotationFont } })
                }
              >
                {FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <StepperInput
                value={style.fontSize}
                fallback={ANNOTATION_STYLE_DEFAULTS.fontSize}
                min={8}
                max={96}
                step={1}
                title="Font size (px)"
                onCommit={(fontSize) => patchStyle({ fontSize })}
              />
              <span className="annotation-toolbar-divider" />
              <button
                type="button"
                className={`annotation-tool${style.bold ? ' active' : ''}`}
                title="Bold"
                onClick={() => patchStyle({ bold: !style.bold })}
              >
                <MdFormatBold />
              </button>
              <button
                type="button"
                className={`annotation-tool${style.italic ? ' active' : ''}`}
                title="Italic"
                onClick={() => patchStyle({ italic: !style.italic })}
              >
                <MdFormatItalic />
              </button>
              <span className="annotation-toolbar-divider" />
              {alignButton('left', MdFormatAlignLeft)}
              {alignButton('center', MdFormatAlignCenter)}
              {alignButton('right', MdFormatAlignRight)}
              <span className="annotation-toolbar-divider" />
              {/* Color pickers write without history on each input tick; the
                  gesture records once on pointer-down so a drag is one undo step. */}
              <label className="annotation-tool annotation-tool-color" title="Text color">
                <span className="annotation-tool-color-label">A</span>
                <input
                  type="color"
                  value={annotation.style.color ?? inheritedColor}
                  onPointerDown={() => recordHistory()}
                  onChange={(e) => patchStyle({ color: e.target.value }, { recordHistory: false })}
                />
              </label>
              <label className="annotation-tool annotation-tool-color" title="Background color">
                <span
                  className="annotation-tool-color-swatch"
                  style={{ background: annotation.style.background ?? 'transparent' }}
                />
                <input
                  type="color"
                  value={annotation.style.background ?? '#ffffff'}
                  onPointerDown={() => recordHistory()}
                  onChange={(e) =>
                    patchStyle({ background: e.target.value }, { recordHistory: false })
                  }
                />
              </label>
              <button
                type="button"
                className="annotation-tool"
                title="Reset colors to the theme defaults"
                onClick={() => patchStyle({ color: undefined, background: undefined })}
              >
                <MdFormatColorReset />
              </button>
              <span className="annotation-toolbar-divider" />
            </>
          )}
          {layerControls}
          <span className="annotation-toolbar-divider" />
          {commonTail}
        </div>
      </NodeToolbar>

      <div
        className={noteClasses}
        style={noteCss}
        ref={noteRef}
        onDoubleClick={handleDoubleClick}
        onPointerDownCapture={handlePointerDownCapture}
      >
        {kind === 'image' ? (
          <>
            <img className="annotation-image" src={annotation.src} alt="" draggable={false} />
            {selected && (
              <div
                className="resize-handle nodrag"
                title="Drag to scale"
                onPointerDown={handleImageResizeStart}
              />
            )}
          </>
        ) : editing ? (
          <textarea
            ref={editorRef}
            className="annotation-editor nodrag"
            // A fresh note has no measured size to freeze, so give the editor a
            // workable minimum; an existing note keeps its exact footprint.
            style={editSize ? undefined : { minWidth: 200, minHeight: 52 }}
            value={draft}
            placeholder="Write a note…"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                cancelEditing();
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commitText();
            }}
          />
        ) : annotation.text ? (
          <div className="annotation-content">
            <MarkdownContent text={annotation.text} />
          </div>
        ) : (
          <div className="annotation-placeholder">Double-click to edit…</div>
        )}
        {kind === 'text' && selected && !editing && (
          <>
            <div
              className="annotation-stretch annotation-stretch-h nodrag"
              title="Drag to set the width • double-click to autosize"
              onPointerDown={handleStretchStart('width')}
              onDoubleClick={handleStretchAutoSize('width')}
            />
            <div
              className="annotation-stretch annotation-stretch-v nodrag"
              title="Drag to set the height • double-click to autosize"
              onPointerDown={handleStretchStart('height')}
              onDoubleClick={handleStretchAutoSize('height')}
            />
          </>
        )}
      </div>
    </>
  );
};

export default React.memo(AnnotationNode);
