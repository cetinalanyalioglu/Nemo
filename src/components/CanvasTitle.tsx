import { memo, useEffect, useRef, useState } from 'react';
import { Panel } from 'reactflow';
import '../styles/canvas-title.css';
import { useGraphStore, DEFAULT_CASE_TITLE } from '../store/graphStore';

/**
 * Subtle case-title overlay centered at the top of the canvas. Click to rename
 * inline; Enter/blur commits, Escape cancels. An empty title falls back to the
 * default so the canvas always shows something.
 */
const CanvasTitle = memo(() => {
  const title = useGraphStore((s) => s.title);
  const setTitle = useGraphStore((s) => s.setTitle);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const start = () => {
    setDraft(title);
    setEditing(true);
  };

  const commit = () => {
    const next = draft.trim();
    setTitle(next.length > 0 ? next : DEFAULT_CASE_TITLE);
    setEditing(false);
  };

  return (
    <Panel position="top-center" className="canvas-title">
      {editing ? (
        <input
          ref={inputRef}
          className="canvas-title-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
          aria-label="Case title"
        />
      ) : (
        <button
          type="button"
          className="canvas-title-label"
          onClick={start}
          title="Click to rename this case"
        >
          {title}
        </button>
      )}
    </Panel>
  );
});

CanvasTitle.displayName = 'CanvasTitle';

export default CanvasTitle;
