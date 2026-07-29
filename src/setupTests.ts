// jsdom (the vitest test environment) does not provide `crypto.randomUUID`, which
// consoleStore uses to key log entries. Back the global with Node's webcrypto so
// store appends work under test exactly as they do in the browser.
import { webcrypto } from 'crypto';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

if (
  typeof globalThis.crypto === 'undefined' ||
  typeof globalThis.crypto.randomUUID !== 'function'
) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

// Testing Library unmounts what it rendered after each test, but only registers that
// itself when `afterEach` is a global. Test files here import from `vitest` explicitly
// instead, so nothing registers it and every render stays in the document: the second
// case in a file then finds two of each element and fails as though the component had
// rendered twice. Registering it here rather than per file means a render test written
// later is right without its author having to know any of this.
afterEach(cleanup);
