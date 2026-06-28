import { describe, expect, it } from 'vitest';
import { evaluateVisibilityCondition, isParameterVisible } from './parameter-conditions';
import type { ParameterInfo } from '../types/flow';

describe('evaluateVisibilityCondition', () => {
  it('treats an absent condition as always visible', () => {
    expect(evaluateVisibilityCondition(undefined, {})).toBe(true);
    expect(evaluateVisibilityCondition(null, {})).toBe(true);
  });

  it('resolves a self-scoped leaf against the element bag (default)', () => {
    const cond = { parameter: 'mode', equals: 'advanced' };
    expect(evaluateVisibilityCondition(cond, { mode: 'advanced' })).toBe(true);
    expect(evaluateVisibilityCondition(cond, { mode: 'simple' })).toBe(false);
    // An explicit scope: 'self' behaves identically.
    const explicit = { parameter: 'mode', scope: 'self' as const, equals: 'advanced' };
    expect(evaluateVisibilityCondition(explicit, { mode: 'advanced' })).toBe(true);
  });

  it('resolves a model-scoped leaf against the model bag, not the element bag', () => {
    const cond = { parameter: 'thermoModel', scope: 'model' as const, equals: 'equilibrium' };
    const elementBag = { thermoModel: 'perfect_gas' }; // must be ignored
    expect(evaluateVisibilityCondition(cond, elementBag, { thermoModel: 'equilibrium' })).toBe(
      true
    );
    expect(evaluateVisibilityCondition(cond, elementBag, { thermoModel: 'perfect_gas' })).toBe(
      false
    );
  });

  it('falls back to the element bag when no model bag is supplied for a model-scoped leaf', () => {
    const cond = { parameter: 'thermoModel', scope: 'model' as const, equals: 'equilibrium' };
    expect(evaluateVisibilityCondition(cond, { thermoModel: 'equilibrium' })).toBe(true);
  });

  it('forwards both bags through and/or combinators with mixed scopes', () => {
    const cond = {
      and: [
        { parameter: 'thermoModel', scope: 'model' as const, equals: 'equilibrium' },
        { parameter: 'boundaryType', equals: 'composition' },
      ],
    };
    const model = { thermoModel: 'equilibrium' };
    expect(evaluateVisibilityCondition(cond, { boundaryType: 'composition' }, model)).toBe(true);
    expect(evaluateVisibilityCondition(cond, { boundaryType: 'pressure' }, model)).toBe(false);
    expect(
      evaluateVisibilityCondition(
        cond,
        { boundaryType: 'composition' },
        { thermoModel: 'perfect_gas' }
      )
    ).toBe(false);

    const either = {
      or: [
        { parameter: 'thermoModel', scope: 'model' as const, equals: 'equilibrium' },
        { parameter: 'force', equals: true },
      ],
    };
    expect(
      evaluateVisibilityCondition(either, { force: true }, { thermoModel: 'perfect_gas' })
    ).toBe(true);
    expect(
      evaluateVisibilityCondition(either, { force: false }, { thermoModel: 'perfect_gas' })
    ).toBe(false);
  });
});

describe('isParameterVisible', () => {
  it('honors the static visible flag before any condition', () => {
    const info = { visible: false, visibleIf: { parameter: 'x', equals: 1 } } as ParameterInfo;
    expect(isParameterVisible(info, { x: 1 })).toBe(false);
  });

  it('threads the model bag into a model-scoped visibleIf', () => {
    const info = {
      visibleIf: { parameter: 'thermoModel', scope: 'model', equals: 'equilibrium' },
    } as ParameterInfo;
    expect(
      isParameterVisible(info, { thermoModel: 'perfect_gas' }, { thermoModel: 'equilibrium' })
    ).toBe(true);
    expect(
      isParameterVisible(info, { thermoModel: 'equilibrium' }, { thermoModel: 'perfect_gas' })
    ).toBe(false);
  });
});
