/**
 * That a drag never outlives the divider it started on.
 *
 * A drag listens on the document, so the pointer can leave the divider without the drag
 * ending. Those listeners therefore outlive the element they were added for, and the one
 * thing that must not happen is for them to outlive the drag as well: the divider can go
 * away mid-drag, since switching the arrangement away from the split unmounts it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createElement, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useSplitResize } from './use-split-resize';

// React 19 asks to be told this is a test environment before act() is used.
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** Every listener the drag put on the document, with the signal that should retire it. */
const watchDocumentListeners = () => {
  const added: { type: string; signal: AbortSignal | undefined }[] = [];
  const real = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation(((
    type: string,
    fn: EventListener,
    options?: boolean | AddEventListenerOptions
  ) => {
    const signal = typeof options === 'object' ? options?.signal : undefined;
    added.push({ type, signal });
    return real(type, fn, options as AddEventListenerOptions);
  }) as typeof document.addEventListener);
  return added;
};

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (root && host) act(() => root!.unmount());
  host?.remove();
  root = null;
  host = null;
  vi.restoreAllMocks();
});

/** Renders a divider wired to the hook, and hands back the element to press on. */
const renderDivider = (): HTMLDivElement => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);

  const Split = (): ReactElement => {
    const { splitRef, onDividerPointerDown } = useSplitResize(0.5, () => {});
    return createElement('div', { ref: splitRef, style: { width: '1000px' } }, [
      createElement('div', {
        key: 'handle',
        'data-handle': true,
        onPointerDown: onDividerPointerDown,
      }),
    ]);
  };

  act(() => root!.render(createElement(Split)));
  return host.querySelector('[data-handle]') as HTMLDivElement;
};

/** jsdom implements neither, and the hook is entitled to call both. */
const stubPointerCapture = (element: HTMLElement) => {
  let captured = false;
  element.setPointerCapture = () => {
    captured = true;
  };
  element.releasePointerCapture = () => {
    captured = false;
  };
  element.hasPointerCapture = () => captured;
};

const pressOn = (handle: HTMLDivElement) => {
  const event = new MouseEvent('pointerdown', { bubbles: true }) as MouseEvent & {
    pointerId: number;
  };
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => {
    handle.dispatchEvent(event);
  });
};

describe('a drag on the divider', () => {
  it('registers everything it listens for against a signal it can retire', () => {
    const added = watchDocumentListeners();
    const handle = renderDivider();
    stubPointerCapture(handle);

    // From here on, everything recorded belongs to the drag: React puts listeners of
    // its own on the document when a root mounts, and those are not this hook's.
    added.length = 0;
    pressOn(handle);

    const types = added.map((entry) => entry.type);
    expect(types).toContain('pointermove');
    expect(types).toContain('pointerup');
    // Without this a pointer the browser takes back leaves the drag listening forever.
    expect(types).toContain('pointercancel');
    expect(added.every((entry) => entry.signal !== undefined)).toBe(true);
    expect(added.some((entry) => entry.signal!.aborted)).toBe(false);
  });

  it('takes its listeners off the document when the divider is unmounted mid-drag', () => {
    const added = watchDocumentListeners();
    const handle = renderDivider();
    stubPointerCapture(handle);

    added.length = 0;
    pressOn(handle);
    expect(added).not.toHaveLength(0);
    expect(added.some((entry) => entry.signal!.aborted)).toBe(false);

    act(() => root!.unmount());
    root = null;

    // Switching the arrangement away from the split does exactly this.
    expect(added.every((entry) => entry.signal!.aborted)).toBe(true);
  });
});
