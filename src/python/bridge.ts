/**
 * What Python is allowed to do to the canvas.
 *
 * Every request from the interpreter arrives here and nowhere else, so this file is
 * the whole of the write side of the boundary. Requests are checked before they are
 * applied: the interpreter is a place a user types, and a mistyped line should show up
 * in the message log rather than as a broken canvas.
 */

import { useDataStore } from '../store/dataStore';
import { useGraphStore } from '../store/graphStore';
import { ANNOTATION_NODE_TYPE } from '../types/annotations';
import type { Dataset } from '../types/data';
import { logger } from '../utils/logger';
import type { BridgeCall } from './protocol';

/** How a case that arrived from the console is named when it carries no title. */
const CONSOLE_CASE_TITLE = 'From the console';

/** How many elements a result series has to supply one value for. */
const canvasCounts = (): { nodeCount: number; edgeCount: number } => {
  const { nodes, edges } = useGraphStore.getState();
  return {
    // Annotations are on the presentation layer and hold no data, so they are not counted.
    nodeCount: nodes.filter((node) => node.type !== ANNOTATION_NODE_TYPE).length,
    edgeCount: edges.length,
  };
};

/** Whether `value` has the shape of one result set: a name and a list of series. */
const isDataset = (value: unknown): value is Dataset => {
  if (!value || typeof value !== 'object') return false;
  const dataset = value as Partial<Dataset>;
  return typeof dataset.name === 'string' && Array.isArray(dataset.items);
};

const showDatasets = (datasets: unknown[]): void => {
  const wellFormed = datasets.filter(isDataset);
  if (wellFormed.length !== datasets.length) {
    logger.error(
      'The console sent something that is not a result set: each needs a "name" and an "items" list.'
    );
  }
  if (wellFormed.length === 0) return;
  useDataStore.getState().loadDatasetsFromObject(wellFormed, canvasCounts());
};

/**
 * Applies one request from the interpreter.
 *
 * Nothing here throws back at Python: by the time a request arrives the line that made
 * it has already returned, so a failure is reported where the user is looking.
 */
export const applyBridgeCall = (call: BridgeCall): void => {
  switch (call.op) {
    case 'datasets':
      if (!Array.isArray(call.datasets)) {
        logger.error('The console sent result sets in a form that is not a list.');
        return;
      }
      showDatasets(call.datasets);
      return;
    case 'case':
      useGraphStore.getState().openCase(call.doc, CONSOLE_CASE_TITLE);
      return;
    case 'log':
      logger[call.level](call.message);
      return;
  }
};
