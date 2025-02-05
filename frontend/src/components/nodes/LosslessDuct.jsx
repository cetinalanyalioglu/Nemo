import React, { useState, useContext } from 'react';
import { NodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';

export const elementInfo = {
    type: 'LosslessDuct',
    displayName: 'Lossless Duct',
    ports: {
        target: ['port-0'],
        source: ['port-1']
    },
    category: 'Two port elements',
    parameters: {
        label: {
            label: 'Label',
            type: 'string',
            defaultValue: 'LosslessDuct',
            category: 'General',
        },
        diameter: {
            label: 'Diameter',
            type: 'float',
            defaultValue: 0.1,
            unit: 'm',
            category: 'Parameters',
            min: 0.001,
            max: 100
        },
        length: {
            label: 'Length',
            type: 'float',
            defaultValue: 1.0,
            unit: 'm',
            category: 'Parameters',
            min: 0.001,
            max: 100
        }
    }
};

const LosslessDuct = ({ id, data, selected, type }) => {
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

export default LosslessDuct; 