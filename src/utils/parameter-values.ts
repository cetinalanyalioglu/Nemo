/**
 * Reading a numeric parameter field back into the value that is stored.
 *
 * Most numeric parameters hold one number. A parameter marked `perBranch` in the
 * model definition holds either one number or one per branch, written as a
 * comma-separated list, so an element wired with several ports can carry a
 * distinct value on each of them. Keeping the parsing here means a list typed
 * into the panel, or loaded from a case file, is read back as a list rather than
 * collapsing to its first entry.
 *
 * Exports: `validateNumber`, `parseNumericParameter`.
 */
import type { ParameterInfo } from '../types/flow';

export type ValidateNumberResult = { isValid: true } | { isValid: false; message: string };

/** The value a numeric field parses to, or the reason it was rejected. */
export type ParsedNumeric = { value: number | number[] } | { message: string };

const INVALID_NUMBER = 'Please enter a valid number';

/**
 * Checks one number against the parameter's declared range.
 */
export const validateNumber = (value: number, info: ParameterInfo): ValidateNumberResult => {
  if (info.type === 'number' || info.type === 'float') {
    if (info.min !== undefined && value < (info.min as number)) {
      return {
        isValid: false,
        message: `Value must be at least ${info.min}${info.unit ? ' ' + info.unit : ''}`,
      };
    }
    if (info.max !== undefined && value > (info.max as number)) {
      return {
        isValid: false,
        message: `Value must not exceed ${info.max}${info.unit ? ' ' + info.unit : ''}`,
      };
    }
  }
  return { isValid: true as const };
};

/**
 * Parses a numeric field into the value to store.
 *
 * A per-branch parameter is split on commas and every entry is range-checked, so
 * one bad entry rejects the whole field rather than being silently dropped. A
 * single entry stores as a plain number whether or not the parameter is
 * per-branch, which leaves the ordinary case exactly as it was.
 */
export const parseNumericParameter = (info: ParameterInfo, raw: string): ParsedNumeric => {
  if (!info.perBranch && raw.includes(',')) {
    // a lone number is all this parameter can hold, so a list is refused rather than
    // read as its first entry, which would discard the rest without saying so
    return { message: 'This parameter takes a single number' };
  }
  const parts = info.perBranch ? raw.split(',') : [raw];
  const values: number[] = [];
  for (const part of parts) {
    if (part.trim() === '') {
      return { message: INVALID_NUMBER };
    }
    const num = parseFloat(part);
    if (isNaN(num)) {
      return { message: INVALID_NUMBER };
    }
    const validation = validateNumber(num, info);
    if (!validation.isValid) {
      return { message: validation.message };
    }
    values.push(num);
  }
  return { value: values.length === 1 ? values[0] : values };
};
