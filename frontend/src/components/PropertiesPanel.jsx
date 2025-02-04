import React, { useContext } from 'react';
import { NodeContext } from './NodeContext';
import '../styles/properties-panel.css';
import { IoSettingsOutline } from 'react-icons/io5';

const formatCategoryName = (category) => {
    // Önce tüm metni büyük harfe çevir
    const upperCase = category.toUpperCase();
    
    // "I" harfini "I" ile değiştir
    return upperCase.replace(/I/g, 'I');
};

const PropertiesPanel = ({ selectedNodeId }) => {
    const { nodeStates, updateNodeParameter } = useContext(NodeContext);
    const nodeState = nodeStates[selectedNodeId];

    if (!nodeState) {
        return (
            <div className="properties-panel empty">
                <div className="panel-header">
                    <IoSettingsOutline className="panel-icon" />
                    <span>Properties</span>
                </div>
                <div className="no-element">
                    <p>No element selected</p>
                    <small>Select an element to edit its properties</small>
                </div>
            </div>
        );
    }

    // Parametreleri kategorilerine göre grupla
    const groupedParameters = Object.entries(nodeState.parameters).reduce((acc, [key, value]) => {
        const parameterInfo = require(`./nodeTypes/FlowNetwork/${selectedNodeId.split('_')[0]}`).elementInfo.parameters[key];
        const category = parameterInfo.category || 'Other';
        
        if (!acc[category]) {
            acc[category] = [];
        }
        
        acc[category].push({ key, value, info: parameterInfo });
        return acc;
    }, {});

    return (
        <div className="properties-panel">
            <div className="panel-header">
                <IoSettingsOutline className="panel-icon" />
                <span>Properties</span>
            </div>
            
            {Object.entries(groupedParameters).map(([category, parameters]) => (
                <div key={category} className="parameter-group">
                    <div className="group-header">{formatCategoryName(category)}</div>
                    {parameters.map(({ key, value, info }) => (
                        <div key={key} className="parameter-row">
                            <label className="parameter-label">
                                {info.label || key}
                            </label>
                            <div className="parameter-input-container">
                                <input
                                    type={info.type === 'float' ? 'number' : info.type}
                                    value={value}
                                    onChange={(e) => updateNodeParameter(
                                        selectedNodeId,
                                        key,
                                        info.type === 'float' ? parseFloat(e.target.value) : e.target.value
                                    )}
                                    min={info.min}
                                    max={info.max}
                                    step={info.type === 'float' ? 0.1 : 1}
                                    className="parameter-input"
                                />
                                {info.unit && <span className="parameter-unit">{info.unit}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default PropertiesPanel;