import React, { useState, useContext } from 'react';
import { NodeContext, useNodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsArrowsExpand } from 'react-icons/bs';

export const elementIcon = BsArrowsExpand;

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
                finishEditing: () => contextFinishEditing(id),
                onKeyDown: (e) => contextOnKeyDown(id, e),
                startEditing: () => contextStartEditing(id)
            }}
            selected={selected}
            type={type}
            ports={elementInfo.ports}
        />
    );
};

export default SuddenExpansion; 