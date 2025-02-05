import React, { useState, useContext } from 'react';
import { NodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';

export const elementInfo = {
    type: 'MassFlowInlet',
    displayName: 'Mass Flow Inlet',
    ports: {
        source: ['port-0']
    },
    category: 'Single port elements',
    parameters: {
        label: {
            label: 'Label',
            type: 'string',
            defaultValue: 'MassFlowInlet',
            category: 'General',
        },
        massFlowRate: {
            label: 'Mass Flow Rate',
            type: 'float',
            defaultValue: 1.0,
            unit: 'kg/s',
            category: 'Parameters',
            min: 0,
            max: 100
        },
        temperature: {
            label: 'Temperature',
            type: 'float',
            defaultValue: 298.15,
            unit: 'K',
            category: 'Parameters',
            min: 0,
            max: 1000
        },
        pressure: {
            label: 'Total Pressure',
            type: 'float',
            defaultValue: 101325,
            unit: 'Pa',
            category: 'Parameters',
            min: 0,
            max: 1000000
        }
    }
};

const MassFlowInlet = ({ id, data, selected, type }) => {
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

export default MassFlowInlet; 