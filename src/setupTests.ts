// jsdom (the vitest test environment) does not provide `crypto.randomUUID`, which
// consoleStore uses to key log entries. Back the global with Node's webcrypto so
// store appends work under test exactly as they do in the browser.
import { webcrypto } from 'crypto';

if (
  typeof globalThis.crypto === 'undefined' ||
  typeof globalThis.crypto.randomUUID !== 'function'
) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
