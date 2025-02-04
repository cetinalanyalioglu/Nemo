import React, { useState } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import '../../../styles/nodes.css';

export const elementInfo = {
    type: 'PressureOutlet',
    ports: {
        target: ['port-0']
    },
    category: 'Single port elements',
    parameters: {
        label: {
            type: 'string',
            defaultValue: 'PressureOutlet',
            category: 'General',
        },
        pressure: {
            label: 'Pressure',
            type: 'float',
            defaultValue: 101325,
            unit: 'Pa',
            category: 'Flow Properties',
            min: 0,
            max: Infinity
        },
        allowReverseFlow: {
            label: 'Allow reverse flow',
            type: 'boolean',
            defaultValue: false
        }
    }
};

const PressureOutlet = ({ id, data, selected, nodeState, updateNodeParameter }) => {
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
        <div className={`pressure-outlet-node ${selected ? 'selected' : ''}`}>
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
            <div className="port-container-left">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="port-0"
                    className={`react-flow__handle ${isPortConnected(id, "port-0") ? "port-connected" : ""}`}
                />
                <span className="port-index">0</span>
            </div>
        </div>
    );
};

export default PressureOutlet; 