/**
 * What a running cell shows, and what it costs to show it.
 *
 * A cell shows its outputs as they arrive, which is the whole point for a solve that
 * takes minutes. What it must not do is pay a render per printed line: the same cell
 * that most wants its progress shown is the one producing the most of it, and the cost
 * of showing would swamp the work.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CellOutput } from '../types/notebook';

const harness = vi.hoisted(() => ({
  /** Handed the sink for the run in flight, so a test can produce output by hand. */
  sink: null as null | ((output: CellOutput) => void),
  finish: null as null | (() => void),
}));

vi.mock('../python/python-runtime', () => ({
  runPython: (_source: string, sink: (output: CellOutput) => void) =>
    new Promise((resolve) => {
      harness.sink = sink;
      harness.finish = () => resolve({ status: 'complete' });
    }),
}));

const { useNotebookStore } = await import('./notebookStore');

const store = () => useNotebookStore.getState();
const outputsOf = (id: string) => store().cells.find((c) => c.id === id)?.outputs ?? [];

const printed = (text: string): CellOutput => ({ output_type: 'stream', name: 'stdout', text });

/** Waits for the frame the store batches onto. */
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

describe('a cell that produces output while it runs', () => {
  beforeEach(() => {
    store().reset();
    harness.sink = null;
    harness.finish = null;
  });

  it('shows what it has printed before it has finished', async () => {
    const id = store().cells[0].id;
    store().setSource(id, 'print("working")');
    const running = store().runCell(id);
    await vi.waitFor(() => expect(harness.sink).not.toBeNull());

    harness.sink!(printed('half way\n'));
    await nextFrame();
    await nextFrame();

    // Still running, and the output is already on screen.
    expect(store().runState[id]).toBe('running');
    expect(outputsOf(id)).toHaveLength(1);

    harness.finish!();
    await running;
  });

  it('runs a burst of prints together instead of writing each one', async () => {
    const id = store().cells[0].id;
    store().setSource(id, 'for i in range(2000): print(i)');
    const running = store().runCell(id);
    await vi.waitFor(() => expect(harness.sink).not.toBeNull());

    let writes = 0;
    const stopCounting = useNotebookStore.subscribe(() => {
      writes += 1;
    });
    for (let i = 0; i < 2000; i++) harness.sink!(printed(`line ${i}\n`));
    harness.finish!();
    await running;
    stopCounting();

    // Every line is there, as one stream output, exactly as a notebook file holds it.
    const outputs = outputsOf(id);
    expect(outputs).toHaveLength(1);
    expect((outputs[0] as { text: string }).text).toContain('line 0\n');
    expect((outputs[0] as { text: string }).text).toContain('line 1999\n');

    // And it cost a handful of writes rather than one per line. Before batching this
    // was 2000 writes and 2000 renders, each copying the cell list.
    expect(writes).toBeLessThan(20);
  });
});
