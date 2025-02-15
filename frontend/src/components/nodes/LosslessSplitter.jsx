import React from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsDiagram2 } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';

export const elementIcon = BsDiagram2;

/**
 * Configuration object for the LosslessSplitter element.
 * Defines a component that splits a flow into two outputs without energy losses.
 * Contains fixed configuration of one input port and two output ports.
 */
export const elementInfo = createElementInfo({
    type: 'LosslessSplitter',
    displayName: 'Lossless Splitter',
    category: 'Three port elements',
    // Fixed ports configuration: one input (target) and two outputs (sources)
    ports: {
        target: ['0'],  // Input port
        source: ['1', '2']  // Two output ports
    },
    parameters: {
        label: {
            defaultValue: 'Lossless Splitter'
        }
    }
});

/**
 * LosslessSplitter component representing a flow splitter with no energy losses.
 * Splits an input flow into two output flows while maintaining conservation laws.
 * 
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} LosslessSplitter node component
 */
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
        console.log("Received null nodeState while rendering node ", id);
        return <div>Error</div>;
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

export default LosslessSplitter; 