/**
 * That two submissions never run at once.
 *
 * There is one interpreter holding one set of names, and the console tracks the run it
 * is waiting on in a single slot. A second submission that displaced the first would
 * leave the first's answer unrecognised and its caller waiting forever — a notebook cell
 * stuck on `running` with its editor sealed, or a Run All that never reaches the cleanup
 * that re-enables it. So submissions queue, and every one of them is answered.
 *
 * The interpreter is stood in for here: what is under test is the console's own
 * bookkeeping, which is where the queue lives and where it went wrong.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CellOutput } from '../types/notebook';
import type { HostMessage, WorkerMessage } from './protocol';

const harness = vi.hoisted(() => ({
  sent: [] as HostMessage[],
  reply: null as null | ((message: WorkerMessage) => void),
}));

vi.mock('./transport', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./transport')>();
  return {
    ...actual,
    browserTransport: (onMessage: (message: WorkerMessage) => void) => {
      harness.reply = onMessage;
      return {
        send: (message: HostMessage) => harness.sent.push(message),
        stop: () => {},
      };
    },
  };
});

/** The `run` messages that reached the interpreter, in the order they were sent. */
const runs = () =>
  harness.sent.filter((m): m is Extract<HostMessage, { kind: 'run' }> => m.kind === 'run');

/** The `boot` messages, so a test can tell one interpreter's start from the next's. */
const boots = () => harness.sent.filter((m) => m.kind === 'boot');

/** Resolves to `false` if `promise` has not settled by the time the timer fires. */
const settles = (promise: Promise<unknown>, ms = 150) =>
  Promise.race([
    promise.then(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms)),
  ]);

/** A fresh module registry, so one test's interpreter state is not the next's. */
const freshRuntime = async () => {
  vi.resetModules();
  harness.sent.length = 0;
  harness.reply = null;
  return import('./python-runtime');
};

/** Brings the stand-in interpreter up, as a boot reply would. */
const beReady = async () => {
  await vi.waitFor(() => expect(harness.reply).not.toBeNull());
  harness.reply!({ kind: 'ready', python: '3.14.0', packages: [] });
};

const printed = (text: string): CellOutput => ({
  output_type: 'stream',
  name: 'stdout',
  text,
});

describe('two submissions made at once', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('both get an answer, and each gets its own outputs', async () => {
    const { runPython } = await freshRuntime();
    const first: CellOutput[] = [];
    const second: CellOutput[] = [];

    const a = runPython('first', (o) => first.push(o));
    await beReady();
    await vi.waitFor(() => expect(runs()).toHaveLength(1));

    // A second cell's Run button, pressed while the first is still going. Nothing in
    // the notebook consults the interpreter's status, so this is always reachable.
    const b = runPython('second', (o) => second.push(o));
    // Every chance to reach the interpreter before the first has been answered — which
    // is exactly what it must not take. Without the wait the first is answered while
    // the second is still settling, and the collision this is about never happens.
    await new Promise((resolve) => setTimeout(resolve, 30));

    harness.reply!({ kind: 'display', runId: runs()[0].runId, output: printed('from first') });
    harness.reply!({ kind: 'ran', runId: runs()[0].runId, outcome: { status: 'complete' } });

    await vi.waitFor(() => expect(runs()).toHaveLength(2));
    harness.reply!({ kind: 'display', runId: runs()[1].runId, output: printed('from second') });
    harness.reply!({ kind: 'ran', runId: runs()[1].runId, outcome: { status: 'complete' } });

    expect(await settles(a)).toBe(true);
    expect(await settles(b)).toBe(true);
    expect(first.map((o) => (o as { text: string }).text)).toEqual(['from first']);
    expect(second.map((o) => (o as { text: string }).text)).toEqual(['from second']);
  });

  it('holds the second back until the first has been answered', async () => {
    const { runPython } = await freshRuntime();

    const a = runPython('first', () => {});
    await beReady();
    await vi.waitFor(() => expect(runs()).toHaveLength(1));

    runPython('second', () => {});
    // Nothing about the second reaches the interpreter while the first is outstanding:
    // one set of names, one submission working on them.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(runs()).toHaveLength(1);

    harness.reply!({ kind: 'ran', runId: runs()[0].runId, outcome: { status: 'complete' } });
    await settles(a);
    await vi.waitFor(() => expect(runs()).toHaveLength(2));
  });

  it('abandons what is still waiting when the interpreter is restarted', async () => {
    const { runPython, restartPython } = await freshRuntime();
    const abandoned: CellOutput[] = [];

    const a = runPython('first', () => {});
    await beReady();
    await vi.waitFor(() => expect(runs()).toHaveLength(1));

    const b = runPython('second', (o) => abandoned.push(o));
    void restartPython();

    // Both are answered rather than left outstanding: the one that was running, and the
    // one that never got to. A waiting submission was written against the names of the
    // interpreter being dropped, so it is not carried over to the fresh one.
    expect(await settles(a)).toBe(true);
    expect(await settles(b)).toBe(true);
    await expect(b).resolves.toEqual({ status: 'failed' });
    expect(abandoned).toHaveLength(1);
    expect((abandoned[0] as { evalue: string }).evalue).toMatch(/replaced/);
  });

  it('abandons them when the interpreter is replaced with nobody pressing Restart', async () => {
    // Dropping an interpreter is not only the Restart button. A submission can reach the
    // front of the queue and find the interpreter was started for a different model than
    // the one on the canvas now, which is a replacement too.
    //
    // The submission that finds this out is no longer queued — it is being worked on —
    // so it gets the interpreter it asked for and runs. What is still behind it was
    // written for the one being dropped, and goes with it. The asymmetry is the point of
    // this case: it is deliberate, and pinned here so it stays that way.
    const { runPython } = await freshRuntime();
    const { useGraphStore } = await import('../store/graphStore');
    const abandoned: CellOutput[] = [];

    const first = runPython('first', () => {});
    await beReady();
    await vi.waitFor(() => expect(runs()).toHaveLength(1));

    const triggers = runPython('second', () => {});
    const behind = runPython('third', (o) => abandoned.push(o));

    useGraphStore.setState({ model: { id: 'something-else' } as never });
    harness.reply!({ kind: 'ran', runId: runs()[0].runId, outcome: { status: 'complete' } });

    expect(await settles(first)).toBe(true);
    expect(await settles(behind)).toBe(true);
    await expect(behind).resolves.toEqual({ status: 'failed' });
    expect((abandoned[0] as { evalue: string }).evalue).toMatch(/replaced/);

    // A second interpreter is started, and the submission that asked for it runs there.
    await vi.waitFor(() => expect(boots()).toHaveLength(2));
    harness.reply!({ kind: 'ready', python: '3.14.0', packages: [] });
    await vi.waitFor(() => expect(runs()).toHaveLength(2));
    harness.reply!({ kind: 'ran', runId: runs()[1].runId, outcome: { status: 'complete' } });
    expect(await settles(triggers)).toBe(true);
  });
});
