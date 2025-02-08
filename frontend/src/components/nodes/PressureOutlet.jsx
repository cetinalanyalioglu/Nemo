import React from 'react';
import { useNodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsArrowUpCircle } from 'react-icons/bs';

export const elementIcon = BsArrowUpCircle;

export const elementInfo = {
    type: 'PressureOutlet',
    displayName: 'Pressure Outlet',
    category: 'Single port elements',
    ports: {
        target: ['in1'],
        source: []
    },
    parameters: {
        label: {
            type: 'string',
            defaultValue: 'Pressure Outlet',
            category: 'GENERAL'
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
    const { 
        nodeStates, 
        editingStates,
        startEditing: contextStartEditing,
        onChange: contextOnChange,
        onKeyDown: contextOnKeyDown,
        finishEditing: contextFinishEditing
    } = useNodeContext();

    const nodeState = nodeStates[id];
    const editingState = editingStates[id] || { isEditing: false, tempLabel: '' };

    if (!nodeState) {
        return <div>Loading...</div>;
    }

    return (
        <BaseCustomNode
            id={id}
            data={{
                label: nodeState.parameters.label,
                isEditing: editingState.isEditing,
                tempLabel: editingState.tempLabel,
                onChange: (e) => contextOnChange(id, e),
                onKeyDown: (e) => contextOnKeyDown(id, e),
                finishEditing: () => contextFinishEditing(id),
                startEditing: () => contextStartEditing(id)
            }}
            selected={selected}
            type={type}
            ports={elementInfo.ports}
        />
    );
};

export default PressureOutlet; 