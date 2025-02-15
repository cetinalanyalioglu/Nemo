import React from 'react';
import { useNodeContext } from '../../context/NodeContext';
import BaseCustomNode from './BaseCustomNode';
import { BsArrowDownCircle } from 'react-icons/bs';

export const elementIcon = BsArrowDownCircle;

/**
 * Configuration object for the MassFlowInlet element.
 * Defines a boundary condition node that specifies inlet flow conditions.
 * Contains a single output port and configurable flow parameters.
 */
export const elementInfo = {
    type: 'MassFlowInlet',
    displayName: 'Mass Flow Inlet',
    // Single output port configuration
    ports: {
        source: ['0']  // Output port for flow conditions
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
            min: 0,  // Flow rate cannot be negative
        },
        temperature: {
            label: 'Temperature',
            type: 'float',
            defaultValue: 298.15,  // Room temperature in Kelvin
            unit: 'K',
            category: 'Parameters',
            min: 0,  // Absolute temperature cannot be negative
        },
        pressure: {
            label: 'Total Pressure',
            type: 'float',
            defaultValue: 101325,  // Standard atmospheric pressure in Pascal
            unit: 'Pa',
            category: 'Parameters',
            min: 0,  // Absolute pressure cannot be negative
        }
    }
};

/**
 * MassFlowInlet component representing a boundary condition for flow inlet.
 * Specifies mass flow rate, temperature, and pressure conditions for the flow.
 * 
 * @param {string} id - Unique identifier for the node
 * @param {Object} data - Node data containing parameters and state
 * @param {boolean} selected - Whether the node is currently selected
 * @param {string} type - Type of the node
 * @returns {React.Component} MassFlowInlet node component
 */
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

export default MassFlowInlet; 