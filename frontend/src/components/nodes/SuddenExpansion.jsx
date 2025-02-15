import React from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsArrowsExpand } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';

export const elementIcon = BsArrowsExpand;

/**
 * Configuration object for the SuddenExpansion element.
 * Defines a component that models a sudden increase in flow area.
 * Contains one input and one output port.
 */
export const elementInfo = createElementInfo({
    type: 'SuddenExpansion',
    displayName: 'Sudden Expansion',
    category: 'Two port elements',
    // Fixed ports configuration: one input and one output
    ports: {
        target: ['0'],  // Input port (smaller diameter)
        source: ['1']   // Output port (larger diameter)
    },
    parameters: {
        label: {
            defaultValue: 'SuddenExpansion'
        }
    }
});

/**
 * SuddenExpansion component representing an abrupt increase in flow area.
 * Models the pressure loss and flow behavior in a sudden expansion.
 * 
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} SuddenExpansion node component
 */
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

export default SuddenExpansion; 