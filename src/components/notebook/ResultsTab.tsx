import React, { useCallback, useRef } from 'react';
import {
  IoAddOutline,
  IoDocumentOutline,
  IoDownloadOutline,
  IoPlayForwardOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import { useSolverExample } from '../../python/example';
import { parseNotebook, serializeNotebook } from '../../python/ipynb';
import { useNotebookStore } from '../../store/notebookStore';
import { usePythonStore } from '../../store/pythonStore';
import { logger } from '../../utils/logger';
import NotebookCellView from './NotebookCellView';
import '../../styles/notebook.css';

/**
 * The Results tab: a notebook over the drawn network.
 *
 * Cells run on the same interpreter as the console prompt and share its names, so a
 * network built in a cell is there at the prompt and the other way round. What is shown
 * beneath each cell is what a `.ipynb` file would hold, which is why one written here
 * opens in Jupyter and one written there opens here.
 */

/** The first thing an empty notebook says, so the surface is not a blank page. */
const opening = (example: string): string => `Cells run on the same interpreter as the console
prompt below and share its names, so anything made here is there too. **Shift+Enter** runs a
cell, **Ctrl+Enter** runs it and opens the next.

Something to start from:

\`\`\`python
${example}
\`\`\`

A figure shows itself where it is made. Pin one and it goes on the canvas as an annotation,
where it exports with the drawing.`;

/**
 * The markdown pipeline, fetched with the first note rather than with the app.
 *
 * Declared here rather than where it is used: a lazy component built inside a render is
 * a new component every render, which remounts what it shows on every keystroke.
 */
const MarkdownContent = React.lazy(() => import('../MarkdownContent'));

const ResultsTab = React.memo(() => {
  const cells = useNotebookStore((s) => s.cells);
  const runState = useNotebookStore((s) => s.runState);
  const selectedId = useNotebookStore((s) => s.selectedId);
  const running = useNotebookStore((s) => s.running);
  const status = usePythonStore((s) => s.status);
  const detail = usePythonStore((s) => s.detail);
  const fileInput = useRef<HTMLInputElement>(null);
  // The model's own, since what a useful first line looks like depends on its solver.
  // Subscribed, because a model is fetched and is not there for the first render.
  const example = useSolverExample();

  const openFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const notebook = parseNotebook(String(reader.result));
        useNotebookStore.getState().open(notebook);
        logger.success(`Opened "${file.name}" (${notebook.cells.length} cells).`);
      } catch (error) {
        logger.error(
          `Could not open "${file.name}": ${error instanceof Error ? error.message : error}`
        );
      }
    };
    reader.onerror = () => logger.error(`Could not read "${file.name}".`);
    reader.readAsText(file);
  }, []);

  const save = useCallback((withOutputs: boolean) => {
    const notebook = useNotebookStore.getState().toNotebook({ outputs: withOutputs });
    const blob = new Blob([serializeNotebook(notebook)], { type: 'application/x-ipynb+json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'results.ipynb';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    useNotebookStore.getState().markSaved();
    logger.success(`Saved "${link.download}"${withOutputs ? '' : ' without outputs'}.`);
  }, []);

  const empty = cells.length === 1 && cells[0].source.length === 0;

  return (
    <div className="results-tab">
      <div className="results-toolbar">
        <span className={`python-status ${status}`}>
          {status === 'off' ? 'not started' : status}
          {detail && <span className="python-status-detail">{detail}</span>}
        </span>
        <div className="results-actions">
          <button
            type="button"
            className="console-logs-clear"
            onClick={() => void useNotebookStore.getState().runAll()}
            disabled={running}
            title="Run every code cell from the top"
          >
            <IoPlayForwardOutline aria-hidden />
            <span>Run all</span>
          </button>
          <button
            type="button"
            className="console-logs-clear"
            onClick={() => useNotebookStore.getState().addCell('code')}
            title="Add a cell at the end"
          >
            <IoAddOutline aria-hidden />
            <span>Cell</span>
          </button>
          <button
            type="button"
            className="console-logs-clear"
            onClick={() => useNotebookStore.getState().clearOutputs()}
            title="Clear every output, keeping what was written"
          >
            <IoTrashOutline aria-hidden />
            <span>Outputs</span>
          </button>
          <button
            type="button"
            className="console-logs-clear"
            onClick={() => fileInput.current?.click()}
            title="Open a .ipynb notebook"
          >
            <IoDocumentOutline aria-hidden />
            <span>Open</span>
          </button>
          <button
            type="button"
            className="console-logs-clear"
            onClick={() => save(true)}
            title="Save as a .ipynb notebook, with its outputs"
          >
            <IoDownloadOutline aria-hidden />
            <span>Save</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".ipynb,application/x-ipynb+json,application/json"
            className="results-file-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) openFile(file);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="results-scroll">
        {empty && (
          <div className="results-opening">
            <React.Suspense fallback={null}>
              <MarkdownContent text={opening(example)} />
            </React.Suspense>
            <button
              type="button"
              className="results-opening-use"
              onClick={() => useNotebookStore.getState().setSource(cells[0].id, example)}
            >
              Put it in the cell below
            </button>
          </div>
        )}
        {cells.map((cell) => (
          <NotebookCellView
            key={cell.id}
            cell={cell}
            state={runState[cell.id] ?? 'idle'}
            selected={selectedId === cell.id}
          />
        ))}
        {/* A rule with a button sitting on it: present where a cell would go, and out
            of the way until it is wanted. */}
        <div className="results-add">
          <button
            type="button"
            className="results-add-button"
            onClick={() => useNotebookStore.getState().addCell('code')}
            title="Add a cell at the end"
            aria-label="Add a cell at the end"
          >
            <IoAddOutline aria-hidden />
            <span>Code</span>
          </button>
          <button
            type="button"
            className="results-add-button"
            onClick={() => useNotebookStore.getState().addCell('markdown')}
            title="Add a note at the end"
            aria-label="Add a note at the end"
          >
            <IoAddOutline aria-hidden />
            <span>Note</span>
          </button>
        </div>
      </div>
    </div>
  );
});

ResultsTab.displayName = 'ResultsTab';

export default ResultsTab;
