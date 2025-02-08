import React, { useState, useRef, useLayoutEffect } from 'react';
import { Handle } from 'reactflow';
import { IoChevronBack, IoChevronForward } from 'react-icons/io5';
import '../../styles/custom-node.css';
import { elementIcons } from './nodeTypes';

const BaseCustomNode = ({ id, data, selected, type, ports = { target: [], source: [] } }) => {
  // Portları alıyoruz; eğer dizi değilse, varsayılan olarak boş dizi kullanıyoruz.
  const targetPorts = Array.isArray(ports?.target) ? ports.target : [];
  const sourcePorts = Array.isArray(ports?.source) ? ports.source : [];

  // Node referansı, boyut state'i ve başlangıç (doğal) boyutları tutacak ref'ler
  const nodeRef = useRef(null);
  const [nodeSize, setNodeSize] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const initialSizeRef = useRef(null);
  const hasInitializedRef = useRef(false);

  // İlk render'da content box boyutlarını kaydet
  useLayoutEffect(() => {
    if (nodeRef.current && !hasInitializedRef.current) {
      const element = nodeRef.current;
      const computedStyle = window.getComputedStyle(element);
      
      const paddingX = parseFloat(computedStyle.paddingLeft) + parseFloat(computedStyle.paddingRight);
      const paddingY = parseFloat(computedStyle.paddingTop) + parseFloat(computedStyle.paddingBottom);
      const borderX = parseFloat(computedStyle.borderLeftWidth) + parseFloat(computedStyle.borderRightWidth);
      const borderY = parseFloat(computedStyle.borderTopWidth) + parseFloat(computedStyle.borderBottomWidth);

      const rect = element.getBoundingClientRect();
      
      initialSizeRef.current = {
        width: rect.width - paddingX - borderX,
        height: rect.height - paddingY - borderY
      };
      
      hasInitializedRef.current = true;
    }
  }, []);

  const resetSize = () => {
    setNodeSize(null);
  };

  const handleResizeStart = (e) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);

    const element = nodeRef.current;
    const rect = element.getBoundingClientRect();
    
    const startWidth = rect.width;
    const startHeight = rect.height;
    
    const startX = e.clientX;
    const startY = e.clientY;

    const onPointerMove = (eMove) => {
      const deltaX = eMove.clientX - startX;
      const deltaY = eMove.clientY - startY;

      // Minimum boyutları kontrol et
      const minWidth = initialSizeRef.current?.width || 100; // Fallback değeri
      const minHeight = initialSizeRef.current?.height || 50; // Fallback değeri

      const newWidth = Math.max(startWidth + deltaX, minWidth);
      const newHeight = Math.max(startHeight + deltaY, minHeight);

      setNodeSize({
        width: newWidth,
        height: newHeight
      });
    };

    const onPointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const TypeIcon = elementIcons[type];

  const style = nodeSize ? {
    width: `${nodeSize.width}px`,
    height: `${nodeSize.height}px`,
    boxSizing: 'content-box'
  } : {};

  // Port durumuna göre class isimleri oluştur
  const hasLeftPort = ports.target && ports.target.length > 0;
  const hasRightPort = ports.source && ports.source.length > 0;
  const nodeClasses = [
    'custom-node',
    type,
    selected ? 'custom-node-selected' : '',
    hasLeftPort ? 'has-left-port' : '',
    hasRightPort ? 'has-right-port' : '',
    isResizing ? 'resizing' : ''
  ].join(' ');

  return (
    <div
      className={nodeClasses}
      ref={nodeRef}
      style={style}
    >
      {TypeIcon && <TypeIcon className="node-type-icon" />}

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
          <div 
            className="custom-node-label" 
            onDoubleClick={() => data.startEditing(id)}
          >
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

      {/* Resize handle sadece node seçili iken görünür */}
      {selected && (
        <div 
          className="resize-handle" 
          onPointerDown={handleResizeStart} 
          onDoubleClick={resetSize}
        />
      )}
    </div>
  );
};

export default BaseCustomNode; 