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
import { appendOutput, joinLines, type CellOutput } from '../types/notebook';

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

/** Drives a `Session` through `lines`, returning each outcome and every output. */
const pushAll = (lines: string[]): { outcomes: { status: string }[]; outputs: CellOutput[] } => {
  const driver = `
import json, sys
sys.argv = ["console_server.py"]

import importlib.util
spec = importlib.util.spec_from_file_location("console_server", ${JSON.stringify(SERVER)})
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

outputs = []
session = server.Session()
session.start("")
session.bind(lambda payload: None, lambda payload: outputs.append(json.loads(payload)))

outcomes = [session.push(line) for line in ${JSON.stringify(lines)}]
print(json.dumps({"outcomes": outcomes, "outputs": outputs}))
`;
  const out = execFileSync(PYTHON, ['-c', driver], { encoding: 'utf8' });
  const parsed = JSON.parse(out.trim().split('\n').pop() as string) as {
    outcomes: { status: string }[];
    outputs: CellOutput[];
  };
  // Printing arrives in the pieces the interpreter flushes; a reader runs them
  // together, so what is asserted below is what a notebook would actually hold.
  return { ...parsed, outputs: parsed.outputs.reduce(appendOutput, [] as CellOutput[]) };
};

/** The plain-text form of every output of a given kind, in order. */
const textOf = (outputs: CellOutput[], kind: CellOutput['output_type']): string[] =>
  outputs
    .filter((o) => o.output_type === kind)
    .map((o) =>
      o.output_type === 'stream'
        ? joinLines(o.text)
        : o.output_type === 'error'
          ? o.traceback.join('\n')
          : joinLines((o as { data: Record<string, unknown> }).data['text/plain'] as string)
    );

describe.skipIf(!usable)('a prompt served from the machine', () => {
  it('holds a block open until it is finished', () => {
    const { outcomes, outputs } = pushAll(['def double(x):', '    return 2 * x', '', 'double(21)']);
    expect(outcomes.map((o) => o.status)).toEqual([
      'incomplete',
      'incomplete',
      'complete',
      'complete',
    ]);
    expect(textOf(outputs, 'execute_result')).toEqual(['42']);
  });

  it('holds an unclosed bracket open too', () => {
    const { outcomes, outputs } = pushAll(['(1 +', '2)']);
    expect(outcomes[0].status).toBe('incomplete');
    expect(outcomes[1].status).toBe('complete');
    expect(textOf(outputs, 'execute_result')).toEqual(['3']);
  });

  it('shows the value of a trailing expression, and nothing for a statement', () => {
    const { outcomes, outputs } = pushAll(['1 + 1', 'x = 5']);
    expect(outcomes.map((o) => o.status)).toEqual(['complete', 'complete']);
    expect(textOf(outputs, 'execute_result')).toEqual(['2']);
  });

  it('offers a value as every representation it can, not only as text', () => {
    // What lets a figure be drawn rather than printed: the value is asked, and the
    // richest form the page understands is the one it shows.
    const { outputs } = pushAll([
      'class Rich:',
      '    def _repr_html_(self): return "<b>hi</b>"',
      '    def __repr__(self): return "Rich()"',
      '',
      'Rich()',
    ]);
    const result = outputs.find((o) => o.output_type === 'execute_result') as {
      data: Record<string, unknown>;
    };
    expect(result.data['text/html']).toBe('<b>hi</b>');
    expect(result.data['text/plain']).toBe('Rich()');
  });

  it('shows what display() is given, at the point it is given it', () => {
    // Not at the end: the order outputs arrive in is the order they happened in.
    const { outputs } = pushAll(['display("first"); print("then")']);
    expect(outputs.map((o) => o.output_type)).toEqual(['display_data', 'stream']);
  });

  it('reports a failure as a traceback without the server in it', () => {
    const { outcomes, outputs } = pushAll(['1 / 0']);
    expect(outcomes[0].status).toBe('failed');
    const error = outputs.find((o) => o.output_type === 'error') as {
      ename: string;
      evalue: string;
      traceback: string[];
    };
    expect(error.ename).toBe('ZeroDivisionError');
    expect(error.evalue).toBe('division by zero');
    expect(error.traceback.join('\n')).toContain('File "<console>", line 1');
    // The frames that ran it are the console's own business, not the user's.
    expect(error.traceback.join('\n')).not.toContain('console_server.py');
  });

  it('reports a line that will not parse', () => {
    const { outcomes, outputs } = pushAll(['x === 1']);
    expect(outcomes[0].status).toBe('failed');
    expect(textOf(outputs, 'error').join('')).toContain('SyntaxError');
  });

  it('starts a fresh block after a failure rather than carrying the broken one', () => {
    const { outcomes, outputs } = pushAll(['x === 1', '1 + 1']);
    expect(outcomes[1].status).toBe('complete');
    expect(textOf(outputs, 'execute_result')).toEqual(['2']);
  });

  it('passes what is printed out as it is printed, marked by stream', () => {
    const { outputs } = pushAll(['import sys', 'print("out"); print("err", file=sys.stderr)']);
    const streams = outputs.filter((o) => o.output_type === 'stream') as {
      name: string;
      text: string;
    }[];
    expect(streams.map((s) => [s.name, joinLines(s.text)])).toEqual([
      ['stdout', 'out\n'],
      ['stderr', 'err\n'],
    ]);
  });

  it('keeps names between submissions', () => {
    const { outputs } = pushAll(['answer = 42', 'answer * 2']);
    expect(textOf(outputs, 'execute_result')).toEqual(['84']);
  });
});

/** Runs `source` as one cell, the way the Results tab does, and returns its outputs. */
const runCell = (source: string): { status: string; outputs: CellOutput[] } => {
  const driver = `
import json, sys
sys.argv = ["console_server.py"]

import importlib.util
spec = importlib.util.spec_from_file_location("console_server", ${JSON.stringify(SERVER)})
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)

outputs = []
session = server.Session()
session.start("")
session.bind(lambda payload: None, lambda payload: outputs.append(json.loads(payload)))

outcome = session.run_block(${JSON.stringify(source)})
print(json.dumps({"status": outcome["status"], "outputs": outputs}))
`;
  const out = execFileSync(PYTHON, ['-c', driver], { encoding: 'utf8' });
  const parsed = JSON.parse(out.trim().split('\n').pop() as string);
  return { ...parsed, outputs: parsed.outputs.reduce(appendOutput, [] as CellOutput[]) };
};

describe.skipIf(!usable)('a cell, which is not a prompt', () => {
  it('reads a block with a blank line inside it', () => {
    // The case a prompt cannot take: fed a line at a time, the blank line ends the
    // definition and everything after it is a syntax error. A cell arrives whole.
    const { status, outputs } = runCell(
      ['def area(r):', '    import math', '', '    return math.pi * r * r', '', 'area(2)'].join(
        '\n'
      )
    );
    expect(status).toBe('complete');
    expect(textOf(outputs, 'execute_result')[0]).toMatch(/^12\.56/);
  });

  it('shows only the value it ends on, not every expression in it', () => {
    const { outputs } = runCell(['1 + 1', '2 + 2', '3 + 3'].join('\n'));
    expect(textOf(outputs, 'execute_result')).toEqual(['6']);
  });

  it('shows nothing for a cell that ends on a statement', () => {
    const { status, outputs } = runCell('x = 41\nx += 1');
    expect(status).toBe('complete');
    expect(textOf(outputs, 'execute_result')).toEqual([]);
  });

  it('reports where in the cell it failed', () => {
    const { status, outputs } = runCell('a = 1\nb = 2\nraise ValueError("no")');
    expect(status).toBe('failed');
    const error = outputs.find((o) => o.output_type === 'error') as {
      ename: string;
      traceback: string[];
    };
    expect(error.ename).toBe('ValueError');
    expect(error.traceback.join('\n')).toContain('line 3');
  });

  it('allows await at the top level, as a notebook does', () => {
    const { status, outputs } = runCell(
      [
        'import asyncio',
        'async def wait():',
        '    await asyncio.sleep(0)',
        '    return 7',
        'await wait()',
      ].join('\n')
    );
    expect(status).toBe('complete');
    expect(textOf(outputs, 'execute_result')).toEqual(['7']);
  });

  it('runs an empty cell without complaint', () => {
    expect(runCell('').status).toBe('complete');
    expect(runCell('# just a comment').status).toBe('complete');
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
