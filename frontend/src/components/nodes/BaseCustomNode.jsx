import React from 'react';
import { Handle } from 'reactflow';
import { 
  IoChevronBack,    // Zarif chevron
  IoChevronForward,
  // Alternatifler:
  IoCaretBack,    // Üçgen
  IoCaretForward,
  IoPlayBack,     // Play button stili
  IoPlayForward,
} from 'react-icons/io5';
import '../../styles/custom-node.css';

const BaseCustomNode = ({ id, data, selected, type, ports = { target: [], source: [] } }) => {
  return (
    <div className={`custom-node ${type} ${selected ? 'custom-node-selected' : ''}`}>
      {/* Sol Portlar - SADECE TARGET */}
      <div className="custom-port-container custom-port-left">
        {ports.target && ports.target.map((portId) => (
          <div key={portId} className="port-wrapper">
            <IoChevronForward className="port-icon port-icon-target" />
            <Handle
              type="target"
              position="left"
              id={portId}
              className="react-flow__handle custom-handle"
            />
          </div>
        ))}
      </div>

      {/* İçerik */}
      <div className="custom-node-content">
        {data.isEditing ? (
          <input
            value={data.tempLabel}
            onChange={(e) => data.onChange(e)}
            onBlur={() => data.finishEditing(id)}
            onKeyDown={(e) => data.onKeyDown(e)}
            autoFocus
            className="custom-node-input"
            spellCheck="false"
          />
        ) : (
          <div className="custom-node-label" onDoubleClick={() => data.startEditing(id)}>
            {data.label}
          </div>
        )}
        <div className="custom-node-type">type: {type}</div>
      </div>

      {/* Sağ Portlar - SADECE SOURCE */}
      <div className="custom-port-container custom-port-right">
        {ports.source && ports.source.map((portId) => (
          <div key={portId} className="port-wrapper">
            <IoChevronBack className="port-icon port-icon-source" />
            <Handle
              type="source"
              position="right"
              id={portId}
              className="react-flow__handle custom-handle"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default BaseCustomNode; 