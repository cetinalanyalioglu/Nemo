import React from 'react';
import '../styles/sidebar.css';

const Sidebar = () => {
    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                Element Library
            </div>
            <div className="element-category">
                <div className="category-header">Flow Network</div>
                <div className="element-list">
                    <div 
                        className="element-item"
                        onDragStart={(event) => onDragStart(event, 'MassFlowInlet')} 
                        draggable
                    >
                        <span className="element-label">Mass Flow Inlet</span>
                    </div>
                    <div 
                        className="element-item"
                        onDragStart={(event) => onDragStart(event, 'LosslessDuct')} 
                        draggable
                    >
                        <span className="element-label">Lossless Duct</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar; 