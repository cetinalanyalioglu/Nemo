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
  // Önce target ve source portlarının sayısını güvenli bir şekilde alalım
  const targetPorts = ports?.target || [];
  const sourcePorts = ports?.source || [];

  return (
    <div className={`custom-node ${type} ${selected ? 'custom-node-selected' : ''}`}>
      {/* Sol Portlar - Target */}
      <div className="custom-port-container custom-port-left">
        {targetPorts.map((portId, idx) => (
          <div key={portId} className="port-wrapper">
            <IoChevronForward className="port-icon port-icon-target" />
            <span className="port-index">{idx}</span>
            <Handle
              type="target"
              position="left"
              id={`${id}-port-${idx}`}
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
        <div className="custom-node-type">{type}</div>
      </div>

      {/* Sağ Portlar - Source */}
      <div className="custom-port-container custom-port-right">
        {sourcePorts.map((portId, idx) => {
          const portIndex = targetPorts.length + idx;
          return (
            <div key={portId} className="port-wrapper">
              <IoChevronBack className="port-icon port-icon-source" />
              <span className="port-index">{portIndex}</span>
              <Handle
                type="source"
                position="right"
                id={`${id}-port-${portIndex}`}
                className="react-flow__handle custom-handle"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BaseCustomNode; 