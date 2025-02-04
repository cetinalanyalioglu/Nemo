import React, { useContext } from 'react';
import { NodeContext } from './NodeContext';
import '../styles/propertiesPanel.css';

const PropertiesPanel = ({ selectedNodeId }) => {
    const { nodeStates, updateNodeParameter } = useContext(NodeContext);

    if (!selectedNodeId || !nodeStates[selectedNodeId]) {
        return <div className="properties-panel">No node selected</div>;
    }

    const nodeState = nodeStates[selectedNodeId];
    const parameters = nodeState.parameters;

    const handleInputChange = (paramName, value) => {
        updateNodeParameter(selectedNodeId, paramName, value);
    };

    return (
        <div className="properties-panel">
            <h3>Node Properties</h3>
            {Object.entries(parameters).map(([paramName, paramValue]) => (
                <div key={paramName} className="parameter-group">
                    <label>{paramName}</label>
                    <input
                        type="text"
                        value={paramValue}
                        onChange={(e) => handleInputChange(paramName, e.target.value)}
                    />
                </div>
            ))}
        </div>
    );
};

export default PropertiesPanel;