import React, { useEffect, useState } from 'react';
import { useNodeContext } from '../context/NodeContext';
import { useAppState } from '../context/AppStateContext';
import '../styles/properties-panel.css';
import { IoSettingsOutline, IoAdd, IoRemove, IoChevronDown, IoCheckbox, IoSquareOutline } from 'react-icons/io5';
import { elementInfo } from './nodes/nodeTypes';

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
 * PropertiesPanel component displays and allows editing of selected node parameters.
 * Provides a collapsible interface grouped by parameter categories.
 * Supports different parameter types including numbers, strings, and booleans.
 * 
 * @returns {React.Component} Properties panel for editing node parameters
 */
const PropertiesPanel = () => {
    const { selectedNodeId, nodeStates, updateNodeParameter } = useNodeContext();
    const { 
        propertiesPanel: { isOpen, collapsedGroups },
        actions 
    } = useAppState();

    // Add state for tracking invalid inputs
    const [invalidInputs, setInvalidInputs] = useState({});
    // Add state for temporary values during editing
    const [tempValues, setTempValues] = useState({});

    // Update panel visibility when selected node changes
    useEffect(() => {
        actions.propertiesPanel.setIsOpen(!!selectedNodeId);
    }, [selectedNodeId, actions.propertiesPanel]);

    if (!selectedNodeId) return null;

    const nodeState = nodeStates[selectedNodeId];
    if (!nodeState) return null;

    // Group parameters by their categories
    const groupedParameters = Object.entries(nodeState.parameters).reduce((acc, [key, value]) => {
        // Find node type from elementInfo
        const nodeType = Object.entries(elementInfo).find(([_, info]) => 
            selectedNodeId.startsWith(info.type)
        )?.[1]?.type;

        const parameterInfo = elementInfo[nodeType].parameters[key];
        const category = parameterInfo?.category || 'Other';
        
        if (!acc[category]) {
            acc[category] = [];
        }
        
        acc[category].push({ key, value, info: parameterInfo });
        return acc;
    }, {});

    /**
     * Validates a numeric value against parameter constraints
     */
    const validateNumber = (value, info) => {
        // Handle both number and float types
        if (info.type === 'number' || info.type === 'float') {
            if (info.min !== undefined && value < info.min) {
                return {
                    isValid: false,
                    message: `Value must be at least ${info.min}${info.unit ? ' ' + info.unit : ''}`
                };
            }
            if (info.max !== undefined && value > info.max) {
                return {
                    isValid: false,
                    message: `Value must not exceed ${info.max}${info.unit ? ' ' + info.unit : ''}`
                };
            }
        }
        return { isValid: true };
    };

    /**
     * Handles changes during input
     */
    const handleInputChange = (nodeId, paramKey, info, value) => {
        // For numeric inputs, only allow numeric characters and decimal point
        if (info.type === 'number' || info.type === 'float') {
            if (!/^-?\d*\.?\d*$/.test(value)) return;
        }
        
        // Clear invalid state when user starts editing
        setInvalidInputs(prev => ({
            ...prev,
            [paramKey]: undefined
        }));
        
        // Update temporary value during editing
        setTempValues(prev => ({
            ...prev,
            [paramKey]: value
        }));
    };

    /**
     * Handles input completion (blur event)
     */
    const handleInputBlur = (nodeId, paramKey, info, value) => {
        if (info.type === 'number' || info.type === 'float') {
            const numValue = parseFloat(value);
            
            // Check if it's a valid number
            if (isNaN(numValue)) {
                setInvalidInputs(prev => ({
                    ...prev,
                    [paramKey]: 'Please enter a valid number'
                }));
                return;
            }

            // Validate against constraints
            const validation = validateNumber(numValue, info);
            if (!validation.isValid) {
                setInvalidInputs(prev => ({
                    ...prev,
                    [paramKey]: validation.message
                }));
                return;
            }

            // If we get here, the value is valid
            setInvalidInputs(prev => ({
                ...prev,
                [paramKey]: undefined
            }));
            
            // Clear temporary value and update node state
            setTempValues(prev => ({
                ...prev,
                [paramKey]: undefined
            }));
            updateNodeParameter(nodeId, paramKey, numValue);
        } else {
            // For non-numeric types, just update the value
            updateNodeParameter(nodeId, paramKey, value);
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
                    return '';  // or return '0' if you prefer
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
        const increment = step || (info.step || 1); // Use parameter's step if defined, otherwise 1
        const newValue = currentValue + increment;
        
        // Validate the new value
        const validation = validateNumber(newValue, info);
        if (!validation.isValid) {
            setInvalidInputs(prev => ({
                ...prev,
                [info.key]: validation.message
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
        const decrement = step || (info.step || 1); // Use parameter's step if defined, otherwise 1
        const newValue = currentValue - decrement;
        
        // Validate the new value
        const validation = validateNumber(newValue, info);
        if (!validation.isValid) {
            setInvalidInputs(prev => ({
                ...prev,
                [info.key]: validation.message
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
            return condition.and.every(subCond => evaluateCondition(subCond, nodeState));
        }

        if (condition.or) {
            return condition.or.some(subCond => evaluateCondition(subCond, nodeState));
        }

        return true;
    };

    /**
     * Determines if a parameter should be visible based on its configuration
     */
    const isParameterVisible = (paramInfo, nodeState) => {
        // Check explicit visibility flag
        if (paramInfo.visible === false) return false;
        
        // Check visibility conditions
        if (paramInfo.visibleIf) {
            return evaluateCondition(paramInfo.visibleIf, nodeState);
        }

        return true;
    };

    /**
     * Determines if a parameter is editable
     */
    const isParameterEditable = (paramInfo, nodeState) => {
        if (paramInfo.editable === false) return false;
        
        // Could also add conditional editability here if needed
        return true;
    };

    return (
        <div className={`properties-panel-container ${isOpen ? 'open' : ''}`}>
            <div className="properties-panel">
                {/* Panel header */}
                <div className="panel-header">
                    <IoSettingsOutline className="panel-icon" />
                    <span className="panel-title">{formatTitle('Node Properties')}</span>
                </div>
                
                {/* Parameter groups */}
                {Object.entries(groupedParameters).map(([category, parameters]) => (
                    <div key={category} className={`parameter-group ${collapsedGroups[category] ? 'collapsed' : ''}`}>
                        {/* Group header with collapse toggle */}
                        <div 
                            className="group-header"
                            onClick={() => actions.propertiesPanel.toggleGroup(category)}
                        >
                            <div className="group-header-content">
                                <span>{formatCategoryName(category)}</span>
                                <IoChevronDown 
                                    className="group-collapse-icon" 
                                    style={{ transform: collapsedGroups[category] ? 'rotate(-90deg)' : 'rotate(0deg)' }} 
                                />
                            </div>
                        </div>
                        {/* Group content with parameters */}
                        <div className="group-content">
                            {parameters.map(({ key, value, info }) => {
                                // Check visibility
                                if (!isParameterVisible(info, nodeState)) return null;

                                const isEditable = isParameterEditable(info, nodeState);

                                return (
                                    <div key={key} className="parameter-row">
                                        {info.type === 'boolean' ? (
                                            <div className="boolean-parameter-row">
                                                <label className="parameter-label">
                                                    {info.label || key}
                                                </label>
                                                <div 
                                                    className={`checkbox-wrapper ${value ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}`}
                                                    onClick={() => isEditable && updateNodeParameter(selectedNodeId, key, !value)}
                                                >
                                                    {value ? <IoCheckbox /> : <IoSquareOutline />}
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <label className="parameter-label">
                                                    {info.label || key}
                                                </label>
                                                <div className="parameter-input-container">
                                                    <input
                                                        type={info.type === 'number' || info.type === 'float' ? 'number' : 'text'}
                                                        value={tempValues[key] !== undefined 
                                                            ? tempValues[key] 
                                                            : formatNumber(getSafeValue(value, info))
                                                        }
                                                        onChange={(e) => isEditable && handleInputChange(selectedNodeId, key, info, e.target.value)}
                                                        onBlur={(e) => isEditable && handleInputBlur(selectedNodeId, key, info, e.target.value)}
                                                        className={`parameter-input 
                                                            ${invalidInputs[key] ? 'invalid' : ''} 
                                                            ${!isEditable ? 'readonly' : ''}`
                                                        }
                                                        title={invalidInputs[key] || ''}
                                                        disabled={!isEditable}
                                                    />
                                                    {isEditable && info.type === 'number' && info.step !== undefined && (
                                                        <div className="number-controls">
                                                            <button 
                                                                className="number-control-btn"
                                                                onClick={() => {
                                                                    const newValue = incrementValue(
                                                                        tempValues[key] !== undefined ? tempValues[key] : value,
                                                                        info.step,
                                                                        info
                                                                    );
                                                                    // Update temp value during editing
                                                                    setTempValues(prev => ({
                                                                        ...prev,
                                                                        [key]: newValue.toString()
                                                                    }));
                                                                    // Also update node parameter
                                                                    updateNodeParameter(selectedNodeId, key, newValue);
                                                                }}
                                                            >
                                                                <IoAdd />
                                                            </button>
                                                            <button 
                                                                className="number-control-btn"
                                                                onClick={() => {
                                                                    const newValue = decrementValue(
                                                                        tempValues[key] !== undefined ? tempValues[key] : value,
                                                                        info.step,
                                                                        info
                                                                    );
                                                                    // Update temp value during editing
                                                                    setTempValues(prev => ({
                                                                        ...prev,
                                                                        [key]: newValue.toString()
                                                                    }));
                                                                    // Also update node parameter
                                                                    updateNodeParameter(selectedNodeId, key, newValue);
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