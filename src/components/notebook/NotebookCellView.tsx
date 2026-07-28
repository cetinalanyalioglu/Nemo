import React, { useCallback, useState } from 'react';
import { IoPlayOutline, IoPricetagOutline, IoTrashOutline } from 'react-icons/io5';
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
 *
 * The gutter beside a cell is also its handle: a cell is picked up there and dropped
 * between two others, because the rest of a cell is text and dragging text should select
 * it. Ctrl/Cmd+Shift+Up and Down do the same from the keyboard, without leaving the
 * editor.
 */

/** The marker beside a cell, saying where it stands with the interpreter. */
const RUN_MARK: Record<CellRunState, string> = {
  idle: '[ ]',
  queued: '[*]',
  running: '[*]',
  done: '',
  failed: '[!]',
};

/** What a cell is dragged as. Not `text/plain`, which the editor would take as text. */
const CELL_DRAG_TYPE = 'application/x-nemo-cell';

interface NotebookCellViewProps {
  cell: NotebookCell;
  state: CellRunState;
  selected: boolean;
  /** Where this cell sits in the notebook, which is what a drop is measured against. */
  index: number;
  /**
   * What an empty code cell suggests writing, which is the model's business rather
   * than this app's: a line about solving a network says nothing under a model that
   * solves nothing. Passed in because a cell is memoized on its props.
   */
  placeholder: string;
}

const NotebookCellView = React.memo(
  ({ cell, state, selected, index, placeholder }: NotebookCellViewProps) => {
    const {
      select,
      setSource,
      removeCell,
      runCell,
      addCell,
      moveCell,
      startDrag,
      hoverGap,
      endDrag,
    } = useNotebookStore.getState();
    const dragging = useNotebookStore((s) => s.dragId === cell.id);
    // The line is drawn above the cell whose gap it is, except the last gap of all, which
    // has no cell below it to hang from.
    const dropLine = useNotebookStore((s) => {
      if (s.dropSlot === null) return null;
      if (s.dropSlot === index) return 'above';
      if (s.dropSlot === s.cells.length && index === s.cells.length - 1) return 'below';
      return null;
    });
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

    /** Run, then leave a fresh cell under this one to carry on in. */
    const runAndAdd = useCallback(() => {
      run();
      addCell('code', cell.id);
    }, [addCell, cell.id, run]);

    const mark = isCode
      ? state === 'done'
        ? `[${cell.execution_count ?? ' '}]`
        : RUN_MARK[state]
      : '';

    /** Which side of this cell the pointer is on, as the gap a drop would fall into. */
    const gapUnder = useCallback(
      (event: React.DragEvent<HTMLDivElement>): number => {
        const box = event.currentTarget.getBoundingClientRect();
        return event.clientY > box.top + box.height / 2 ? index + 1 : index;
      },
      [index]
    );

    return (
      <div
        className={`notebook-cell ${cell.cell_type} ${selected ? 'selected' : ''} ${state} ${
          dragging ? 'dragging' : ''
        }`}
        onFocus={() => select(cell.id)}
        onClick={() => select(cell.id)}
        onDragOver={(event) => {
          if (!useNotebookStore.getState().dragId) return;
          // Without this the drop is refused, and the pointer says so.
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          hoverGap(gapUnder(event));
        }}
        onDrop={(event) => {
          event.preventDefault();
          endDrag(true);
        }}
      >
        {dropLine && <div className={`notebook-cell-drop ${dropLine}`} aria-hidden />}

        <div
          className="notebook-cell-gutter"
          draggable
          title="Drag to move this cell (Ctrl+Shift+Up or Down)"
          onDragStart={(event) => {
            // Firefox starts no drag at all unless the event carries something.
            event.dataTransfer.setData(CELL_DRAG_TYPE, cell.id);
            event.dataTransfer.effectAllowed = 'move';
            startDrag(cell.id);
          }}
          onDragEnd={() => endDrag(false)}
        >
          <button
            type="button"
            className="notebook-cell-run"
            onClick={run}
            disabled={busy}
            title={
              isCode ? 'Run this cell (Shift+Enter; Ctrl+Enter also adds one)' : 'Done editing'
            }
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
              placeholderText={isCode ? placeholder : 'Notes, in Markdown. $E = mc^2$'}
              onChange={(next) => setSource(cell.id, next)}
              onRun={run}
              onRunAndAdd={runAndAdd}
              onMove={(delta) => moveCell(cell.id, delta)}
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

        {/* In a gutter of its own, so it never sits over what the cell holds. */}
        <div className="notebook-cell-actions">
          <button
            type="button"
            onClick={() => removeCell(cell.id)}
            title="Delete this cell"
            aria-label="Delete this cell"
          >
            <IoTrashOutline aria-hidden />
          </button>
        </div>
      </div>
    );
  }
);

NotebookCellView.displayName = 'NotebookCellView';

export default NotebookCellView;
