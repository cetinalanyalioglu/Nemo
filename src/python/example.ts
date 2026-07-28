/**
 * What an empty prompt and an empty notebook offer.
 *
 * A blank line is a poor invitation: it says a console is here without saying what it is
 * for. Both surfaces open with something runnable instead.
 *
 * The example comes from the model, beside its adapter, because what a useful first line
 * looks like depends entirely on what the model's solver is — `net.solve()` means
 * nothing to a model that solves nothing. A model that offers none falls back to the
 * lines about reading and colouring the canvas, which are true of every model.
 */

import { useGraphStore } from '../store/graphStore';

/**
 * True of any model at all: the canvas can always be read and always be coloured, since
 * neither needs a solver.
 */
const GENERIC_EXAMPLE = `doc = nemo.case()             # the canvas, as a case document
print(nemo.counts())          # how many elements are drawn
nemo.show({"name": "Guess", "items": [
    {"name": "Something", "target": "edge",
     "values": [1.0] * nemo.counts()["edges"]}]})`;

/** The example to offer for the model on the canvas, read once. */
export const solverExample = (): string =>
  (useGraphStore.getState().model?.solver?.example ?? GENERIC_EXAMPLE).trimEnd();

/**
 * The same, subscribed.
 *
 * A model is fetched, so it is not there for the first render. Reading it once would
 * leave every surface showing the generic example for the whole session.
 */
export const useSolverExample = (): string =>
  useGraphStore((s) => (s.model?.solver?.example ?? GENERIC_EXAMPLE).trimEnd());

/** Whether a model has resolved at all, and so whether its example is worth showing. */
export const useModelReady = (): boolean => useGraphStore((s) => s.model !== null);

/** The example as lines, for a surface that shows one line at a time. */
export const solverExampleLines = (example: string): string[] => example.split('\n');

/**
 * The example's opening line, with any trailing comment taken off.
 *
 * For a surface with room for one line and no room to explain it: an empty notebook
 * cell, which shows a greyed suggestion of what could go in it. Subscribed nowhere, so
 * a cell rendered before its model has resolved suggests the generic line and the next
 * one suggests the model's.
 */
export const firstExampleLine = (): string => {
  const [first = ''] = solverExampleLines(solverExample());
  return first.split('#')[0].trimEnd();
};
