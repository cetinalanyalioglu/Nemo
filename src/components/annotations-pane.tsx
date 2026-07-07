import React, { useMemo, useRef } from 'react';
import {
  IoChevronBackCircleOutline,
  IoChevronDown,
  IoImageOutline,
  IoPencilOutline,
  IoTextOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import '../styles/sidebar.css';
import '../styles/annotations.css';
import { useAppState } from '../context/AppStateContext';
import { useGraphStore } from '../store/graphStore';
import { useReactFlow } from '../context/ReactFlowContext';
import { ANNOTATION_IMAGE_ACCEPT, readAnnotationImage } from '../utils/annotation-images';
import { logger } from '../utils/logger';
import { ANNOTATION_NODE_TYPE } from '../types/annotations';
import type { AnnotationData } from '../types/annotations';

const ADD_GROUP = '__annotations_add__';
const NOTES_GROUP = '__annotations_notes__';

/** MIME type carried by a palette drag that drops a new annotation. */
export const ANNOTATION_DRAG_MIME = 'application/fnetlibui-annotation';

/** First non-empty line of the note, Markdown markers stripped, for the list. */
const previewText = (text: string): string => {
  const line = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!line) return '(empty note)';
  return line.replace(/^#{1,6}\s+/, '').replace(/[*_`>]/g, '');
};

/**
 * Left panel for the canvas annotation layer. Everything annotation-related is
 * driven from here: adding notes (drag the chip onto the canvas, or click to
 * drop one at the viewport centre) and an overview list of the existing notes
 * (click to select and centre; trash to delete). Styling happens on the canvas
 * via the note's floating toolbar.
 */
const AnnotationsPane = React.memo(() => {
  const {
    sidebar: { isOpen, collapsedGroups },
    actions,
  } = useAppState();
  const { reactFlowInstance } = useReactFlow();
  const nodes = useGraphStore((s) => s.nodes);
  const addAnnotation = useGraphStore((s) => s.addAnnotation);
  const deleteAnnotation = useGraphStore((s) => s.deleteAnnotation);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);

  const annotations = useMemo(() => nodes.filter((n) => n.type === ANNOTATION_NODE_TYPE), [nodes]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData(ANNOTATION_DRAG_MIME, 'text');
    event.dataTransfer.effectAllowed = 'move';
  };

  const viewportCenter = () =>
    reactFlowInstance
      ? reactFlowInstance.screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
      : { x: 0, y: 0 };

  const addAtViewportCenter = () => {
    addAnnotation({ position: viewportCenter() });
  };

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const { src, width } = await readAnnotationImage(file);
      addAnnotation({ position: viewportCenter(), kind: 'image', src, style: { width } });
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
    }
  };

  const focusAnnotation = (id: string) => {
    const node = annotations.find((n) => n.id === id);
    if (!node) return;
    // Select the note (deselecting everything else) so its toolbar shows, and
    // bring it into view.
    onNodesChange(nodes.map((n) => ({ type: 'select' as const, id: n.id, selected: n.id === id })));
    reactFlowInstance?.setCenter(node.position.x, node.position.y, {
      zoom: Math.max(1, reactFlowInstance.getZoom()),
      duration: 300,
    });
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="panel-icon-wrapper">
          <IoPencilOutline className="panel-icon" />
          <span className="panel-title">ANNOTATIONS</span>
        </div>
        <IoChevronBackCircleOutline
          className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
          onClick={() => actions.sidebar.toggle()}
        />
      </div>

      <div className={`elements-group ${collapsedGroups[ADD_GROUP] ? 'collapsed' : ''}`}>
        <div className="group-header" onClick={() => actions.sidebar.toggleGroup(ADD_GROUP)}>
          <div className="group-header-content">
            <span>ADD</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div className={`group-content ${collapsedGroups[ADD_GROUP] ? 'collapsed' : ''}`}>
          <div
            className="annotation-add-chip"
            draggable
            onDragStart={onDragStart}
            onClick={addAtViewportCenter}
            title="Drag onto the canvas, or click to add at the viewport centre"
          >
            <IoTextOutline className="annotation-add-chip-icon" />
            <span>Text</span>
          </div>
          <input
            type="file"
            ref={imageInputRef}
            accept={ANNOTATION_IMAGE_ACCEPT}
            onChange={handleImageSelect}
            className="file-input-hidden"
          />
          <div
            className="annotation-add-chip"
            onClick={() => imageInputRef.current?.click()}
            title="Upload an image (PNG, JPEG, GIF, WebP, SVG); you can also drop an image file onto the canvas"
          >
            <IoImageOutline className="annotation-add-chip-icon" />
            <span>Image</span>
          </div>
          <p className="annotation-pane-hint">
            Notes support Markdown. Double-click a note to edit it; select it to style it from the
            toolbar. Images (PNG with transparency, JPEG, GIF, WebP, SVG) can also be dropped onto
            the canvas straight from your file manager. Annotations are independent of the model and
            are saved with the document.
          </p>
        </div>
      </div>

      <div className={`elements-group ${collapsedGroups[NOTES_GROUP] ? 'collapsed' : ''}`}>
        <div className="group-header" onClick={() => actions.sidebar.toggleGroup(NOTES_GROUP)}>
          <div className="group-header-content">
            <span>NOTES</span>
            <IoChevronDown className="group-collapse-icon" />
          </div>
        </div>
        <div className={`group-content ${collapsedGroups[NOTES_GROUP] ? 'collapsed' : ''}`}>
          {annotations.length === 0 ? (
            <p className="annotation-pane-empty">No annotations yet.</p>
          ) : (
            <ul className="annotation-list">
              {annotations.map((node) => {
                const annotation = (node.data?.annotation ?? {
                  text: '',
                  style: {},
                }) as AnnotationData;
                const isImage = annotation.kind === 'image';
                return (
                  <li
                    key={node.id}
                    className="annotation-list-row"
                    onClick={() => focusAnnotation(node.id)}
                    title="Click to select and centre this note"
                  >
                    {isImage ? (
                      <IoImageOutline className="annotation-list-icon" />
                    ) : (
                      <IoTextOutline className="annotation-list-icon" />
                    )}
                    <span className="annotation-list-text">
                      {isImage ? '(image)' : previewText(annotation.text)}
                    </span>
                    <button
                      type="button"
                      className="annotation-list-delete"
                      title="Delete this note"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnnotation(node.id);
                      }}
                    >
                      <IoTrashOutline />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
});

AnnotationsPane.displayName = 'AnnotationsPane';

export default AnnotationsPane;
