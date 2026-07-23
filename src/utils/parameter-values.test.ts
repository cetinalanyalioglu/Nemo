import { describe, it, expect } from 'vitest';
import { parseNumericParameter, validateNumber } from './parameter-values';
import type { ParameterInfo } from '../types/flow';

const scalar: ParameterInfo = { type: 'float', min: 0, max: 1 };
const perBranch: ParameterInfo = { type: 'float', min: 0, max: 1, perBranch: true };

describe('validateNumber', () => {
  it('accepts a value inside the declared range', () => {
    expect(validateNumber(0.5, scalar)).toEqual({ isValid: true });
  });

  it('rejects a value outside the declared range', () => {
    expect(validateNumber(1.5, scalar)).toMatchObject({ isValid: false });
    expect(validateNumber(-0.1, scalar)).toMatchObject({ isValid: false });
  });

  it('ignores the range on a non-numeric parameter', () => {
    expect(validateNumber(99, { type: 'string' })).toEqual({ isValid: true });
  });
});

describe('parseNumericParameter', () => {
  it('reads one number', () => {
    expect(parseNumericParameter(scalar, '0.4')).toEqual({ value: 0.4 });
  });

  it('rejects a non-number', () => {
    expect(parseNumericParameter(scalar, 'abc')).toMatchObject({ message: expect.any(String) });
    expect(parseNumericParameter(scalar, '')).toMatchObject({ message: expect.any(String) });
  });

  it('rejects a value outside the range', () => {
    expect(parseNumericParameter(scalar, '2')).toMatchObject({ message: expect.any(String) });
  });

  it('keeps a list on a per-branch parameter, one value per branch', () => {
    expect(parseNumericParameter(perBranch, '0.2, 0.6, 1')).toEqual({ value: [0.2, 0.6, 1] });
    // the list the panel renders back from a stored array parses to the same list
    expect(parseNumericParameter(perBranch, [0.2, 0.6, 1].join(', '))).toEqual({
      value: [0.2, 0.6, 1],
    });
  });

  it('stores a lone entry as a plain number even when per-branch', () => {
    expect(parseNumericParameter(perBranch, '0.4')).toEqual({ value: 0.4 });
  });

  it('range-checks every entry of a list', () => {
    expect(parseNumericParameter(perBranch, '0.2, 3.0')).toMatchObject({
      message: expect.any(String),
    });
  });

  it('rejects a list with a missing entry rather than dropping it', () => {
    expect(parseNumericParameter(perBranch, '0.2, , 1')).toMatchObject({
      message: expect.any(String),
    });
    expect(parseNumericParameter(perBranch, '0.2,')).toMatchObject({
      message: expect.any(String),
    });
  });

  it('refuses a list on a parameter that is not per-branch', () => {
    // without the opt-in the field takes one number, and a list is refused rather than
    // read as its first entry, which would discard the rest without saying so
    expect(parseNumericParameter(scalar, '0.2, 0.6, 1')).toMatchObject({
      message: expect.any(String),
    });
  });
});
