import React, { useMemo, useState } from 'react';
import { IoAdd, IoRemove, IoChevronDown, IoCheckbox, IoSquareOutline } from 'react-icons/io5';
import type { ParameterInfo, ParameterValues, VisibilityCondition } from '../types/flow';

const formatCategoryName = (category: string) => category.toUpperCase().replace(/I/g, 'I');

const modelParameterGroupKey = (category: string) => `__model_param_${category}__`;

type ParameterFormFieldsProps = {
  contextId: string;
  parameters: ParameterValues;
  parametersInfo: Record<string, ParameterInfo>;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (category: string) => void;
  onUpdateParameter: (key: string, value: unknown) => void;
};

type ValidateNumberResult = { isValid: true } | { isValid: false; message: string };

const validateNumber = (value: number, info: ParameterInfo): ValidateNumberResult => {
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
  return { isValid: true };
};

const getSafeValue = (value: unknown, info: ParameterInfo) => {
  if (value === undefined || value === null) {
    switch (info.type as string | undefined) {
      case 'number':
      case 'float':
        return '';
      case 'string':
        return '';
      case 'boolean':
        return false;
      default:
        return '';
    }
  }
  return value as string | number | boolean;
};

const evaluateCondition = (
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
    return condition.and.every((subCond) => evaluateCondition(subCond, parameters));
  }

  if ('or' in condition && condition.or) {
    return condition.or.some((subCond) => evaluateCondition(subCond, parameters));
  }

  return true;
};

const isParameterVisible = (paramInfo: ParameterInfo | undefined, parameters: ParameterValues) => {
  if (!paramInfo) return true;
  if (paramInfo.visible === false) return false;
  if (paramInfo.visibleIf) {
    return evaluateCondition(paramInfo.visibleIf as VisibilityCondition, parameters);
  }
  return true;
};

const isParameterEditable = (paramInfo: ParameterInfo | undefined) => {
  if (!paramInfo) return true;
  return paramInfo.editable !== false;
};

export const ParameterFormFields = ({
  contextId,
  parameters,
  parametersInfo,
  collapsedGroups,
  onToggleGroup,
  onUpdateParameter,
}: ParameterFormFieldsProps) => {
  const [invalidInputs, setInvalidInputs] = useState<Record<string, string | undefined>>({});
  const [tempValues, setTempValues] = useState<Record<string, string>>({});

  const groupedParameters = useMemo(() => {
    return Object.entries(parametersInfo).reduce(
      (acc, [key, info]) => {
        const parameterInfo: ParameterInfo = info;
        const value = parameters[key] ?? info.defaultValue;
        const category = (parameterInfo.category as string | undefined) || 'Other';

        if (!acc[category]) {
          acc[category] = [];
        }

        acc[category].push({ key, value, info: parameterInfo });
        return acc;
      },
      {} as Record<string, Array<{ key: string; value: unknown; info: ParameterInfo }>>
    );
  }, [parameters, parametersInfo]);

  const handleInputChange = (paramKey: string, info: ParameterInfo, value: string) => {
    if (info.type === 'number' || info.type === 'float') {
      if (!/^-?\d*\.?\d*$/.test(value)) return;
    }

    const tempValueKey = `${contextId}_${paramKey}`;
    setInvalidInputs((prev) => ({ ...prev, [tempValueKey]: undefined }));
    setTempValues((prev) => ({ ...prev, [tempValueKey]: value }));
  };

  const handleInputBlur = (paramKey: string, info: ParameterInfo, value: string) => {
    const tempValueKey = `${contextId}_${paramKey}`;

    if (info.type === 'number' || info.type === 'float') {
      const numValue = parseFloat(value);

      if (isNaN(numValue)) {
        setInvalidInputs((prev) => ({
          ...prev,
          [tempValueKey]: 'Please enter a valid number',
        }));
        return;
      }

      const validation = validateNumber(numValue, info);
      if (!validation.isValid) {
        setInvalidInputs((prev) => ({
          ...prev,
          [tempValueKey]: validation.message,
        }));
        return;
      }

      onUpdateParameter(paramKey, numValue);
    } else {
      onUpdateParameter(paramKey, value);
    }

    setInvalidInputs((prev) => {
      const next = { ...prev };
      delete next[tempValueKey];
      return next;
    });
    setTempValues((prev) => {
      const next = { ...prev };
      delete next[tempValueKey];
      return next;
    });
  };

  const incrementValue = (
    value: string | number,
    step: number | undefined,
    info: ParameterInfo
  ) => {
    const currentValue = parseFloat(String(value)) || 0;
    const increment = step || (typeof info.step === 'number' ? info.step : undefined) || 1;
    const newValue = currentValue + increment;
    const validation = validateNumber(newValue, info);
    if (!validation.isValid) return currentValue;
    return newValue;
  };

  const decrementValue = (
    value: string | number,
    step: number | undefined,
    info: ParameterInfo
  ) => {
    const currentValue = parseFloat(String(value)) || 0;
    const decrement = step || (typeof info.step === 'number' ? info.step : undefined) || 1;
    const newValue = currentValue - decrement;
    const validation = validateNumber(newValue, info);
    if (!validation.isValid) return currentValue;
    return newValue;
  };

  if (Object.keys(groupedParameters).length === 0) {
    return <p className="model-pane-empty">No model parameters defined for this model.</p>;
  }

  return (
    <>
      {Object.entries(groupedParameters).map(([category, categoryParameters]) => {
        const groupKey = modelParameterGroupKey(category);
        return (
          <div
            key={category}
            className={`parameter-group ${collapsedGroups[groupKey] ? 'collapsed' : ''}`}
          >
            <div className="group-header" onClick={() => onToggleGroup(groupKey)}>
              <div className="group-header-content">
                <span>{formatCategoryName(category)}</span>
                <IoChevronDown className="group-collapse-icon" />
              </div>
            </div>
            <div className="group-content">
              {categoryParameters.map(({ key, value, info }) => {
                if (!isParameterVisible(info, parameters)) return null;

                const isEditable = isParameterEditable(info);
                const tempValueKey = `${contextId}_${key}`;

                return (
                  <div key={key} className="parameter-row">
                    {info.type === 'boolean' ? (
                      <div className="boolean-parameter-row">
                        <label className="parameter-label">{info.label || key}</label>
                        <div
                          className={`checkbox-wrapper ${value ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}`}
                          onClick={() => isEditable && onUpdateParameter(key, !value)}
                        >
                          {value ? <IoCheckbox /> : <IoSquareOutline />}
                        </div>
                      </div>
                    ) : (
                      <>
                        <label className="parameter-label">{info.label || key}</label>
                        <div className="parameter-input-container">
                          <input
                            type={
                              info.type === 'number' || info.type === 'float' ? 'number' : 'text'
                            }
                            value={
                              tempValues[tempValueKey] !== undefined
                                ? tempValues[tempValueKey]
                                : String(getSafeValue(value, info) ?? '')
                            }
                            onChange={(e) =>
                              isEditable && handleInputChange(key, info, e.target.value)
                            }
                            onBlur={(e) => isEditable && handleInputBlur(key, info, e.target.value)}
                            className={`parameter-input ${invalidInputs[tempValueKey] ? 'invalid' : ''} ${!isEditable ? 'readonly' : ''}`}
                            title={invalidInputs[tempValueKey] || ''}
                            disabled={!isEditable}
                          />
                          {isEditable && info.type === 'number' && info.step !== undefined && (
                            <div className="number-controls">
                              <button
                                type="button"
                                className="number-control-btn"
                                onClick={() => {
                                  const newValue = incrementValue(
                                    tempValues[tempValueKey] !== undefined
                                      ? tempValues[tempValueKey]
                                      : String(value ?? ''),
                                    typeof info.step === 'number' ? info.step : undefined,
                                    info
                                  );
                                  setTempValues((prev) => ({
                                    ...prev,
                                    [tempValueKey]: newValue.toString(),
                                  }));
                                  onUpdateParameter(key, newValue);
                                }}
                                aria-label="Increase"
                              >
                                <IoAdd />
                              </button>
                              <button
                                type="button"
                                className="number-control-btn"
                                onClick={() => {
                                  const newValue = decrementValue(
                                    tempValues[tempValueKey] !== undefined
                                      ? tempValues[tempValueKey]
                                      : String(value ?? ''),
                                    typeof info.step === 'number' ? info.step : undefined,
                                    info
                                  );
                                  setTempValues((prev) => ({
                                    ...prev,
                                    [tempValueKey]: newValue.toString(),
                                  }));
                                  onUpdateParameter(key, newValue);
                                }}
                                aria-label="Decrease"
                              >
                                <IoRemove />
                              </button>
                            </div>
                          )}
                          {info.unit && <span className="parameter-unit">{info.unit}</span>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
};
