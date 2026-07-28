import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PYODIDE_INDEX_URL, PYODIDE_VERSION } from './python-runtime';

const ROOT = resolve(__dirname, '../..');
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));

describe('which interpreter the console fetches', () => {
  it('is the one the types are checked against', () => {
    // The distribution is fetched at run time and only its types are installed, so
    // nothing else would notice the two drifting apart -- the console would be typed
    // against one build of Pyodide and running another.
    const declared: string = packageJson.devDependencies.pyodide;
    expect(declared.replace(/^[\^~]/, '')).toBe(PYODIDE_VERSION);
  });

  it('is fetched from a version-pinned address', () => {
    expect(PYODIDE_INDEX_URL).toContain(`v${PYODIDE_VERSION}`);
    expect(PYODIDE_INDEX_URL.endsWith('/')).toBe(true);
  });
});

describe('the wheels the console installs', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(ROOT, 'public/wheels/manifest.json'), 'utf8')
  ) as { wheels: string[] };

  it('names files that are there to install', () => {
    // The app is served as static files, so a wheel the manifest names but the tree
    // does not carry is a console that starts and then has nothing in it.
    expect(manifest.wheels.length).toBeGreaterThan(0);
    for (const wheel of manifest.wheels) {
      expect(() => readFileSync(resolve(ROOT, 'public/wheels', wheel))).not.toThrow();
    }
  });

  it('names them relative to itself, so the app can be served from any base', () => {
    for (const wheel of manifest.wheels) {
      expect(wheel.startsWith('/')).toBe(false);
      expect(wheel).not.toContain('://');
    }
  });
});
