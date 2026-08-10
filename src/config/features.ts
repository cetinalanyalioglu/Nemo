/**
 * Which of the optional parts of the app this build carries.
 *
 * Both are decided when the bundle is built, from the environment Vite is given:
 *
 *     VITE_FEATURE_PYTHON_CONSOLE=false npm run build   # canvas only
 *     VITE_FEATURE_NOTEBOOK=false npm run build         # console, no notebook
 *
 * They come in stages, because the second is built on the first: the notebook's cells
 * run in the console's interpreter and show what it produced, so a notebook without a
 * console is a tab that cannot do anything. Asking for that combination gets a
 * notebook that is off, which {@link resolveFeatures} decides once rather than every
 * caller deciding it again.
 *
 * The values arrive as literals substituted by the bundler (see the `define` block in
 * `vite.config.ts`), not as a lookup made while the app runs. That is what lets a
 * build that turns one off leave the code behind rather than ship it switched off:
 * `PYTHON_CONSOLE &&` in front of a component is a dead branch the bundler can see is
 * dead. Anything gating one of these should read the constants below directly, for the
 * same reason.
 */

declare const __FEATURE_PYTHON_CONSOLE__: boolean;
declare const __FEATURE_NOTEBOOK__: boolean;

/** The Python prompt in the console pane, and the Variables tab beside it. */
export const PYTHON_CONSOLE: boolean = __FEATURE_PYTHON_CONSOLE__;

/** The Results notebook: the second workspace surface, and `.ipynb` in a case. */
export const NOTEBOOK: boolean = PYTHON_CONSOLE && __FEATURE_NOTEBOOK__;

/** What the app checks before offering one of the optional parts. */
export interface Features {
  pythonConsole: boolean;
  notebook: boolean;
}

/**
 * The pair, for the places that want to pass them around or stand in for them under
 * test. Prefer the constants above at a gate: a property read is a step further than
 * the bundler will follow, so this object keeps the code it guards in the bundle.
 */
export const FEATURES: Features = { pythonConsole: PYTHON_CONSOLE, notebook: NOTEBOOK };

/**
 * A switch as an environment gives it: a string, or nothing at all.
 *
 * Anything unset falls back to the default, which is on — a build says what it is
 * leaving out, rather than having to ask for what it keeps. `false`, `0`, `off` and
 * `no` all turn one off, in any casing, since which of those an environment uses is
 * not worth being strict about. Anything else on is on.
 *
 * Kept in step with the same rule in `vite.config.ts`, which is where it has to run
 * for the substitution to happen; the tests below check the two agree.
 */
export const readFlag = (value: unknown, fallback = true): boolean => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return !['false', '0', 'off', 'no'].includes(String(value).trim().toLowerCase());
};

/** The environment the flags are read from, as the build script sees it. */
export interface FeatureEnv {
  VITE_FEATURE_PYTHON_CONSOLE?: unknown;
  VITE_FEATURE_NOTEBOOK?: unknown;
}

/**
 * The two switches, with the dependency between them already settled: a notebook is
 * only on where the console it runs in is on too.
 */
export const resolveFeatures = (env: FeatureEnv): Features => {
  const pythonConsole = readFlag(env.VITE_FEATURE_PYTHON_CONSOLE);
  return {
    pythonConsole,
    notebook: pythonConsole && readFlag(env.VITE_FEATURE_NOTEBOOK),
  };
};
