/**
 * That a console which cannot reach its interpreter says so.
 *
 * Requests to a local interpreter are made and dropped — nothing waits on them — so a
 * failure that escapes is not merely an unhandled rejection but a silent one: the pane
 * sits at "starting" and never explains itself. The address is typed into a field by
 * hand and need not even parse, so this is a path users reach by ordinary mistakes.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { localTransport } from './transport';
import type { HostMessage, WorkerMessage } from './protocol';

const BOOT: HostMessage = {
  kind: 'boot',
  indexURL: 'https://example.invalid/pyodide/',
  wheels: [],
  adapter: '',
  handle: '',
  example: '',
};

/** A working address, for the cases that are not about the address. */
const ADDRESS = 'http://127.0.0.1:8765/?token=abc';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

/** Lets whatever the transport queued run before the assertions. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('reaching an interpreter on this machine', () => {
  it('reports an address that will not parse rather than throwing past everyone', async () => {
    // `localhost:8765` — no scheme. Read before the request is even attempted, which is
    // why it used to escape the one try/catch there was.
    const seen: WorkerMessage[] = [];
    globalThis.fetch = vi.fn() as never;

    localTransport('localhost:8765', (message) => seen.push(message)).send(BOOT);
    await tick();

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(seen).toHaveLength(1);
    expect(seen[0].kind).toBe('boot-failed');
  });

  it('reports an interpreter that is not listening', async () => {
    const seen: WorkerMessage[] = [];
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed')) as never;

    localTransport(ADDRESS, (message) => seen.push(message)).send(BOOT);
    await tick();

    expect(seen.map((m) => m.kind)).toEqual(['boot-failed']);
  });

  it('abandons every open request when it is stopped, not only the newest', async () => {
    // A question about the workspace is asked while a solve is still streaming back, so
    // two requests are genuinely open at once. Keeping one controller meant a restart
    // aborted whichever was last and left the solve running on the server.
    const signals: AbortSignal[] = [];
    globalThis.fetch = vi.fn((_url: unknown, init: { signal: AbortSignal }) => {
      signals.push(init.signal);
      return new Promise<Response>(() => {});
    }) as never;

    const transport = localTransport(ADDRESS, () => {});
    transport.send(BOOT);
    transport.send({ kind: 'workspace' });
    await tick();
    expect(signals).toHaveLength(2);
    expect(signals.some((s) => s.aborted)).toBe(false);

    transport.stop();
    expect(signals.every((s) => s.aborted)).toBe(true);
  });

  it('says nothing when the failure is its own stop', async () => {
    // A restart during a solve aborts a stream that is still arriving, every time. That
    // is this side's own doing and reporting it would put a failure in the log for
    // something the user just asked for.
    const seen: WorkerMessage[] = [];
    globalThis.fetch = vi.fn(
      (_url: unknown, init: { signal: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          );
        })
    ) as never;

    const transport = localTransport(ADDRESS, (message) => seen.push(message));
    transport.send(BOOT);
    await tick();
    transport.stop();
    await tick();

    expect(seen).toEqual([]);
  });
});
