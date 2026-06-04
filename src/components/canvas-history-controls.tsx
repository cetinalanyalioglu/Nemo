import React, { memo } from 'react';
import { IoArrowUndoOutline, IoArrowRedoOutline } from 'react-icons/io5';
import { useNodeContext } from '../context/NodeContext';

const CanvasHistoryControls = memo(() => {
  const { undo, redo, canUndo, canRedo } = useNodeContext();

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
