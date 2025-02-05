import React, { useState, useContext } from 'react';
import { NodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';

export const elementInfo = {
    type: 'PressureOutlet',
    displayName: 'Pressure Outlet',
    ports: {
        target: ['port-0']
    },
    category: 'Single port elements',
    parameters: {
        label: {
            label: 'Label',
            type: 'string',
            defaultValue: 'PressureOutlet',
            category: 'General',
        },
        pressure: {
            label: 'Pressure',
            type: 'float',
            defaultValue: 101325,
            unit: 'Pa',
            category: 'Parameters',
            min: 0,
            max: Infinity
        },
        allowReverseFlow: {
            label: 'Allow reverse flow',
            type: 'boolean',
            category: 'Parameters',
            defaultValue: false
        }
    }
};

const PressureOutlet = ({ id, data, selected, type }) => {
    const { nodeStates, updateNodeParameter } = useContext(NodeContext);
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState('');

    const nodeState = nodeStates[id];

    if (!nodeState) {
        return <div>Loading...</div>;
    }

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
        <BaseCustomNode
            id={id}
            data={{
                label: nodeState.parameters.label,
                isEditing,
                tempLabel,
                onChange,
                finishEditing,
                onKeyDown,
                startEditing
            }}
            selected={selected}
            type={type}
            ports={elementInfo.ports}
        />
    );
};

export default PressureOutlet; 