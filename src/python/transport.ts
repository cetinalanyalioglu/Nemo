/**
 * Where the console's Python actually runs.
 *
 * The console does not care. It sends {@link HostMessage}s and receives
 * {@link WorkerMessage}s, and either of the two transports below carries them: one to a
 * worker in this page, one to a Python process on the machine. The prompt, the `nemo`
 * module, the case that crosses and the results that come back are the same either way
 * — which is the point, since the second exists only to be faster than the first.
 *
 * A transport is started, sent to, and stopped. It reports by calling the handler it
 * was started with, and reports its own failures as `boot-failed` so a console that
 * cannot reach its interpreter says so where every other failure appears.
 */

import type { HostMessage, WorkerMessage } from './protocol';

export type MessageHandler = (message: WorkerMessage) => void;

export interface Transport {
  send: (message: HostMessage) => void;
  stop: () => void;
}

/** Which of the two a session is using. */
export type RuntimeKind = 'browser' | 'local';

/** Where a local interpreter is reached, as the server prints it on startup. */
export const LOCAL_ADDRESS_KEY = 'nemo.python.localAddress';
export const RUNTIME_KIND_KEY = 'nemo.python.runtime';

/**
 * Python in this page, in a worker.
 *
 * Needs nothing installed and reaches nothing outside the page, at the cost of running
 * an interpreter compiled to WebAssembly.
 */
export const browserTransport = (onMessage: MessageHandler): Transport => {
  const worker = new Worker(new URL('./runtime.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (event: MessageEvent<WorkerMessage>) => onMessage(event.data);
  worker.onerror = (event) =>
    onMessage({ kind: 'boot-failed', error: event.message || 'the interpreter stopped' });
  return {
    send: (message) => worker.postMessage(message),
    stop: () => worker.terminate(),
  };
};

/**
 * Python on the machine, over HTTP.
 *
 * Each message is posted and answered by a stream of newline-delimited replies, which
 * is what lets a solve print as it goes rather than all at once when it finishes. The
 * address carries a token the server prints at startup: without it the server refuses,
 * so a page the user did not open cannot reach an interpreter on their machine.
 */
export const localTransport = (address: string, onMessage: MessageHandler): Transport => {
  let stopped = false;
  /**
   * Every request still open.
   *
   * More than one can be. A question about what names the session holds is asked while
   * a solve is still streaming its output back, and each is a request of its own. Held
   * as a single controller, a later request overwrote the record of an earlier one, so
   * stopping abandoned whichever happened to be last and left the rest running.
   */
  const inFlight = new Set<AbortController>();

  const endpoint = (path: string): { url: string; token: string } => {
    const parsed = new URL(address);
    const token = parsed.searchParams.get('token') ?? '';
    return { url: new URL(path, parsed).href, token };
  };

  /**
   * Posts one message and feeds every reply it streams back to the handler.
   *
   * Nothing waits on this — it is called and dropped — so a failure that escaped would
   * be an unhandled rejection and, worse, silent: a console left sitting at "starting"
   * with nothing said about why. Everything is therefore inside the one try, including
   * the address, which is read from a field someone typed into and need not parse.
   */
  const exchange = async (path: string, message: HostMessage): Promise<void> => {
    const controller = new AbortController();
    inFlight.add(controller);
    try {
      const { url, token } = endpoint(path);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-nemo-token': token },
        body: JSON.stringify(message),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        onMessage({
          kind: 'boot-failed',
          error:
            response.status === 403
              ? 'the local interpreter refused this address: its token is wrong or has changed'
              : `the local interpreter answered ${response.status}`,
        });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        // Replies are one JSON document per line, so a partial last line waits for more.
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';
        for (const line of lines) {
          if (line.trim().length === 0) continue;
          if (!stopped) onMessage(JSON.parse(line) as WorkerMessage);
        }
      }
    } catch (error) {
      // Stopping aborts what is open, so the failure that follows is this side's own
      // doing and not worth reporting. A restart during a solve goes through here every
      // time, since the read of a stream that is still arriving is what gets abandoned.
      if (stopped || controller.signal.aborted) return;
      onMessage({
        kind: 'boot-failed',
        error:
          `the exchange with a local interpreter at ${address} failed (${String(error)}). ` +
          'Check the address, and that one is running: python src/python/console_server.py',
      });
    } finally {
      inFlight.delete(controller);
    }
  };

  return {
    send: (message) => {
      if (stopped) return;
      // The server dispatches on the message's own `kind` and pays the path no
      // attention, so this only has to be a path it will answer at all.
      const path = message.kind === 'boot' ? 'boot' : message.kind === 'run' ? 'run' : 'reset';
      void exchange(path, message);
    },
    stop: () => {
      stopped = true;
      // Abandoning the requests is all this side can do; the server notices the
      // connections go and abandons the runs with them.
      for (const controller of inFlight) controller.abort();
      inFlight.clear();
    },
  };
};
