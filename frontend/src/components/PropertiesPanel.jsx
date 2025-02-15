import React, { useEffect } from 'react';
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
        isPropertiesPanelOpen,
        setIsPropertiesPanelOpen,
        propertiesCollapsedGroups,
        togglePropertiesGroup
    } = useAppState();

    // Update panel visibility when selected node changes
    useEffect(() => {
        setIsPropertiesPanelOpen(!!selectedNodeId);
    }, [selectedNodeId, setIsPropertiesPanelOpen]);

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
     * Handles changes to numeric parameter values
     * Enforces min/max constraints if defined
     */
    const handleNumberChange = (nodeId, paramKey, info, newValue) => {
        // Apply min/max constraints
        if (info.min !== undefined && newValue < info.min) newValue = info.min;
        if (info.max !== undefined && newValue > info.max) newValue = info.max;
        
        updateNodeParameter(nodeId, paramKey, newValue);
    };

    /**
     * Increments a numeric value while respecting max constraint
     */
    const incrementValue = (value, step, info) => {
        const newValue = value + (step || 1);
        return info.max !== undefined ? Math.min(newValue, info.max) : newValue;
    };

    /**
     * Decrements a numeric value while respecting min constraint
     */
    const decrementValue = (value, step, info) => {
        const newValue = value - (step || 1);
        return info.min !== undefined ? Math.max(newValue, info.min) : newValue;
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

    return (
        <div className={`properties-panel-container ${isPropertiesPanelOpen ? 'open' : ''}`}>
            <div className="properties-panel">
                {/* Panel header */}
                <div className="panel-header">
                    <IoSettingsOutline className="panel-icon" />
                    <span className="panel-title">{formatTitle('Node Properties')}</span>
                </div>
                
                {/* Parameter groups */}
                {Object.entries(groupedParameters).map(([category, parameters]) => (
                    <div key={category} className={`parameter-group ${propertiesCollapsedGroups[category] ? 'collapsed' : ''}`}>
                        {/* Group header with collapse toggle */}
                        <div 
                            className="group-header"
                            onClick={() => togglePropertiesGroup(category)}
                        >
                            <div className="group-header-content">
                                <span>{formatCategoryName(category)}</span>
                                <IoChevronDown 
                                    className="group-collapse-icon" 
                                    style={{ transform: propertiesCollapsedGroups[category] ? 'rotate(-90deg)' : 'rotate(0deg)' }} 
                                />
                            </div>
                        </div>
                        {/* Group content with parameters */}
                        <div className="group-content">
                            {parameters.map(({ key, value, info }) => (
                                <div key={key} className="parameter-row">
                                    {info.type === 'boolean' ? (
                                        // Boolean parameter input
                                        <div className="boolean-parameter-row">
                                            <label className="parameter-label">
                                                {info.label || key}
                                            </label>
                                            <div 
                                                className={`checkbox-wrapper ${value ? 'checked' : ''}`}
                                                onClick={() => updateNodeParameter(selectedNodeId, key, !value)}
                                            >
                                                {value ? <IoCheckbox /> : <IoSquareOutline />}
                                            </div>
                                        </div>
                                    ) : (
                                        // Numeric or string parameter input
                                        <>
                                            <label className="parameter-label">
                                                {info.label || key}
                                            </label>
                                            <div className="parameter-input-container">
                                                <input
                                                    type={info.type === 'float' ? 'number' : info.type}
                                                    value={getSafeValue(value, info)}
                                                    onChange={(e) => {
                                                        const newValue = info.type === 'float' 
                                                            ? parseFloat(e.target.value) 
                                                            : e.target.value;
                                                        handleNumberChange(selectedNodeId, key, info, newValue);
                                                    }}
                                                    min={info.min}
                                                    max={info.max}
                                                    step={info.type === 'float' ? 0.1 : 1}
                                                    className="parameter-input"
                                                />
                                                {/* Increment/decrement controls for numeric inputs */}
                                                {info.type === 'float' && (
                                                    <div className="number-controls">
                                                        <button 
                                                            className="number-control-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNumberChange(
                                                                    selectedNodeId,
                                                                    key,
                                                                    info,
                                                                    incrementValue(value, info.type === 'float' ? 0.1 : 1, info)
                                                                );
                                                            }}
                                                        >
                                                            <IoAdd />
                                                        </button>
                                                        <button 
                                                            className="number-control-btn"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleNumberChange(
                                                                    selectedNodeId,
                                                                    key,
                                                                    info,
                                                                    decrementValue(value, info.type === 'float' ? 0.1 : 1, info)
                                                                );
                                                            }}
                                                        >
                                                            <IoRemove />
                                                        </button>
                                                    </div>
                                                )}
                                                {/* Unit display if applicable */}
                                                {info.unit && <span className="parameter-unit">{info.unit}</span>}
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PropertiesPanel;