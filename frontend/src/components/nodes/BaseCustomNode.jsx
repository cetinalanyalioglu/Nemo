import React from 'react';
import { Handle } from 'reactflow';
import '../../styles/custom-node.css';

const BaseCustomNode = ({ id, data, selected, type, ports = { target: [], source: [] } }) => {
  return (
    <div className={`base-custom-node ${selected ? 'selected' : ''}`}>
      {/* Sol Portlar */}
      <div className="port-container left">
        {ports.target && ports.target.map((portId) => (
          <Handle
            key={portId}
            type="target"
            position="left"
            id={portId}
            className={`node-handle ${portId}_handle`}
          />
        ))}
      </div>

      {/* İçerik */}
      <div className="node-content">
        {data.isEditing ? (
          <input
            value={data.tempLabel}
            onChange={(e) => data.onChange(e)}
            onBlur={() => data.finishEditing(id)}
            onKeyDown={(e) => data.onKeyDown(e)}
            autoFocus
            className="node-input"
            spellCheck="false"
          />
        ) : (
          <div className="node-label" onDoubleClick={() => data.startEditing(id)}>
            {data.label}
          </div>
        )}
        <div className="node-type">type: {type}</div>
      </div>

      {/* Sağ Portlar */}
      <div className="port-container right">
        {ports.source && ports.source.map((portId) => (
          <Handle
            key={portId}
            type="source"
            position="right"
            id={portId}
            className={`node-handle ${portId}_handle`}
          />
        ))}
      </div>
    </div>
  );
};

export default BaseCustomNode; 