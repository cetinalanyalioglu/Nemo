import React, { useState } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import '../../../styles/nodes.css';

export const elementInfo = {
    type: 'MassFlowInlet',
    ports: {
        source: ['port-0']
    },
    category: 'Single port elements',
    parameters: {
        label: {
            type: 'string',
            defaultValue: 'MassFlowInlet',
        },
        massFlowRate: {
            label: 'Mass Flow Rate',
            type: 'float',
            defaultValue: 1.0,
            unit: 'kg/s',
            category: 'Flow',
            min: 0,
            max: 100
        },
        temperature: {
            label: 'Temperature',
            type: 'float',
            defaultValue: 298.15,
            unit: 'K',
            category: 'Flow Properties',
            min: 0,
            max: 1000
        },
        pressure: {
            label: 'Total Pressure',
            type: 'float',
            defaultValue: 101325,
            unit: 'Pa',
            category: 'Flow Properties',
            min: 0,
            max: 1000000
        }
    }
};

const MassFlowInlet = ({ id, data, selected, nodeState, updateNodeParameter }) => {
    const edges = useStore((store) => store.edges);
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState('');

    if (!nodeState) {
        return <div>Loading...</div>;
    }

    const isPortConnected = (nodeId, portId) => {
        return edges.some(edge => 
            (edge.source === nodeId && edge.sourceHandle === portId) ||
            (edge.target === nodeId && edge.targetHandle === portId)
        );
    };

    const startEditing = () => {
        setTempLabel(nodeState.parameters.label);
        setIsEditing(true);
    };

    const onChange = (evt) => {
        setTempLabel(evt.target.value);
    };

    const finishEditing = () => {
        const newLabel = tempLabel.trim();
        if (newLabel) {
            updateNodeParameter(id, 'label', newLabel);
        }
        setIsEditing(false);
    };

    const onKeyDown = (evt) => {
        if (evt.key === 'Enter') {
            finishEditing();
        } else if (evt.key === 'Escape') {
            setIsEditing(false);
        }
    };

    return (
        <div className={`mass-flow-inlet-node ${selected ? 'selected' : ''}`}>
            {isEditing ? (
                <input
                    value={tempLabel}
                    onChange={onChange}
                    onBlur={finishEditing}
                    onKeyDown={onKeyDown}
                    autoFocus
                    className="node-input"
                    spellCheck="false"
                />
            ) : (
                <div 
                    className="node-label"
                    onDoubleClick={startEditing}
                >
                    {nodeState.parameters.label}
                </div>
            )}
            <div className="node-type">
                type: {data.type}
            </div>
            <div className="port-container">
                <span className="port-index">0</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="port-0"
                    className={`react-flow__handle ${isPortConnected(id, "port-0") ? "port-connected" : ""}`}
                />
            </div>
        </div>
    );
};

export default MassFlowInlet; 