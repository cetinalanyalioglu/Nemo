import React, { useState, useContext } from 'react';
import { useNodeContext } from '../NodeContext';
import BaseCustomNode from './BaseCustomNode';

export const elementInfo = {
    type: 'LosslessSplitter',
    displayName: 'Lossless Splitter',
    ports: {
        target: ['port-0'],
        source: ['port-1', 'port-2']
    },
    category: 'Two port elements',
    parameters: {
        label: {
            label: 'Label',
            type: 'string',
            defaultValue: 'Lossless Splitter',
            category: 'General',
        },
    }
};

const LosslessSplitter = ({ id, data, selected, type }) => {
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

export default LosslessSplitter; 