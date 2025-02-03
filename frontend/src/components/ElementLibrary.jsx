import React from 'react';
import './ElementLibrary.css';
import { elements } from './nodeTypes/FlowNetwork';

const ElementLibrary = () => {
  const onDragStart = (event, element) => {
    console.log('Dragging element:', element.type);
    event.dataTransfer.setData('application/reactflow', element.type);
    event.dataTransfer.setData('text/plain', element.type);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="element-library">
      <h3>Flow Network Elements</h3>
      {elements.map((element) => (
        <div
          key={element.type}
          className="element-item"
          draggable={true}
          onDragStart={(e) => onDragStart(e, element)}
          title={element.description}
        >
          {element.label}
        </div>
      ))}
    </div>
  );
};

export default ElementLibrary; 