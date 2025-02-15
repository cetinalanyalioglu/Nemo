import React, { useState, useEffect } from 'react';
import { useNodeContext } from '../context/NodeContext';
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
    const [isOpen, setIsOpen] = useState(false);
    const { selectedNodeId, nodeStates, updateNodeParameter } = useNodeContext();
    const [collapsedGroups, setCollapsedGroups] = useState({});

    // Update panel visibility when selected node changes
    useEffect(() => {
        setIsOpen(!!selectedNodeId);
    }, [selectedNodeId]);

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
     * Toggles the collapsed state of a parameter group
     */
    const toggleGroup = (category) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
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
                            onClick={() => toggleGroup(category)}
                        >
                            <div className="group-header-content">
                                <span>{formatCategoryName(category)}</span>
                                <IoChevronDown className="group-collapse-icon" />
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
                                                    value={value}
                                                    onChange={(e) => handleNumberChange(
                                                        selectedNodeId,
                                                        key,
                                                        info,
                                                        info.type === 'float' ? parseFloat(e.target.value) : e.target.value
                                                    )}
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