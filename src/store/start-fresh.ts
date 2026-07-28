/**
 * Putting the app back to how it opens.
 *
 * A model decides what can be drawn, what the parameters mean, and which solver — if any
 * — is behind the console. Nearly everything a session accumulates is therefore about
 * one model and means nothing under another: results bind to elements by position, a
 * notebook is written against a solver's names, and an interpreter has that solver
 * installed rather than chosen per call. So a switch does not migrate any of it; it
 * starts again.
 *
 * The message log is the exception, and deliberately: it is the record of what the app
 * did, including whatever went wrong just before the switch, and that is worth more
 * carried across than cleared.
 *
 * Exports {@link startFresh} and {@link hasWorkInProgress}.
 */

import { discardPython } from '../python/python-runtime';
import { joinLines } from '../types/notebook';
import { useDataStore } from './dataStore';
import { useGraphStore } from './graphStore';
import { useNotebookStore } from './notebookStore';

/**
 * Clears the canvas, the results, the notebook and the console, and drops the
 * interpreter.
 *
 * The graph is reset for whichever model is active *now*, so this is called after the
 * new model has been synced and before any deferred file load is applied — a case being
 * opened carries its own contents and must win over the blank slate.
 */
export const startFresh = (): void => {
  useGraphStore.getState().resetForModel();
  useDataStore.getState().clearDatasets();
  useNotebookStore.getState().reset();
  discardPython();
};

/**
 * Whether anything would be lost by starting again.
 *
 * Asked before a switch, so that a confirmation is put only when there is something to
 * confirm. All three surfaces count: a notebook with work in it is as much a loss as a
 * drawn network, and it is the one most easily forgotten behind the other tab.
 */
export const hasWorkInProgress = (): boolean => {
  const drawn = useGraphStore.getState().nodes.length > 0;
  const loaded = useDataStore.getState().datasets.length > 0;
  const written = useNotebookStore
    .getState()
    .cells.some((cell) => joinLines(cell.source).trim().length > 0);
  return drawn || loaded || written;
};
