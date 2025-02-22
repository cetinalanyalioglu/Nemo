import React, { useEffect, useState } from 'react';
import { useNodeContext } from '../context/NodeContext';
import { useAppState } from '../context/AppStateContext';
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
import { elementInfo } from './nodes/nodeTypes';
import { edgeInfo } from './edges/edgeTypes';

/**
 * Formats a category name to uppercase, preserving 'I' characters
 * @param {string} category The category name to format
 * @returns {string} Formatted category name
 */
const formatCategoryName = (category) => {
  return category.toUpperCase().replace(/I/g, 'I');
};

/**
 * Formats a title to uppercase, preserving 'I' characters
 * @param {string} title The title to format
 * @returns {string} Formatted title
 */
const formatTitle = (title) => {
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
const PropertiesPanel = () => {
  const {
    selectedNodeId,
    selectedEdgeId,
    nodeStates,
    edgeStates,
    updateNodeParameter,
    updateEdgeParameter,
  } = useNodeContext();

  const {
    propertiesPanel: { isOpen, collapsedGroups },
    actions,
  } = useAppState();

  // Add state for tracking invalid inputs
  const [invalidInputs, setInvalidInputs] = useState({});
  // Add state for temporary values during editing - now keyed by elementId and paramKey
  const [tempValues, setTempValues] = useState({});

  // Clear temporary values when switching between elements
  useEffect(() => {
    setTempValues({});
    setInvalidInputs({});
  }, [selectedNodeId, selectedEdgeId]);

  // Update panel visibility when selected element changes
  useEffect(() => {
    actions.propertiesPanel.setIsOpen(!!(selectedNodeId || selectedEdgeId));
  }, [selectedNodeId, selectedEdgeId, actions.propertiesPanel]);

  // Early return if no selection
  if (!selectedNodeId && !selectedEdgeId) return null;

  // Get the appropriate state and info based on selection
  const isEdge = !!selectedEdgeId;
  const selectedId = isEdge ? selectedEdgeId : selectedNodeId;
  const elementState = isEdge ? edgeStates[selectedEdgeId] : nodeStates[selectedNodeId];

  if (!elementState) return null;

  // Find element type and info
  const elementType = isEdge
    ? 'flow' // For now, all edges are flow edges
    : Object.entries(elementInfo).find(([, info]) => selectedNodeId.startsWith(info.type))?.[1]
        ?.type;

  // Get parameters info based on element type
  const parametersInfo = isEdge
    ? edgeInfo[elementType]?.parameters || {}
    : elementType
      ? elementInfo[elementType]?.parameters
      : {};

  // Group parameters by their categories
  const groupedParameters = Object.entries(elementState.parameters).reduce((acc, [key, value]) => {
    const parameterInfo = parametersInfo?.[key] || {
      label: key,
      category: 'Other',
      type: typeof value,
      editable: true,
      visible: true,
    };
    const category = parameterInfo.category || 'Other';

    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push({ key, value, info: parameterInfo });
    return acc;
  }, {});

  // Update the appropriate element's parameter
  const updateParameter = isEdge ? updateEdgeParameter : updateNodeParameter;

  /**
   * Validates a numeric value against parameter constraints
   */
  const validateNumber = (value, info) => {
    // Handle both number and float types
    if (info.type === 'number' || info.type === 'float') {
      if (info.min !== undefined && value < info.min) {
        return {
          isValid: false,
          message: `Value must be at least ${info.min}${info.unit ? ' ' + info.unit : ''}`,
        };
      }
      if (info.max !== undefined && value > info.max) {
        return {
          isValid: false,
          message: `Value must not exceed ${info.max}${info.unit ? ' ' + info.unit : ''}`,
        };
      }
    }
    return { isValid: true };
  };

  /**
   * Handles changes during input
   * @param {string} elementId - The ID of the element being edited
   * @param {string} paramKey - The parameter key being changed
   * @param {Object} info - Parameter metadata
   * @param {string} value - New value from the input
   */
  const handleInputChange = (elementId, paramKey, info, value) => {
    // For numeric inputs, only allow numeric characters and decimal point
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
  const handleInputBlur = (elementId, paramKey, info, value) => {
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
      const updateSuccess = updateParameter(elementId, paramKey, numValue);

      if (!updateSuccess) {
        // If update failed, keep the old value and show error
        setInvalidInputs((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: 'Parameter update was rejected',
        }));
        // Reset to the current value in the node state
        setTempValues((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: elementState.parameters[paramKey],
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
      const updateSuccess = updateParameter(elementId, paramKey, value);

      if (!updateSuccess) {
        // If update failed, keep the old value and show error
        setInvalidInputs((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: 'Parameter update was rejected',
        }));
        // Reset to the current value in the node state
        setTempValues((prev) => ({
          ...prev,
          [`${elementId}_${paramKey}`]: elementState.parameters[paramKey],
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
  const getSafeValue = (value, info) => {
    if (value === undefined || value === null) {
      // Return appropriate default based on parameter type
      switch (info.type) {
        case 'number':
          return ''; // or return '0' if you prefer
        case 'string':
          return '';
        case 'boolean':
          return false;
        default:
          return '';
      }
    }
    return value;
  };

  /**
   * Increments a numeric value while respecting max constraint
   */
  const incrementValue = (value, step, info) => {
    const currentValue = parseFloat(value) || 0;
    const increment = step || info.step || 1; // Use parameter's step if defined, otherwise 1
    const newValue = currentValue + increment;

    // Validate the new value
    const validation = validateNumber(newValue, info);
    if (!validation.isValid) {
      setInvalidInputs((prev) => ({
        ...prev,
        [info.key]: validation.message,
      }));
      return currentValue;
    }

    return newValue;
  };

  /**
   * Decrements a numeric value while respecting min constraint
   */
  const decrementValue = (value, step, info) => {
    const currentValue = parseFloat(value) || 0;
    const decrement = step || info.step || 1; // Use parameter's step if defined, otherwise 1
    const newValue = currentValue - decrement;

    // Validate the new value
    const validation = validateNumber(newValue, info);
    if (!validation.isValid) {
      setInvalidInputs((prev) => ({
        ...prev,
        [info.key]: validation.message,
      }));
      return currentValue;
    }

    return newValue;
  };

  /**
   * Formats a number to remove unnecessary trailing zeros
   * while preserving significant digits
   */
  // TODO Get rid of this
  const formatNumber = (value) => {
    if (typeof value !== 'number') return value;

    // Convert to string with high precision
    const str = value.toString();

    // If it's not a decimal number, return as is
    if (!str.includes('.')) return str;

    // Remove trailing zeros after decimal point
    // but keep at least one digit after decimal for float values
    const trimmed = str.replace(/\.?0+$/, '');

    // If it was a whole number (e.g., "1.0"), ensure we don't leave just a decimal point
    return trimmed.endsWith('.') ? trimmed + '0' : trimmed;
  };

  /**
   * Evaluates a single condition
   */
  const evaluateCondition = (condition, nodeState) => {
    if (!condition) return true;

    if (condition.parameter) {
      const paramValue = nodeState.parameters[condition.parameter];

      if (condition.equals !== undefined) {
        return paramValue === condition.equals;
      }
      if (condition.greaterThan !== undefined) {
        return paramValue > condition.greaterThan;
      }
      if (condition.lessThan !== undefined) {
        return paramValue < condition.lessThan;
      }
      if (condition.oneOf !== undefined) {
        return condition.oneOf.includes(paramValue);
      }
    }

    if (condition.and) {
      return condition.and.every((subCond) => evaluateCondition(subCond, nodeState));
    }

    if (condition.or) {
      return condition.or.some((subCond) => evaluateCondition(subCond, nodeState));
    }

    return true;
  };

  /**
   * Determines if a parameter should be visible based on its configuration
   */
  const isParameterVisible = (paramInfo, elementState) => {
    // Handle case where paramInfo is undefined
    if (!paramInfo) return true;

    // Check explicit visibility flag
    if (paramInfo.visible === false) return false;

    // Check visibility conditions
    if (paramInfo.visibleIf) {
      return evaluateCondition(paramInfo.visibleIf, elementState);
    }

    return true;
  };

  /**
   * Determines if a parameter is editable
   */
  const isParameterEditable = (paramInfo) => {
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
                <IoChevronDown
                  className="group-collapse-icon"
                  style={{
                    transform: collapsedGroups[category] ? 'rotate(-90deg)' : 'rotate(0deg)',
                  }}
                />
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
                                : formatNumber(getSafeValue(value, info))
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
                                className="number-control-btn"
                                onClick={() => {
                                  const newValue = incrementValue(
                                    tempValues[tempValueKey] !== undefined
                                      ? tempValues[tempValueKey]
                                      : value,
                                    info.step,
                                    info
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
                                className="number-control-btn"
                                onClick={() => {
                                  const newValue = decrementValue(
                                    tempValues[tempValueKey] !== undefined
                                      ? tempValues[tempValueKey]
                                      : value,
                                    info.step,
                                    info
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
};

export default PropertiesPanel;
