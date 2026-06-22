import type { ParameterInfo, ParameterValues, VisibilityCondition } from '../types/flow';

/**
 * Evaluates a parameter `visibleIf` condition against a parameter bag. Supports
 * leaf comparisons (`equals`, `greaterThan`, `lessThan`, `oneOf`) and the
 * `and`/`or` combinators. An absent condition is treated as "always true".
 */
export const evaluateVisibilityCondition = (
  condition: VisibilityCondition | undefined | null,
  parameters: ParameterValues
): boolean => {
  if (!condition) return true;

  if ('parameter' in condition && condition.parameter) {
    const paramValue = parameters[condition.parameter];

    if (condition.equals !== undefined) {
      return paramValue === condition.equals;
    }
    if (condition.greaterThan !== undefined) {
      return (paramValue as number) > condition.greaterThan;
    }
    if (condition.lessThan !== undefined) {
      return (paramValue as number) < condition.lessThan;
    }
    if (condition.oneOf !== undefined && Array.isArray(condition.oneOf)) {
      return condition.oneOf.includes(paramValue);
    }
  }

  if ('and' in condition && condition.and) {
    return condition.and.every((subCond) => evaluateVisibilityCondition(subCond, parameters));
  }

  if ('or' in condition && condition.or) {
    return condition.or.some((subCond) => evaluateVisibilityCondition(subCond, parameters));
  }

  return true;
};

/**
 * Whether a parameter is currently visible given the element's parameter values.
 * Combines the static `visible` flag with any `visibleIf` condition.
 */
export const isParameterVisible = (
  info: ParameterInfo | undefined,
  parameters: ParameterValues
): boolean => {
  if (!info) return true;
  if (info.visible === false) return false;
  if (info.visibleIf) {
    return evaluateVisibilityCondition(info.visibleIf as VisibilityCondition, parameters);
  }
  return true;
};
