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
  const updateAnnotation = useGraphStore((s) => s.updateAnnotation);
  const deleteAnnotation = useGraphStore((s) => s.deleteAnnotation);
  const recordHistory = useGraphStore((s) => s.recordHistory);
  const { getZoom } = useReactFlow();

  const noteRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

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

  // Corner-grip scaling for image annotations: one history record per gesture,
  // width tracked in flow units (screen delta divided by zoom), aspect free.
  const handleImageResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startWidth =
      annotation.style.width ?? noteRef.current?.offsetWidth ?? DEFAULT_IMAGE_WIDTH;
    const zoom = getZoom();
    let hasRecorded = false;
    const onMove = (ev: PointerEvent) => {
      if (!hasRecorded) {
        recordHistory();
        hasRecorded = true;
      }
      const width = Math.round(clamp(startWidth + (ev.clientX - startX) / zoom, 24, 4000));
      updateAnnotation(id, { style: { width } }, { recordHistory: false });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const style = { ...ANNOTATION_STYLE_DEFAULTS, ...annotation.style };

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
          ...(annotation.style.width ? { width: `${annotation.style.width}px` } : {}),
          // While editing, freeze the note at its rendered size so the editor
          // swap doesn't resize the node.
          ...(editing && editSize ? { width: `${editSize.w}px`, height: `${editSize.h}px` } : {}),
        };

  const noteClasses = [
    'annotation-node',
    kind === 'image' ? 'annotation-node--image' : '',
    style.border ? 'annotation-node--border' : '',
    selected ? 'annotation-node--selected' : '',
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
      <NodeToolbar isVisible={selected && !editing} position={Position.Top}>
        <div className="annotation-toolbar nodrag">
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
                  value={annotation.style.color ?? '#808080'}
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

      <div className={noteClasses} style={noteCss} ref={noteRef} onDoubleClick={startEditing}>
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
            value={draft}
            placeholder="Write a note (Markdown supported)…"
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
      </div>
    </>
  );
};

export default React.memo(AnnotationNode);
