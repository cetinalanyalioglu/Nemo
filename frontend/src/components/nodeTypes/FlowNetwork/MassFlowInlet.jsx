import React, { useState } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import '../../../styles/nodes.css';

export const elementInfo = {
    type: 'MassFlowInlet',
    label: 'Mass Flow Inlet',
    ports: {
        source: ['port-0']
    },
    parameters: {
        massFlowRate: {
            label: 'Mass Flow Rate',
            type: 'float',
            defaultValue: 1.0,
            unit: 'kg/s',
            category: 'Flow',
            min: 0,
            max: 100
        },
        temperature: {
            label: 'Temperature',
            type: 'float',
            defaultValue: 298.15,
            unit: 'K',
            category: 'Flow Properties',
            min: 0,
            max: 1000
        },
        pressure: {
            label: 'Total Pressure',
            type: 'float',
            defaultValue: 101325,
            unit: 'Pa',
            category: 'Flow Properties',
            min: 0,
            max: 1000000
        }
    }
};

const MassFlowInlet = ({ id, data, selected }) => {
    const edges = useStore((store) => store.edges);
    const [isEditing, setIsEditing] = useState(false);
    const [labelText, setLabelText] = useState(data.label || '');

    React.useEffect(() => {
        setLabelText(data.label || '');
    }, [data.label]);

    const isPortConnected = (nodeId, portId) => {
        return edges.some(edge => 
            (edge.source === nodeId && edge.sourceHandle === portId) ||
            (edge.target === nodeId && edge.targetHandle === portId)
        );
    };

    // Debug için port durumunu konsola yazdıralım
    console.log('Node ID:', id);
    console.log('Edges:', edges);
    console.log('Port 0 connected:', isPortConnected(id, "port-0"));

    const onDoubleClick = () => {
        setIsEditing(true);
    };

    const onChange = (evt) => {
        setLabelText(evt.target.value);
    };

    const onKeyDown = (evt) => {
        if (evt.key === 'Enter') {
            setIsEditing(false);
        }
    };

    const onBlur = () => {
        setIsEditing(false);
    };

    return (
        <div className={`mass-flow-inlet-node ${selected ? 'selected' : ''}`}>
            {isEditing ? (
                <input
                    value={labelText}
                    onChange={onChange}
                    onBlur={onBlur}
                    onKeyDown={onKeyDown}
                    autoFocus
                    className="node-input"
                />
            ) : (
                <div onDoubleClick={onDoubleClick} className="node-label">
                    {data.label || ''}
                </div>
            )}
            <div className="node-type">
                type: {data.type || 'MassFlowInlet'}
            </div>
            <div className="port-container">
                <span className="port-index">0</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="port-0"
                    className={`react-flow__handle ${isPortConnected(id, "port-0") ? "port-connected" : ""}`}
                />
            </div>
        </div>
    );
};

export default MassFlowInlet; 