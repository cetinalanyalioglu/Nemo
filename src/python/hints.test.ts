/**
 * What the interpreter offers about half-written code, run under a real interpreter.
 *
 * Skips where there is no Python; set `PYTHON` to point at one.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PYTHON = process.env.PYTHON ?? 'python3';
const HINTS = resolve(__dirname, 'hints.py');

const usable = (() => {
  try {
    execFileSync(PYTHON, ['-c', 'import rlcompleter'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/** A namespace with something of each kind in it, as a session would hold. */
const SETUP = `
import math

def duct(length, area, loss=0.0):
    """Make a duct.

    Parameters
    ----------
    length : float
        How long it is, in metres.
    area : float
        Its cross-section, in square metres.
    """

class Solution:
    """One solved state."""
    def field(self, name):
        """Read a field."""

sol = Solution()
rows = [1, 2, 3]
`;

interface Item {
  label: string;
  kind: string;
  detail: string;
}

/** Runs one call in `hints` against that namespace and returns what it answered. */
const ask = (call: string): any => {
  const driver = `
import json, importlib.util
spec = importlib.util.spec_from_file_location("hints", ${JSON.stringify(HINTS)})
hints = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hints)

ns = {"__name__": "__main__", "__builtins__": __builtins__}
exec(${JSON.stringify(SETUP)}, ns)
print(json.dumps(hints.${call}))
`;
  return JSON.parse(execFileSync(PYTHON, ['-c', driver], { encoding: 'utf8' }).trim());
};

const completions = (source: string): { items: Item[]; from: number } =>
  ask(`completions(${JSON.stringify(source)}, ns)`);
const signature = (source: string) => ask(`signature(${JSON.stringify(source)}, ns)`);
const labels = (source: string): string[] => completions(source).items.map((i) => i.label);

describe.skipIf(!usable)('what could finish a name', () => {
  it('offers the names the session is holding', () => {
    expect(labels('du')).toContain('duct');
    expect(labels('so')).toContain('sol');
  });

  it('offers what is behind a dot, from the object itself', () => {
    expect(labels('sol.')).toContain('field');
    expect(labels('math.atan')).toEqual(['atan', 'atan2', 'atanh']);
  });

  it('replaces only the part after the last dot', () => {
    // The word starts at 4 and the attribute at 9; only the attribute is being written.
    expect(completions('x = math.at').from).toBe(9);
    expect(completions('math').from).toBe(0);
  });

  it('says what sort of thing each one is', () => {
    const kinds = Object.fromEntries(completions('math.').items.map((i) => [i.label, i.kind]));
    expect(kinds.atan).toBe('function');
    expect(kinds.pi).toBe('variable');
    const own = Object.fromEntries(completions('d').items.map((i) => [i.label, i.kind]));
    expect(own.duct).toBe('function');
    expect(own.def).toBe('keyword');
  });

  it('shows what a name takes beside it', () => {
    const duct = completions('du').items.find((i) => i.label === 'duct');
    expect(duct?.detail).toBe('duct(length, area, loss=0.0)');
  });

  it('shows a method as it would be called, without the instance', () => {
    // Read off the class it would still ask for `self`, which is not what anyone typing
    // `sol.field(` has to supply.
    const field = completions('sol.fie').items.find((i) => i.label === 'field');
    expect(field?.detail).toBe('field(name)');
    expect(field?.kind).toBe('method');
  });

  it('runs nothing to answer', () => {
    // Completing after a call would mean making the call to see what it returned.
    expect(completions('duct(1, 2).fi').items).toEqual([]);
  });

  it('has nothing to offer for a name that was never defined', () => {
    expect(labels('nowhere.')).toEqual([]);
  });
});

describe.skipIf(!usable)('what the call being written takes', () => {
  it('names the call and its parameters', () => {
    expect(signature('duct(')?.label).toBe('duct(length, area, loss=0.0)');
  });

  it('says which argument is being written', () => {
    expect(signature('duct(')?.parameter).toBe('length');
    expect(signature('duct(1.0, ')?.parameter).toBe('area');
  });

  it('stops naming the argument once one is given by keyword', () => {
    // Position means nothing after that, so claiming to know which one is being written
    // would be a guess.
    expect(signature('duct(area=1.0, ')?.parameter).toBe('');
  });

  it('quotes what the documentation says about that argument', () => {
    expect(signature('duct(')?.doc).toBe('length : float\n    How long it is, in metres.');
  });

  it('falls back to the opening of the docstring', () => {
    expect(signature('sol.field(')?.doc).toBe('Read a field.');
  });

  it('reads the innermost call, and no bracket inside a string', () => {
    expect(signature('duct(sol.field(')?.label).toBe('sol.field(name)');
    expect(signature('duct("(", ')?.parameter).toBe('area');
  });

  it('reads no bracket inside a tripled-quote string either', () => {
    // Counted one quote at a time, `"""` reads as a string that opens and shuts and
    // then a third quote opening another — which comes out right by luck for plain
    // text, and stops being lucky as soon as the text contains a quote of its own.
    // From there the count is inverted: what is inside the string is read as code, and
    // the bracket below is taken for the call the caret sits in.
    expect(signature('duct("""say "x (y""", ')?.parameter).toBe('area');
    expect(signature("duct('''say 'x (y''', ")?.parameter).toBe('area');
    // A string still open at the caret swallows the rest, brackets included.
    expect(signature('duct("""a (b')?.parameter).toBe('length');
  });

  it('says nothing about something that will not say what it takes', () => {
    // Plenty of compiled routines carry no parameter list at all; there is nothing to
    // report, and reporting a guess would be worse.
    //
    // `math.log` is the example because its signature is one CPython cannot express —
    // the base is optional and positional-only — so it has carried none for as long as
    // there have been text signatures, and no release is going to give it one. A
    // routine picked for merely having none today is a test that fails on the version
    // that adds it: `math.hypot` stood here until 3.14 gave it `(*coordinates)`.
    expect(signature('math.log(')).toBeNull();
  });

  it('has nothing to say where the caret is in no call', () => {
    expect(signature('duct(1, 2)')).toBeNull();
    expect(signature('rows')).toBeNull();
  });
});
