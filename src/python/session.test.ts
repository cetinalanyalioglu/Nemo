/**
 * What a session reports it is holding, run under a real interpreter.
 *
 * Skips where there is no Python; set `PYTHON` to point at one.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PYTHON = process.env.PYTHON ?? 'python3';
const SESSION = resolve(__dirname, 'session.py');

const usable = (() => {
  try {
    execFileSync(PYTHON, ['-c', 'import types'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

interface Variable {
  name: string;
  kind: string;
  summary: string;
}

/** Runs `setup` in a namespace, then reports what the session says it holds. */
const inspect = (setup: string): { before: Variable[]; after: Variable[]; forgot: number } => {
  const driver = `
import json, importlib.util
spec = importlib.util.spec_from_file_location("session", ${JSON.stringify(SESSION)})
session = importlib.util.module_from_spec(spec)
spec.loader.exec_module(session)

ns = {"__name__": "__main__", "__builtins__": __builtins__, "nemo": object(), "display": print}
exec(${JSON.stringify(setup)}, ns)

before = session.variables(ns)
forgot = session.clear(ns)
print(json.dumps({"before": before, "after": session.variables(ns), "forgot": forgot}))
`;
  return JSON.parse(execFileSync(PYTHON, ['-c', driver], { encoding: 'utf8' }).trim());
};

describe.skipIf(!usable)('the names a session is holding', () => {
  it('lists what was defined, alphabetically', () => {
    const { before } = inspect('zebra = 1\napple = 2');
    expect(before.map((v) => v.name)).toEqual(['apple', 'zebra']);
  });

  it('leaves out what the console put there itself', () => {
    // `nemo` and `display` are the console's, not the user's, and are neither theirs
    // to read in a list of their own names nor theirs to lose.
    const { before } = inspect('mine = 1');
    expect(before.map((v) => v.name)).toEqual(['mine']);
  });

  it('leaves out the interpreter’s own bookkeeping', () => {
    const { before } = inspect('_hidden = 1\nshown = 2');
    expect(before.map((v) => v.name)).toEqual(['shown']);
  });

  it('says what sort of thing each one is', () => {
    const { before } = inspect('import math\nclass Thing: pass\ndef fn(): pass\ncount = 3');
    const kinds = Object.fromEntries(before.map((v) => [v.name, v.kind]));
    expect(kinds).toEqual({ math: 'module', Thing: 'class', fn: 'function', count: 'int' });
  });

  it('gives a size rather than a repr for anything that has one', () => {
    // How big a thing is says more than printing it, and is safe on something large.
    const { before } = inspect('rows = list(range(10000))\nname = "abc"');
    const summaries = Object.fromEntries(before.map((v) => [v.name, v.summary]));
    expect(summaries.rows).toBe('10000 items');
    expect(summaries.name).toBe('3 items');
  });

  it('shortens a summary that would not fit on a line', () => {
    const { before } = inspect(
      'class Big:\n    def __repr__(self): return "x" * 5000\nbig = Big()'
    );
    const big = before.find((v) => v.name === 'big')!;
    expect(big.summary.length).toBeLessThan(200);
    expect(big.summary.endsWith('…')).toBe(true);
  });

  it('survives a value that cannot be shown at all', () => {
    const { before } = inspect(
      'class Awkward:\n    def __repr__(self): raise RuntimeError("no")\nbad = Awkward()'
    );
    expect(before.find((v) => v.name === 'bad')!.summary).toBe('<cannot be shown>');
  });

  it('forgets every name, and keeps what the console needs', () => {
    const { after, forgot } = inspect('import math\na = 1\nb = 2');
    expect(forgot).toBe(3);
    expect(after).toEqual([]);
  });
});
