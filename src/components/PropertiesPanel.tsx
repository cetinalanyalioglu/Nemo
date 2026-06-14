import React, { useEffect, useState, useMemo } from 'react';
import type {
  ParameterInfo,
  VisibilityCondition,
  NodeRuntimeState,
  EdgeRuntimeState,
} from '../types/flow';
import { useGraphStore } from '../store/graphStore';
import { useAppState } from '../context/AppStateContext';
import { useModel } from '../context/ModelContext';
import '../styles/properties-panel.css';
import {
  IoSettingsOutline,
  IoAdd,
  IoRemove,
  IoChevronDown,
  IoCheckbox,
  IoSquareOutline,
  IoGitBranch,
} from 'react-icons/io5';

/**
 * Formats a category name to uppercase, preserving 'I' characters
 * @param {string} category The category name to format
 * @returns {string} Formatted category name
 */
const formatCategoryName = (category: string) => {
  return category.toUpperCase().replace(/I/g, 'I');
};

const formatTitle = (title: string) => {
  return title.toUpperCase().replace(/I/g, 'I');
};

/**
 * PropertiesPanel component displays and allows editing of selected node or edge parameters.
 * Provides a collapsible interface grouped by parameter categories.
 * Supports different parameter types including numbers, strings, and booleans.
 * For nodes, displays node-specific parameters defined in elementInfo.
 * For edges, displays edge-specific parameters defined in edgeInfo.
 *
 * @returns {React.Component} Properties panel for editing element parameters
 */
const PropertiesPanel = React.memo(() => {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);
  const updateNodeParameter = useGraphStore((s) => s.updateNodeParameter);
  const updateEdgeParameter = useGraphStore((s) => s.updateEdgeParameter);
  const elementState = useGraphStore((s) =>
    s.selectedEdgeId
      ? s.edgeStates[s.selectedEdgeId]
      : s.selectedNodeId
        ? s.nodeStates[s.selectedNodeId]
        : undefined
  );
  // Returns a primitive type string, so this re-renders only when the selected
  // node's type changes (not on every node move).
  const selectedNodeType = useGraphStore((s) =>
    s.selectedNodeId ? (s.nodes.find((n) => n.id === s.selectedNodeId)?.type ?? null) : null
  );
  const selectedEdgeType = useGraphStore((s) =>
    s.selectedEdgeId ? (s.edges.find((e) => e.id === s.selectedEdgeId)?.type ?? null) : null
  );

  const {
    propertiesPanel: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  const { model } = useModel();
  const elementInfo = useMemo(() => model?.elementInfo ?? {}, [model]);
  const edgeInfo = useMemo(() => model?.edgeInfo ?? {}, [model]);

  // Extract setIsOpen for stable reference in useEffect
  const setIsOpen = actions.propertiesPanel.setIsOpen;

  // Add state for tracking invalid inputs
  const [invalidInputs, setInvalidInputs] = useState<Record<string, string | undefined>>({});
  const [tempValues, setTempValues] = useState<Record<string, string>>({});

  // Clear temporary values when switching between elements
  useEffect(() => {
    setTempValues({});
    setInvalidInputs({});
  }, [selectedNodeId, selectedEdgeId]);

  // Update panel visibility when selected element changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setIsOpen(!!(selectedNodeId || selectedEdgeId));
    // Note: This effect intentionally sets state based on selection to sync panel visibility
    // The warning about cascading renders is acceptable here as the state change is minimal
  }, [selectedNodeId, selectedEdgeId, setIsOpen]);

  // Get the appropriate state and info based on selection
  const isEdge = !!selectedEdgeId;
  const selectedId = isEdge ? selectedEdgeId! : selectedNodeId!;

  // Must be called before early returns to satisfy Rules of Hooks
  const elementType = useMemo(() => {
    if (!selectedNodeId && !selectedEdgeId) return null;
    if (isEdge) {
      return selectedEdgeType;
    }
    return selectedNodeType;
  }, [isEdge, selectedNodeType, selectedEdgeType, selectedNodeId, selectedEdgeId]);

  // Get parameters info based on element type
  // Must be called before early returns to satisfy Rules of Hooks
  const parametersInfo = useMemo(() => {
    if (!elementType) return {} as Record<string, ParameterInfo>;
    if (isEdge) {
      return edgeInfo[elementType]?.parameters || {};
    }
    return elementInfo[elementType]?.parameters || {};
  }, [isEdge, elementType, elementInfo, edgeInfo]);

  // Group parameters by their categories - memoized to avoid recalculation on every render
  // Must be called before early returns to satisfy Rules of Hooks
  const groupedParameters = useMemo(() => {
    if (!elementState?.parameters)
      return {} as Record<string, Array<{ key: string; value: unknown; info: ParameterInfo }>>;
    return Object.entries(elementState.parameters).reduce(
      (acc, [key, value]) => {
        const parameterInfo: ParameterInfo =
          parametersInfo[key] ||
          ({
            label: key,
            category: 'Other',
            type: typeof value as string,
            editable: true,
            visible: true,
          } as ParameterInfo);
        const category = (parameterInfo.category as string | undefined) || 'Other';

        if (!acc[category]) {
          acc[category] = [];
        }

        acc[category].push({ key, value, info: parameterInfo });
        return acc;
      },
      {} as Record<string, Array<{ key: string; value: unknown; info: ParameterInfo }>>
    );
  }, [elementState, parametersInfo]);

  // Early return if no selection - must be after all hooks
  if (!selectedNodeId && !selectedEdgeId) return null;
  if (!elementState) return null;

  const updateParameter = isEdge ? updateEdgeParameter : updateNodeParameter;

  type ValidateNumberResult = { isValid: true } | { isValid: false; message: string };

  const validateNumber = (value: number, info: ParameterInfo): ValidateNumberResult => {
    // Handle both number and float types
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
   * Handles changes during input
   * @param {string} elementId - The ID of the element being edited
   * @param {string} paramKey - The parameter key being changed
   * @param {Object} info - Parameter metadata
   * @param {string} value - New value from the input
   */
  const handleInputChange = (
    elementId: string,
    paramKey: string,
    info: ParameterInfo,
    value: string
  ) => {
    if (info.type === 'number' || info.type === 'float') {
      if (!/^-?\d*\.?\d*$/.test(value)) return;
    }

    // Clear invalid state when user starts editing
    setInvalidInputs((prev) => ({
      ...prev,
      [`${elementId}_${paramKey}`]: undefined,
    }));

    // Update temporary value during editing
    setTempValues((prev) => ({
      ...prev,
      [`${elementId}_${paramKey}`]: value,
    }));
  };

  /**
   * Handles input completion (blur event)
   * @param {string} elementId - The ID of the element being edited
   * @param {string} paramKey - The parameter key being changed
   * @param {Object} info - Parameter metadata
   * @param {string} value - Final value from the input
   */
  const handleInputBlur = (
    elementId: string,
    paramKey: string,
    info: ParameterInfo,
    value: string
  ) => {
    if (info.type === 'number' || info.type === 'float') {
      const numValue = parseFloat(value);

      // Check if it's a valid number
      if (isNaN(numValue)) {
        setInvalidInputs((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: 'Please enter a valid number',
        }));
        return;
      }

      // Validate against constraints
      const validation = validateNumber(numValue, info);
      if (!validation.isValid) {
        setInvalidInputs((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: validation.message,
        }));
        return;
      }

      // If we get here, try to update the value
      const updateSuccess = (
        updateParameter as (id: string, key: string, val: unknown) => boolean | void
      )(elementId, paramKey, numValue);

      if (!updateSuccess) {
        // If update failed, keep the old value and show error
        setInvalidInputs((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: 'Parameter update was rejected',
        }));
        // Reset to the current value in the node state
        setTempValues((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: String(elementState.parameters[paramKey] ?? ''),
        }));
        return;
      }

      // If update succeeded, clear temporary value and invalid state
      setInvalidInputs((prev) => {
        const newState = { ...prev };
        delete newState[`${elementId}_${paramKey}`];
        return newState;
      });
      setTempValues((prev) => {
        const newState = { ...prev };
        delete newState[`${elementId}_${paramKey}`];
        return newState;
      });
    } else {
      // For non-numeric types, try to update the value
      const updateSuccess = (
        updateParameter as (id: string, key: string, val: unknown) => boolean | void
      )(elementId, paramKey, value);

      if (!updateSuccess) {
        // If update failed, keep the old value and show error
        setInvalidInputs((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]:
            paramKey === 'label'
              ? 'A node with this name already exists'
              : 'Parameter update was rejected',
        }));
        // Reset to the current value in the node state
        setTempValues((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: String(elementState.parameters[paramKey] ?? ''),
        }));
        return;
      }

      // If update succeeded, clear any error state
      setInvalidInputs((prev) => {
        const newState = { ...prev };
        delete newState[`${elementId}_${paramKey}`];
        return newState;
      });
      setTempValues((prev) => {
        const newState = { ...prev };
        delete newState[`${elementId}_${paramKey}`];
        return newState;
      });
    }
  };

  /**
   * Ensures a parameter value is never undefined for input fields
   * @param {*} value - The parameter value
   * @param {Object} info - Parameter info from elementInfo
   * @returns {*} A safe value for the input
   */
  const getSafeValue = (value: unknown, info: ParameterInfo) => {
    if (value === undefined || value === null) {
      // Return appropriate default based on parameter type
      switch (info.type as string | undefined) {
        case 'number':
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

  /**
   * Increments a numeric value while respecting max constraint
   */
  const incrementValue = (
    value: string | number,
    step: number | undefined,
    info: ParameterInfo & { key?: string }
  ) => {
    const currentValue = parseFloat(String(value)) || 0;
    const increment = step || (typeof info.step === 'number' ? info.step : undefined) || 1;
    const newValue = currentValue + increment;

    // Validate the new value
    const validation = validateNumber(newValue, info);
    if (!validation.isValid) {
      const key = String(info.key);
      setInvalidInputs((prev) => ({
        ...prev,
        [key]: validation.message,
      }));
      return currentValue;
    }

    return newValue;
  };

  /**
   * Decrements a numeric value while respecting min constraint
   */
  const decrementValue = (
    value: string | number,
    step: number | undefined,
    info: ParameterInfo & { key?: string }
  ) => {
    const currentValue = parseFloat(String(value)) || 0;
    const decrement = step || (typeof info.step === 'number' ? info.step : undefined) || 1;
    const newValue = currentValue - decrement;

    // Validate the new value
    const validation = validateNumber(newValue, info);
    if (!validation.isValid) {
      const key = String(info.key);
      setInvalidInputs((prev) => ({
        ...prev,
        [key]: validation.message,
      }));
      return currentValue;
    }

    return newValue;
  };

  /**
   * Evaluates a single condition
   */
  const evaluateCondition = (
    condition: VisibilityCondition | undefined | null,
    nodeState: NodeRuntimeState | EdgeRuntimeState
  ): boolean => {
    if (!condition) return true;

    if ('parameter' in condition && condition.parameter) {
      const paramValue = nodeState.parameters[condition.parameter];

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
      return condition.and.every((subCond) => evaluateCondition(subCond, nodeState));
    }

    if ('or' in condition && condition.or) {
      return condition.or.some((subCond) => evaluateCondition(subCond, nodeState));
    }

    return true;
  };

  /**
   * Determines if a parameter should be visible based on its configuration
   */
  const isParameterVisible = (
    paramInfo: ParameterInfo | undefined,
    eltState: NodeRuntimeState | EdgeRuntimeState
  ) => {
    // Handle case where paramInfo is undefined
    if (!paramInfo) return true;

    // Check explicit visibility flag
    if (paramInfo.visible === false) return false;

    // Check visibility conditions
    if (paramInfo.visibleIf) {
      return evaluateCondition(paramInfo.visibleIf as VisibilityCondition, eltState);
    }

    return true;
  };

  /**
   * Determines if a parameter is editable
   */
  const isParameterEditable = (paramInfo: ParameterInfo | undefined) => {
    // Handle case where paramInfo is undefined
    if (!paramInfo) return true;

    if (paramInfo.editable === false) return false;

    // Could also add conditional editability here if needed
    return true;
  };

  return (
    <div className={`properties-panel-container ${isOpen ? 'open' : ''}`}>
      <div className="properties-panel">
        {/* Panel header */}
        <div className="panel-header">
          {isEdge ? (
            <IoGitBranch className="panel-icon" />
          ) : (
            <IoSettingsOutline className="panel-icon" />
          )}
          <span className="panel-title">
            {formatTitle(isEdge ? 'Edge Properties' : 'Node Properties')}
          </span>
        </div>

        {/* Parameter groups */}
        {Object.entries(groupedParameters).map(([category, parameters]) => (
          <div
            key={category}
            className={`parameter-group ${collapsedGroups[category] ? 'collapsed' : ''}`}
          >
            {/* Group header with collapse toggle */}
            <div
              className="group-header"
              onClick={() => actions.propertiesPanel.toggleGroup(category)}
            >
              <div className="group-header-content">
                <span>{formatCategoryName(category)}</span>
                <IoChevronDown className="group-collapse-icon" />
              </div>
            </div>
            {/* Group content with parameters */}
            <div className="group-content">
              {parameters.map(({ key, value, info }) => {
                // Check visibility
                if (!isParameterVisible(info, elementState)) return null;

                const isEditable = isParameterEditable(info);
                const tempValueKey = `${selectedId}_${key}`;

                return (
                  <div key={key} className="parameter-row">
                    {info.type === 'boolean' ? (
                      <div className="boolean-parameter-row">
                        <label className="parameter-label">{info.label || key}</label>
                        <div
                          className={`checkbox-wrapper ${value ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}`}
                          onClick={() => isEditable && updateParameter(selectedId, key, !value)}
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
                              isEditable && handleInputChange(selectedId, key, info, e.target.value)
                            }
                            onBlur={(e) =>
                              isEditable && handleInputBlur(selectedId, key, info, e.target.value)
                            }
                            className={`parameter-input 
                                                            ${invalidInputs[tempValueKey] ? 'invalid' : ''} 
                                                            ${!isEditable ? 'readonly' : ''}`}
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
                                    { ...info, key }
                                  );
                                  // Update temp value during editing
                                  setTempValues((prev) => ({
                                    ...prev,
                                    [tempValueKey]: newValue.toString(),
                                  }));
                                  // Also update node parameter
                                  updateParameter(selectedId, key, newValue);
                                }}
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
                                    { ...info, key }
                                  );
                                  // Update temp value during editing
                                  setTempValues((prev) => ({
                                    ...prev,
                                    [tempValueKey]: newValue.toString(),
                                  }));
                                  // Also update node parameter
                                  updateParameter(selectedId, key, newValue);
                                }}
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
        ))}
      </div>
    </div>
  );
});

PropertiesPanel.displayName = 'PropertiesPanel';

export default PropertiesPanel;
