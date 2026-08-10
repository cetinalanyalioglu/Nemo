import { describe, expect, it } from 'vitest';
import { readFlag, resolveFeatures } from './features';

describe('reading a switch off the environment', () => {
  it('is on where the environment says nothing', () => {
    // A build declares what it leaves out; keeping everything needs no ceremony.
    expect(readFlag(undefined)).toBe(true);
    expect(readFlag(null)).toBe(true);
    expect(readFlag('')).toBe(true);
  });

  it('takes any of the usual ways of saying no', () => {
    for (const off of ['false', '0', 'off', 'no', 'FALSE', ' Off ']) {
      expect(readFlag(off)).toBe(false);
    }
  });

  it('takes anything else as yes', () => {
    for (const on of ['true', '1', 'on', 'yes']) {
      expect(readFlag(on)).toBe(true);
    }
  });

  it('honours the fallback it is given', () => {
    expect(readFlag(undefined, false)).toBe(false);
  });
});

describe('the two switches together', () => {
  it('carries both when the environment is empty', () => {
    expect(resolveFeatures({})).toEqual({ pythonConsole: true, notebook: true });
  });

  it('can leave the notebook out and keep the console', () => {
    expect(resolveFeatures({ VITE_FEATURE_NOTEBOOK: 'false' })).toEqual({
      pythonConsole: true,
      notebook: false,
    });
  });

  it('takes the notebook with the console when the console goes', () => {
    // The second stage is built on the first: a notebook cell runs in the console's
    // interpreter, so a notebook without one is a tab that cannot do anything.
    expect(resolveFeatures({ VITE_FEATURE_PYTHON_CONSOLE: 'false' })).toEqual({
      pythonConsole: false,
      notebook: false,
    });
  });

  it('will not keep a notebook that was explicitly asked for without a console', () => {
    expect(
      resolveFeatures({ VITE_FEATURE_PYTHON_CONSOLE: 'off', VITE_FEATURE_NOTEBOOK: 'true' })
    ).toEqual({ pythonConsole: false, notebook: false });
  });
});
