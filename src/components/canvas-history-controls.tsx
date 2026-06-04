import React, { memo } from 'react';
import { IoArrowUndoOutline, IoArrowRedoOutline } from 'react-icons/io5';
import { useGraphStore } from '../store/graphStore';

const CanvasHistoryControls = memo(() => {
  const undo = useGraphStore((s) => s.undo);
  const redo = useGraphStore((s) => s.redo);
  const canUndo = useGraphStore((s) => s.past.length > 0);
  const canRedo = useGraphStore((s) => s.future.length > 0);

  return (
    <div className="canvas-history-controls">
      <button
        type="button"
        className="canvas-history-button"
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl/Cmd+Z)"
        aria-label="Undo"
      >
        <IoArrowUndoOutline />
      </button>
      <button
        type="button"
        className="canvas-history-button"
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl/Cmd+Shift+Z)"
        aria-label="Redo"
      >
        <IoArrowRedoOutline />
      </button>
    </div>
  );
});

CanvasHistoryControls.displayName = 'CanvasHistoryControls';

export default CanvasHistoryControls;
