import { describe, expect, it } from 'vitest';
import { appendOutput, hasData, joinLines, type CellOutput } from './notebook';

const stream = (name: 'stdout' | 'stderr', text: string): CellOutput => ({
  output_type: 'stream',
  name,
  text,
});

const result = (text: string): CellOutput => ({
  output_type: 'execute_result',
  execution_count: 1,
  data: { 'text/plain': text },
  metadata: {},
});

describe('collecting a cell’s outputs', () => {
  it('runs consecutive writes to one stream together', () => {
    // print("hi") is two writes, the text and the newline; a loop is thousands. A
    // notebook file holds one output per run of them, not one per write.
    const outputs = [stream('stdout', 'hi'), stream('stdout', '\n')].reduce(
      appendOutput,
      [] as CellOutput[]
    );
    expect(outputs).toHaveLength(1);
    expect(joinLines((outputs[0] as { text: string }).text)).toBe('hi\n');
  });

  it('keeps the two streams apart', () => {
    const outputs = [stream('stdout', 'out'), stream('stderr', 'err')].reduce(
      appendOutput,
      [] as CellOutput[]
    );
    expect(outputs.map((o) => (o as { name: string }).name)).toEqual(['stdout', 'stderr']);
  });

  it('does not run a stream into one across something else', () => {
    // Order is what an output list records, so text printed after a value has to stay
    // after it rather than joining the text printed before.
    const outputs = [stream('stdout', 'before'), result('42'), stream('stdout', 'after')].reduce(
      appendOutput,
      [] as CellOutput[]
    );
    expect(outputs.map((o) => o.output_type)).toEqual(['stream', 'execute_result', 'stream']);
  });

  it('leaves what it was given alone', () => {
    const first = [stream('stdout', 'one')];
    const second = appendOutput(first, stream('stdout', 'two'));
    expect(first).toHaveLength(1);
    expect(joinLines((first[0] as { text: string }).text)).toBe('one');
    expect(second).not.toBe(first);
  });
});

describe('reading an output', () => {
  it('knows which kinds carry something to choose a renderer from', () => {
    expect(hasData(result('42'))).toBe(true);
    expect(hasData(stream('stdout', 'x'))).toBe(false);
  });

  it('takes a multiline string in either of the forms the format allows', () => {
    expect(joinLines(['a\n', 'b\n'])).toBe('a\nb\n');
    expect(joinLines('a\nb\n')).toBe('a\nb\n');
    expect(joinLines(undefined)).toBe('');
  });
});
