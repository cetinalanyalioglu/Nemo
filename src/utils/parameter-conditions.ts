import type { ParameterInfo, ParameterValues, VisibilityCondition } from '../types/flow';

/**
 * Evaluates a parameter `visibleIf` condition against one or two parameter bags.
 * Supports leaf comparisons (`equals`, `greaterThan`, `lessThan`, `oneOf`) and
 * the `and`/`or` combinators. An absent condition is treated as "always true".
 *
 * A leaf with `scope: 'model'` resolves its `parameter` against `modelParameters`
 * (the model-level bag) instead of `parameters` (the element's own bag), letting a
 * node/edge parameter react to a global parameter. When `modelParameters` is
 * omitted, a `model`-scoped lookup falls back to `parameters`.
 */
export const evaluateVisibilityCondition = (
  condition: VisibilityCondition | undefined | null,
  parameters: ParameterValues,
  modelParameters?: ParameterValues
): boolean => {
  if (!condition) return true;

  if ('parameter' in condition && condition.parameter) {
    const bag = condition.scope === 'model' ? (modelParameters ?? parameters) : parameters;
    const paramValue = bag[condition.parameter];

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
    return condition.and.every((subCond) =>
      evaluateVisibilityCondition(subCond, parameters, modelParameters)
    );
  }

  if ('or' in condition && condition.or) {
    return condition.or.some((subCond) =>
      evaluateVisibilityCondition(subCond, parameters, modelParameters)
    );
  }

  return true;
};

/**
 * Whether a parameter is currently visible given the element's parameter values.
 * Combines the static `visible` flag with any `visibleIf` condition. Pass
 * `modelParameters` so a `scope: 'model'` condition can read the model-level bag.
 */
export const isParameterVisible = (
  info: ParameterInfo | undefined,
  parameters: ParameterValues,
  modelParameters?: ParameterValues
): boolean => {
  if (!info) return true;
  if (info.visible === false) return false;
  if (info.visibleIf) {
    return evaluateVisibilityCondition(
      info.visibleIf as VisibilityCondition,
      parameters,
      modelParameters
    );
  }
  return true;
};
