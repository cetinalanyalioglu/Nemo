import React from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsArrowUpCircle } from 'react-icons/bs';
import { createElementInfo } from './nodeUtils';

export const elementIcon = BsArrowUpCircle;

/**
 * Configuration object for the PressureOutlet element.
 * Defines a boundary condition node that specifies outlet pressure conditions.
 * Contains a single input port and configurable pressure parameters.
 */
export const elementInfo = createElementInfo({
    type: 'PressureOutlet',
    displayName: 'Pressure Outlet',
    category: 'Single port elements',
    // Single input port configuration
    ports: {
        target: ['0']  // Input port for flow
    },
    parameters: {
        label: {
            defaultValue: 'PressureOutlet',
            editable: true  // Explicitly mark as editable
        },
        pressure: {
            label: 'Pressure',
            type: 'float',
            defaultValue: 101325,  // Standard atmospheric pressure in Pascal
            unit: 'Pa',
            category: 'Parameters',
            min: 0,  // Absolute pressure cannot be negative
            max: Infinity,
            editable: true
        },
        allowReverseFlow: {
            label: 'Allow reverse flow',
            type: 'boolean',
            category: 'Parameters',
            defaultValue: false,  // By default, flow can only exit through the outlet
            editable: true
        },
        totalTemperature: {
            label: 'Total Temperature',
            type: 'float',
            defaultValue: 298.15,  // Room temperature in Kelvin
            unit: 'K',
            category: 'Parameters',
            min: 0,  // Absolute temperature cannot be negative
            editable: true,
            visibleIf: {
                parameter: 'allowReverseFlow',
                equals: true
            }
        },
    }
});

/**
 * PressureOutlet component representing a boundary condition for flow outlet.
 * Specifies pressure conditions and flow direction constraints at the outlet.
 * 
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} PressureOutlet node component
 */
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

export default PressureOutlet; 