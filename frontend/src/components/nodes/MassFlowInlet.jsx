import React, { useState, useContext } from 'react';
import { useNodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsArrowDownCircle } from 'react-icons/bs';

export const elementIcon = BsArrowDownCircle;

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

export default MassFlowInlet; 