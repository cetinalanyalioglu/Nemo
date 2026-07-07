import React, { useEffect, useRef, useState } from 'react';
import { NodeToolbar, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import {
  MdFormatBold,
  MdFormatItalic,
  MdFormatAlignLeft,
  MdFormatAlignCenter,
  MdFormatAlignRight,
  MdFormatColorReset,
  MdOutlineCheckBoxOutlineBlank,
} from 'react-icons/md';
import { IoTrashOutline } from 'react-icons/io5';
import '../../styles/annotations.css';
import { useGraphStore } from '../../store/graphStore';
import MarkdownContent from '../MarkdownContent';
import { ANNOTATION_FONT_STACKS, ANNOTATION_STYLE_DEFAULTS } from '../../types/annotations';
import type { AnnotationData, AnnotationFont, AnnotationStyle } from '../../types/annotations';

/** Font choices offered by the toolbar's family selector. */
const FONT_OPTIONS: Array<{ value: AnnotationFont; label: string }> = [
  { value: 'default', label: 'Default' },
  { value: 'serif', label: 'Serif' },
  { value: 'mono', label: 'Mono' },
  { value: 'hand', label: 'Hand' },
];

/**
 * A text annotation on the canvas: presentation-layer only, no ports, no model
 * state. The note renders its text as Markdown; double-clicking opens an inline
 * editor for the Markdown source, and selecting the note opens a floating style
 * toolbar (font, size, weight, alignment, colors, border, width) above it.
 */
const AnnotationNode = ({ id, selected, data }: NodeProps) => {
  const annotation = (data?.annotation ?? { text: '', style: {} }) as AnnotationData;
  const updateAnnotation = useGraphStore((s) => s.updateAnnotation);
  const deleteAnnotation = useGraphStore((s) => s.deleteAnnotation);
  const recordHistory = useGraphStore((s) => s.recordHistory);

  // A freshly-dropped note has no text yet; open the editor right away so the
  // user can start typing without an extra double-click.
  const [editing, setEditing] = useState(annotation.text === '');
  const [draft, setDraft] = useState(annotation.text);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      editorRef.current?.focus();
      editorRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(annotation.text);
    setEditing(true);
  };

  const commitText = () => {
    setEditing(false);
    updateAnnotation(id, { text: draft });
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft(annotation.text);
  };

  const patchStyle = (style: AnnotationStyle, options?: { recordHistory?: boolean }) => {
    updateAnnotation(id, { style }, options);
  };

  const style = { ...ANNOTATION_STYLE_DEFAULTS, ...annotation.style };

  const noteCss: React.CSSProperties = {
    fontFamily: ANNOTATION_FONT_STACKS[style.fontFamily],
    fontSize: `${style.fontSize}px`,
    fontWeight: style.bold ? 600 : 400,
    fontStyle: style.italic ? 'italic' : 'normal',
    textAlign: style.align,
    ...(annotation.style.color ? { color: annotation.style.color } : {}),
    ...(annotation.style.background ? { background: annotation.style.background } : {}),
    ...(annotation.style.width ? { width: `${annotation.style.width}px` } : {}),
  };

  const noteClasses = [
    'annotation-node',
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

  return (
    <>
      <NodeToolbar isVisible={selected && !editing} position={Position.Top}>
        <div className="annotation-toolbar nodrag">
          <select
            className="annotation-tool annotation-tool-font"
            value={style.fontFamily}
            title="Font"
            onChange={(e) => patchStyle({ fontFamily: e.target.value as AnnotationFont })}
          >
            {FONT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="annotation-tool annotation-tool-number"
            type="number"
            min={8}
            max={96}
            step={1}
            value={style.fontSize}
            title="Font size (px)"
            onChange={(e) => {
              const size = Number(e.target.value);
              if (Number.isFinite(size) && size > 0) patchStyle({ fontSize: size });
            }}
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
          {/* Color pickers write without history on each input tick; the gesture
              records once on pointer-down so a drag is a single undo step. */}
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
              onChange={(e) => patchStyle({ background: e.target.value }, { recordHistory: false })}
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
          <button
            type="button"
            className={`annotation-tool${style.border ? ' active' : ''}`}
            title="Border"
            onClick={() => patchStyle({ border: !style.border })}
          >
            <MdOutlineCheckBoxOutlineBlank />
          </button>
          <span className="annotation-toolbar-divider" />
          <input
            className="annotation-tool annotation-tool-number annotation-tool-width"
            type="number"
            min={40}
            step={10}
            placeholder="auto"
            value={annotation.style.width ?? ''}
            title="Width (px); clear for automatic"
            onChange={(e) => {
              const width = e.target.value === '' ? undefined : Number(e.target.value);
              if (width === undefined || (Number.isFinite(width) && width > 0)) {
                patchStyle({ width });
              }
            }}
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
        </div>
      </NodeToolbar>

      <div className={noteClasses} style={noteCss} onDoubleClick={startEditing}>
        {editing ? (
          <textarea
            ref={editorRef}
            className="annotation-editor nodrag"
            value={draft}
            placeholder="Write a note (Markdown supported)…"
            rows={Math.max(2, draft.split('\n').length)}
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
