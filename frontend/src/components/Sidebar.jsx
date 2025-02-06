import React, { useState } from 'react';
import { 
    IoChevronBackCircleOutline,
    IoLibrary,
    IoChevronDown,
    IoSaveOutline
} from 'react-icons/io5';
import '../styles/sidebar.css';
import { elementInfo } from './nodes/nodeTypes';

const formatCategoryName = (category) => {
    return category.toUpperCase().replace(/I/g, 'I');
};

const Sidebar = ({ isOpen, onToggle, onExport }) => {
    const [collapsedGroups, setCollapsedGroups] = useState({});

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    const toggleGroup = (category) => {
        setCollapsedGroups(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const groupedElements = Object.entries(elementInfo).reduce((acc, [type, info]) => {
        const category = info.category;
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push({ type, info });
        return acc;
    }, {});

    return (
        <>
            {/* Panel kapalıyken görünecek ikonlar */}
            {!isOpen && (
                <div className="sidebar-closed-icons">
                    <button className="library-button" onClick={onToggle}>
                        <IoLibrary />
                    </button>
                    <button className="library-button save-button" onClick={onExport} title="Export Topology">
                        <IoSaveOutline />
                    </button>
                </div>
            )}
            
            {/* Ana sidebar */}
            <div className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="panel-icon-wrapper">
                        <IoLibrary className="panel-icon" />
                        <span className="panel-title">ELEMENT LiBRARY</span>
                    </div>
                    <IoChevronBackCircleOutline
                        className={`toggle-icon ${!isOpen ? 'closed' : ''}`}
                        onClick={onToggle}
                    />
                </div>
                
                {/* Yeni: Export ikonu - sadece sidebar kapalıyken görünür */}
                <div className="action-icons">
                    <button 
                        className="action-button" 
                        onClick={onExport}
                        title="Export Topology"
                    >
                        <IoSaveOutline className="action-icon" />
                    </button>
                </div>

                {Object.entries(groupedElements).map(([category, elements]) => (
                    <div key={category} className={`elements-group ${collapsedGroups[category] ? 'collapsed' : ''}`}>
                        <div 
                            className="group-header"
                            onClick={() => toggleGroup(category)}
                        >
                            <div className="group-header-content">
                                <span>{formatCategoryName(category)}</span>
                                <IoChevronDown className="group-collapse-icon" style={{ transform: collapsedGroups[category] ? 'rotate(-90deg)' : 'rotate(0deg)' }} />
                            </div>
                        </div>
                        <div className={`group-content ${collapsedGroups[category] ? 'collapsed' : ''}`}>
                            {elements.map(({ type, info }) => (
                                <div
                                    key={type}
                                    className="element-item"
                                    draggable
                                    onDragStart={(e) => onDragStart(e, type)}
                                >
                                    {info.icon && <info.icon className="element-icon" />}
                                    <span className="element-label">{info.displayName || type}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default Sidebar; 