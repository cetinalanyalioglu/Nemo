import React, { useState, useEffect } from 'react';
import { useNodeContext } from '../context/NodeContext';
import '../styles/properties-panel.css';
import { IoSettingsOutline, IoAdd, IoRemove, IoChevronDown, IoCheckbox, IoSquareOutline } from 'react-icons/io5';
import { elementInfo } from './nodes/nodeTypes';

const formatCategoryName = (category) => {
    return category.toUpperCase().replace(/I/g, 'I');
};

const formatTitle = (title) => {
    return title.toUpperCase().replace(/I/g, 'I');
};

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

    // Parametreleri kategorilerine göre grupla
    const groupedParameters = Object.entries(nodeState.parameters).reduce((acc, [key, value]) => {
        // Node tipini elementInfo'dan bul
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

    const handleNumberChange = (nodeId, paramKey, info, newValue) => {
        // Min/max kontrolü
        if (info.min !== undefined && newValue < info.min) newValue = info.min;
        if (info.max !== undefined && newValue > info.max) newValue = info.max;
        
        updateNodeParameter(nodeId, paramKey, newValue);
    };

    const incrementValue = (value, step, info) => {
        const newValue = value + (step || 1);
        return info.max !== undefined ? Math.min(newValue, info.max) : newValue;
    };

    const decrementValue = (value, step, info) => {
        const newValue = value - (step || 1);
        return info.min !== undefined ? Math.max(newValue, info.min) : newValue;
    };

    const toggleGroup = (category) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    return (
        <div className={`properties-panel-container ${isOpen ? 'open' : ''}`}>
            <div className="properties-panel">
                <div className="panel-header">
                    <IoSettingsOutline className="panel-icon" />
                    <span className="panel-title">{formatTitle('Node Properties')}</span>
                </div>
                
                {Object.entries(groupedParameters).map(([category, parameters]) => (
                    <div key={category} className={`parameter-group ${collapsedGroups[category] ? 'collapsed' : ''}`}>
                        <div 
                            className="group-header"
                            onClick={() => toggleGroup(category)}
                        >
                            <div className="group-header-content">
                                <span>{formatCategoryName(category)}</span>
                                <IoChevronDown className="group-collapse-icon" />
                            </div>
                        </div>
                        <div className="group-content">
                            {parameters.map(({ key, value, info }) => (
                                <div key={key} className="parameter-row">
                                    {info.type === 'boolean' ? (
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