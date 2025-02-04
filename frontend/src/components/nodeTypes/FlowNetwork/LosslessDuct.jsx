import React, { useState, useContext } from 'react';
import { Handle, Position, useStore } from 'reactflow';
import '../../../styles/nodes.css';
import { NodeContext } from '../../NodeContext';

export const elementInfo = {
    type: 'LosslessDuct',
    ports: {
        target: ['port-0'],
        source: ['port-1']
    },
    category: 'Two port elements',
    parameters: {
        label: {
            label: 'Label',
            type: 'string',
            defaultValue: 'LosslessDuct',
            category: 'General',
        },
        diameter: {
            label: 'Diameter',
            type: 'float',
            defaultValue: 0.1,
            unit: 'm',
            category: 'Parameters',
            min: 0.001,
            max: 10
        },
        length: {
            label: 'Length',
            type: 'float',
            defaultValue: 1.0,
            unit: 'm',
            category: 'Parameters',
            min: 0.001,
            max: 100
        }
    }
};

const LosslessDuct = ({ id, data, selected, type }) => {
    const { nodeStates, updateNodeParameter } = useContext(NodeContext);
    const edges = useStore((store) => store.edges);
    const [isEditing, setIsEditing] = useState(false);
    const [tempLabel, setTempLabel] = useState('');

    const nodeState = nodeStates[id];

    if (!nodeState) {
        return <div>Loading...</div>;
    }

    const isPortConnected = (nodeId, portId) => {
        return edges.some(edge => 
            (edge.source === nodeId && edge.sourceHandle === portId) ||
            (edge.target === nodeId && edge.targetHandle === portId)
        );
    };

    const startEditing = () => {
        setTempLabel(nodeState.parameters.label);
        setIsEditing(true);
    };

    const onChange = (evt) => {
        setTempLabel(evt.target.value);
    };

    const finishEditing = () => {
        const newLabel = tempLabel.trim();
        if (newLabel) {
            updateNodeParameter(id, 'label', newLabel);
        }
        setIsEditing(false);
    };

    const onKeyDown = (evt) => {
        if (evt.key === 'Enter') {
            finishEditing();
        } else if (evt.key === 'Escape') {
            setIsEditing(false);
        }
    };

    return (
        <div className={`lossless-duct-node ${selected ? 'selected' : ''}`}>
            <div className="port-container-left">
                <Handle
                    type="target"
                    position={Position.Left}
                    id="port-0"
                    className={`react-flow__handle ${isPortConnected(id, "port-0") ? "port-connected" : ""}`}
                />
                <span className="port-index">0</span>
            </div>
            {isEditing ? (
                <input
                    value={tempLabel}
                    onChange={onChange}
                    onBlur={finishEditing}
                    onKeyDown={onKeyDown}
                    autoFocus
                    className="node-input"
                    spellCheck="false"
                />
            ) : (
                <div 
                    className="node-label"
                    onDoubleClick={startEditing}
                >
                    {nodeState.parameters.label}
                </div>
            )}
            <div className="node-type">
                type: {type}
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