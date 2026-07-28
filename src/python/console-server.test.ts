/**
 * The local interpreter's console semantics, run under a real Python.
 *
 * A prompt served from the machine has to behave as the one in the browser does, or the
 * choice of where Python runs stops being invisible — which is the whole point of it.
 * So the cases here are the ones the browser console was driven through: a block that is
 * not finished, a trailing expression, a traceback, and output arriving as it is printed.
 *
 * Skips where there is no Python to run it in. Set `PYTHON` to point at one.
 */

import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PYTHON = process.env.PYTHON ?? 'python3';
const SERVER = resolve(__dirname, 'console_server.py');

const usable = (() => {
  try {
    execFileSync(PYTHON, ['-c', 'import http.server, codeop'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

/** Drives a `Session` through `lines`, returning each outcome and what was printed. */
const pushAll = (lines: string[]): { outcomes: unknown[]; printed: string[] } => {
  const driver = `
import json, sys
sys.path.insert(0, ${JSON.stringify(resolve(__dirname))})
sys.argv = ["console_server.py"]

import importlib.util
spec = importlib.util.spec_from_file_location("console_server", ${JSON.stringify(SERVER)})
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

session = server.Session()
session.start("", lambda payload: None)

printed = []
outcomes = [session.push(line, lambda which, text: printed.append(text))
            for line in ${JSON.stringify(lines)}]
print(json.dumps({"outcomes": outcomes, "printed": printed}))
`;
  const out = execFileSync(PYTHON, ['-c', driver], { encoding: 'utf8' });
  return JSON.parse(out.trim().split('\n').pop() as string);
};

describe.skipIf(!usable)('a prompt served from the machine', () => {
  it('holds a block open until it is finished', () => {
    const { outcomes } = pushAll(['def double(x):', '    return 2 * x', '', 'double(21)']);
    expect(outcomes.map((o) => (o as { status: string }).status)).toEqual([
      'incomplete',
      'incomplete',
      'complete',
      'complete',
    ]);
    expect((outcomes[3] as { repr: string }).repr).toBe('42');
  });

  it('holds an unclosed bracket open too', () => {
    const { outcomes } = pushAll(['(1 +', '2)']);
    expect((outcomes[0] as { status: string }).status).toBe('incomplete');
    expect(outcomes[1]).toEqual({ status: 'complete', repr: '3' });
  });

  it('echoes the value of a trailing expression, and nothing for a statement', () => {
    const { outcomes } = pushAll(['1 + 1', 'x = 5']);
    expect(outcomes[0]).toEqual({ status: 'complete', repr: '2' });
    expect(outcomes[1]).toEqual({ status: 'complete', repr: null });
  });

  it('reports a failure as a traceback without the server in it', () => {
    const { outcomes } = pushAll(['1 / 0']);
    const outcome = outcomes[0] as { status: string; error: string };
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('ZeroDivisionError: division by zero');
    expect(outcome.error).toContain('File "<console>", line 1');
    // The frames that ran it are the console's own business, not the user's.
    expect(outcome.error).not.toContain('console_server.py');
  });

  it('reports a line that will not parse, with the caret', () => {
    const { outcomes } = pushAll(['x === 1']);
    const outcome = outcomes[0] as { status: string; error: string };
    expect(outcome.status).toBe('failed');
    expect(outcome.error).toContain('SyntaxError');
  });

  it('starts a fresh block after a failure rather than carrying the broken one', () => {
    const { outcomes } = pushAll(['x === 1', '1 + 1']);
    expect(outcomes[1]).toEqual({ status: 'complete', repr: '2' });
  });

  it('passes what is printed out as it is printed', () => {
    const { printed } = pushAll(['print("one"); print("two")']);
    expect(printed.join('')).toBe('one\ntwo\n');
  });

  it('keeps names between submissions', () => {
    const { outcomes } = pushAll(['answer = 42', 'answer * 2']);
    expect((outcomes[1] as { repr: string }).repr).toBe('84');
  });
});

describe.skipIf(!usable)('what the local interpreter will answer', () => {
  it('refuses a request that does not carry the token', () => {
    // The token is the whole of the access control: a browser will let any page a user
    // visits make requests to their own machine, and this one executes what it is sent.
    const source = execFileSync('cat', [SERVER], { encoding: 'utf8' });
    expect(source).toContain('secrets.compare_digest');
    expect(source).toContain('send_response(403)');
    // And nothing off the machine should reach it at all.
    expect(source).toContain('"127.0.0.1"');
  });
});
