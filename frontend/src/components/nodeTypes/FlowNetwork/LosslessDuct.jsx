import React, { useState } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import '../../../styles/nodes.css';

export const elementInfo = {
    type: 'LosslessDuct',
    label: 'Lossless Duct',
    ports: {
        target: ['port-0'],
        source: ['port-1']
    },
    parameters: {
        diameter: {
            label: 'Diameter',
            type: 'float',
            defaultValue: 0.1,
            unit: 'm',
            category: 'Geometry',
            min: 0.001,
            max: 10
        },
        length: {
            label: 'Length',
            type: 'float',
            defaultValue: 1.0,
            unit: 'm',
            category: 'Geometry',
            min: 0.001,
            max: 100
        }
    }
};

const LosslessDuct = ({ id, data, selected }) => {
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
        <div className={`lossless-duct-node ${selected ? 'selected' : ''}`}>
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
                type: {data.type || 'LosslessDuct'}
            </div>
            <div className="port-container-left">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="port-0"
                    className={`react-flow__handle ${isPortConnected(id, "port-0") ? "port-connected" : ""}`}
                />
                <span className="port-index">0</span>
            </div>
            <div className="port-container-right">
                <span className="port-index">1</span>
                <Handle
                    type="source"
                    position={Position.Right}
                    id="port-1"
                    className={`react-flow__handle ${isPortConnected(id, "port-1") ? "port-connected" : ""}`}
                />
            </div>
        </div>
    );
};

export default LosslessDuct; 