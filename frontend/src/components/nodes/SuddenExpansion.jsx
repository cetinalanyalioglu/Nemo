import React, { useState, useContext } from 'react';
import { NodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';

export const elementInfo = {
    type: 'SuddenExpansion',
    displayName: 'Sudden Expansion',
    ports: {
        target: ['port-0'],
        source: ['port-1']
    },
    category: 'Two port elements',
    parameters: {
        label: {
            label: 'Label',
            type: 'string',
            defaultValue: 'SuddenExpansion',
            category: 'General',
        },
        expansionRatio: {
            label: 'Expansion Ratio',
            type: 'float',
            defaultValue: 2.0,
            category: 'Parameters',
            min: 1.0,
            max: 10.0
        }
    }
};

const SuddenExpansion = ({ id, data, selected, type }) => {
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

export default SuddenExpansion; 