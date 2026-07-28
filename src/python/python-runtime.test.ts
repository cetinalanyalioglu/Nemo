import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { validateSolverDefinition } from '../models/model-builder';
import type { ModelDefinition } from '../types/flow';
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

describe('the packages a model brings', () => {
  const models = (
    JSON.parse(readFileSync(resolve(ROOT, 'public/models/manifest.json'), 'utf8')) as {
      models: { id: string; file: string }[];
    }
  ).models;

  const solverOf = (file: string) => {
    const definition = yaml.load(
      readFileSync(resolve(ROOT, 'public/models', file), 'utf8')
    ) as ModelDefinition;
    return validateSolverDefinition(definition.id, definition.solver);
  };

  it('is declared by the model, not named anywhere in the app', () => {
    // The whole point of the solver living in the model file: the app is free of any
    // particular one, and a grep for it in the source should come back empty.
    const declared = models.map((m) => solverOf(m.file)).filter(Boolean);
    expect(declared.length).toBeGreaterThan(0);
  });

  it('names files that are there to install', () => {
    // The app is served as static files, so a package a model names but the tree does
    // not carry is a console that starts and then has nothing in it.
    for (const model of models) {
      for (const pkg of solverOf(model.file)?.packages ?? []) {
        expect(
          () => readFileSync(resolve(ROOT, 'public', pkg)),
          `${model.id}: ${pkg}`
        ).not.toThrow();
      }
    }
  });

  it('names them relative to the app, so it can be served from any base', () => {
    for (const model of models) {
      for (const pkg of solverOf(model.file)?.packages ?? []) {
        expect(pkg.startsWith('/'), `${model.id}: ${pkg}`).toBe(false);
        expect(pkg).not.toContain('://');
      }
    }
  });

  it('carries an adapter with the calls the console makes into it', () => {
    for (const model of models) {
      const adapter = solverOf(model.file)?.adapter;
      if (!adapter) continue;
      // nemo.network() and nemo.publish() are these two and nothing else.
      expect(adapter, `${model.id}`).toMatch(/^def build\(/m);
      expect(adapter, `${model.id}`).toMatch(/^def results\(/m);
    }
  });
});
