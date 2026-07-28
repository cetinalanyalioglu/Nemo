import React, { useCallback, useState } from 'react';
import {
  IoArrowDownOutline,
  IoArrowUpOutline,
  IoCloseOutline,
  IoPlayOutline,
  IoPricetagOutline,
} from 'react-icons/io5';
import { pinOutputToCanvas } from '../../python/pin-figure';
import { useNotebookStore } from '../../store/notebookStore';
import { joinLines, type CellRunState, type NotebookCell } from '../../types/notebook';
import MarkdownContent from '../MarkdownContent';
import CellEditor from './CellEditor';
import CellOutputView, { isPinnable } from './CellOutputView';

/**
 * One cell: what was written, and what running it produced.
 *
 * A markdown cell shows its prose until it is clicked into, which is how a notebook
 * reads rather than how a form behaves. A code cell keeps its editor open and its
 * outputs beneath, each of which can be pinned to the canvas when it is something to
 * look at.
 */

/** The marker beside a cell, saying where it stands with the interpreter. */
const RUN_MARK: Record<CellRunState, string> = {
  idle: '[ ]',
  queued: '[*]',
  running: '[*]',
  done: '',
  failed: '[!]',
};

interface NotebookCellViewProps {
  cell: NotebookCell;
  state: CellRunState;
  selected: boolean;
}

const NotebookCellView = React.memo(({ cell, state, selected }: NotebookCellViewProps) => {
  const { select, setSource, setKind, removeCell, moveCell, runCell, addCell } =
    useNotebookStore.getState();
  // A markdown cell reads as prose and edits when asked; a fresh one opens for editing,
  // since an empty note has nothing to read.
  const [editing, setEditing] = useState(joinLines(cell.source).length === 0);

  const source = joinLines(cell.source);
  const isCode = cell.cell_type === 'code';
  const busy = state === 'running' || state === 'queued';

  const run = useCallback(() => {
    if (isCode) {
      void runCell(cell.id);
    } else {
      setEditing(false);
    }
  }, [cell.id, isCode, runCell]);

  const mark = isCode
    ? state === 'done'
      ? `[${cell.execution_count ?? ' '}]`
      : RUN_MARK[state]
    : '';

  return (
    <div
      className={`notebook-cell ${cell.cell_type} ${selected ? 'selected' : ''} ${state}`}
      onFocus={() => select(cell.id)}
      onClick={() => select(cell.id)}
    >
      <div className="notebook-cell-gutter">
        <button
          type="button"
          className="notebook-cell-run"
          onClick={run}
          disabled={busy}
          title={isCode ? 'Run this cell (Ctrl+Enter)' : 'Done editing'}
          aria-label={isCode ? 'Run this cell' : 'Done editing'}
        >
          <IoPlayOutline aria-hidden />
        </button>
        <span className={`notebook-cell-mark ${state}`}>{mark}</span>
      </div>

      <div className="notebook-cell-body">
        {!isCode && !editing ? (
          <div
            className="notebook-cell-prose"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit"
          >
            <MarkdownContent text={source || '*empty note*'} />
          </div>
        ) : (
          <CellEditor
            value={source}
            language={isCode ? 'python' : 'markdown'}
            readOnly={busy}
            placeholderText={isCode ? 'net = nemo.network()' : 'Notes, in Markdown. $E = mc^2$'}
            onChange={(next) => setSource(cell.id, next)}
            onRun={run}
            onFocus={() => select(cell.id)}
          />
        )}

        {isCode && (cell.outputs?.length ?? 0) > 0 && (
          <div className="notebook-cell-outputs">
            {cell.outputs!.map((output, i) => (
              <div className="notebook-cell-output" key={i}>
                <CellOutputView output={output} />
                {isPinnable(output) && (
                  <button
                    type="button"
                    className="notebook-cell-pin"
                    onClick={() => void pinOutputToCanvas(output)}
                    title="Pin this figure to the canvas, where it exports with the drawing"
                    aria-label="Pin this figure to the canvas"
                  >
                    <IoPricetagOutline aria-hidden />
                    <span>Pin</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="notebook-cell-actions">
        <select
          className="notebook-cell-kind"
          value={cell.cell_type}
          onChange={(event) => setKind(cell.id, event.target.value as 'code' | 'markdown')}
          aria-label="Cell type"
          title="What this cell is"
        >
          <option value="code">code</option>
          <option value="markdown">note</option>
        </select>
        <button
          type="button"
          onClick={() => moveCell(cell.id, -1)}
          title="Move up"
          aria-label="Move up"
        >
          <IoArrowUpOutline aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => moveCell(cell.id, 1)}
          title="Move down"
          aria-label="Move down"
        >
          <IoArrowDownOutline aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => addCell('code', cell.id)}
          title="Add a cell below"
          aria-label="Add a cell below"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => removeCell(cell.id)}
          title="Delete this cell"
          aria-label="Delete this cell"
        >
          <IoCloseOutline aria-hidden />
        </button>
      </div>
    </div>
  );
});

NotebookCellView.displayName = 'NotebookCellView';

export default NotebookCellView;
