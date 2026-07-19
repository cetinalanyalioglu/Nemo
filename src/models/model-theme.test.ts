import { describe, expect, it } from 'vitest';
import { buildRuntimeModel, validateModelDefinition } from './model-builder';

/** Smallest definition that clears validation; `theme` is varied per test. */
const definition = (theme?: unknown) => ({
  id: 'test',
  name: 'Test',
  ...(theme === undefined ? {} : { theme }),
  nodes: {
    Source: {
      displayName: 'Source',
      category: 'Elements',
      ports: { target: [], source: ['0'] },
    },
  },
});

describe('per-model theme', () => {
  it('carries a known theme name through to the runtime model', () => {
    const model = buildRuntimeModel(validateModelDefinition(definition('nefes')));
    expect(model.theme).toBe('nefes');
  });

  it('leaves models without a theme on the default pair', () => {
    const model = buildRuntimeModel(validateModelDefinition(definition()));
    expect(model.theme).toBeNull();
  });

  it('rejects an unknown theme name rather than silently ignoring it', () => {
    expect(() => validateModelDefinition(definition('not-a-theme'))).toThrow(/unknown theme/i);
  });

  it('rejects a non-string theme', () => {
    expect(() => validateModelDefinition(definition({ accent: '#ea580c' }))).toThrow(
      /unknown theme/i
    );
  });
});
